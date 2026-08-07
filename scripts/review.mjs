// Blind review, either backend.
//
//   node scripts/review.mjs <id> [--film] [--via=terra|agent] [--diff] [--json]
//
// TWO BACKENDS, one job — name what is actually visible in a set of
// caption-free frames, without knowing what they are supposed to show.
//
//   --via=terra  (default)  one bounded gpt-5.6-terra call with a strict
//                           schema. Measured cost, diffable output, and
//                           blindness ENFORCED by what the request contains
//                           rather than requested of a well-behaved agent.
//   --via=agent             prints the exact instruction to hand to
//                           `journey-blind-reviewer`. Kept because an agent
//                           can do things a single call cannot — follow up on
//                           its own suspicion, fact-check against the web —
//                           and because a second opinion from a different
//                           model is worth having on a journey you are about
//                           to ship.
//
// WHAT GETS REVIEWED
//   default   the JOURNEY's beats — `shots.mjs --blind` output
//   --film    the FILM's master, sampled every few seconds — `film-shots.mjs`
//             output. Use this one after a film passes its gate: it catches a
//             shot that goes dead in its second half, which a per-beat still
//             cannot see.
import { existsSync, writeFileSync, readFileSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { filmPaths, requireKeys } from './film/lib/env.mjs';
import { Ledger } from './film/lib/ledger.mjs';
import { blindReview, formatReview, diffReviews } from './film/lib/reviewer.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => {
  const f = args.find((a) => a.startsWith(`--${n}=`));
  return f ? f.split('=').slice(1).join('=') : d;
};
const id = args.find((a) => !a.startsWith('--'));
if (!id) {
  console.error('usage: node scripts/review.mjs <id> [--film] [--via=terra|agent] [--diff]');
  process.exit(2);
}
if (!existsSync(resolve('src/journeys', id))) {
  console.error(`no such journey: ${id}`);
  process.exit(2);
}

const via = flag('via', 'terra');
const wantFilm = args.includes('--film');
const asJson = args.includes('--json');
const paths = filmPaths(id);
const dir = wantFilm ? paths.review : paths.blind;
const out = resolve('review-shots', `${id}${wantFilm ? '-film' : ''}-review.json`);

// --- capture, if it has not been done — or if it is STALE -------------------
// "Has the directory been created" is not the same question as "do these
// frames come from the film I am about to review", and answering the first as
// if it were the second means paying a real API bill to review the PREVIOUS
// cut. That happened on voyager: the master had been re-rendered, the frames
// on disk were a day old, and the review came back clean about a film nobody
// had made. A blind review whose provenance is not checked is worse than no
// review, because it reads as evidence.
//
// Cheap, exact test: the frames must be newer than the artefact they sample.
function staleAgainst(source) {
  if (!existsSync(source) || !existsSync(dir)) return false;
  const frames = readdirSync(dir).filter((f) => f.endsWith('.jpg') || f.endsWith('.png'));
  if (!frames.length) return true;
  const newest = Math.max(...frames.map((f) => statSync(join(dir, f)).mtimeMs));
  return statSync(source).mtimeMs > newest;
}
const source = wantFilm ? paths.master : null;
const stale = source ? staleAgainst(source) : false;
if (stale) {
  console.log('(frames are older than the master — recapturing)');
  rmSync(dir, { recursive: true, force: true });
}
if (!existsSync(dir)) {
  const NODE = process.execPath;
  console.log(`(capturing frames first)`);
  const r = wantFilm
    ? spawnSync(NODE, ['scripts/film-shots.mjs', id], { stdio: 'inherit' })
    : spawnSync(NODE, ['scripts/shots.mjs', id, dir, '5175', '--blind'], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('capture failed — is the dev server up?');
    process.exit(1);
  }
}

// --- agent backend: print the brief, do not spend --------------------------
if (via === 'agent') {
  console.log(`
Hand this to the \`journey-blind-reviewer\` agent, and nothing else:

  Review the frames in:
    ${dir}

  Say what a stranger would see in each. Do not guess at subjects you
  cannot actually identify.

DO NOT give it the beat headings, the script, the design brief, or the key
file sitting beside that directory — ${dir}.key.json exists precisely so it
can be withheld. A reviewer that can read the caption is not a reviewer.
`);
  process.exit(0);
}

// --- terra backend ---------------------------------------------------------
requireKeys(['openai']);
const ledger = new Ledger();

const previous = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;

const review = await blindReview({
  dir,
  ledger,
  stage: wantFilm ? 'film-review' : 'review',
  log: (m) => console.log(`  ${m}`),
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(review, null, 2));

if (asJson) {
  console.log(JSON.stringify(review, null, 2));
} else {
  console.log(`\n${id}${wantFilm ? ' (film)' : ''} — blind review\n`);
  console.log(formatReview(review));
}

// --- what changed since last time ------------------------------------------
// The point of a structured review. After a fix round, "gone" and "not
// mentioned this time" are indistinguishable in prose and completely
// different facts.
if (previous && args.includes('--diff')) {
  const d = diffReviews(previous, review);
  console.log('\nSINCE THE LAST REVIEW');
  console.log(`  fixed       ${d.fixed.length}`);
  console.log(`  remaining   ${d.remaining.length}`);
  console.log(`  introduced  ${d.introduced.length}`);
  for (const k of d.introduced) console.log(`    NEW  ${k}`);
  for (const k of d.remaining) console.log(`    still  ${k}`);
} else if (previous) {
  console.log('\n(a previous review exists — pass --diff to compare)');
}

console.log(`\n→ ${out}`);
console.log('\nSPEND');
console.log(ledger.table());
