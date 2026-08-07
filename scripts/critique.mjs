// What is wrong with this journey, and what would fix it.
//
//   node scripts/critique.mjs <id> [--beats=3,7-9] [--focus="..."]
//        [--src=a.js,b.js] [--via=terra|agent] [--effort=] [--max-usd=]
//        [--diff] [--brief] [--json]
//
// TWO STEPS, TWO AGENTS, and this script is the first of them.
//
//   step 1  THE CRITIC (here).  gpt-5.6-terra sees the rendered frames AND the
//           source that drew them, and returns a prioritised, schema'd list of
//           defects with concrete fixes. One bounded call, one ledger line.
//   step 2  THE FIXER.  `--brief` prints a self-contained instruction to hand
//           to the `journey-builder` agent, which has the tools to edit and the
//           gate to prove it. Reused rather than duplicated: rewriting a
//           journey is an edit → gate → read-failure → edit loop, and a single
//           API call cannot run one.
//
// HOW THIS DIFFERS FROM `review.mjs`, which is the question worth asking:
//   review.mjs   BLIND. Frames only, no captions, no source. Answers "does the
//                picture show what the copy claims?" — a question that is
//                destroyed the moment the reviewer can read the heading.
//   critique.mjs INFORMED. Frames, headings and source together. Answers "how
//                do I make it better?" — which is unanswerable blind, because
//                the fix usually lives in a line of source the frame cannot
//                show you.
// Both exist. Merging them would quietly forfeit the blindness guarantee.
//
// COST. Every lever is a flag, and the estimate is checked before the request
// is sent rather than reported after it:
//   --beats=  the big one. Frames dominate the bill (~1,700 tokens each), so
//             critiquing the four beats you are actually unhappy with costs an
//             eighth of critiquing thirty-two and answers the same question.
//   --src=    layers.js files here run past 2,000 lines.
//   --max-usd refuses to send, rather than reporting an overspend.
import { existsSync, writeFileSync, readFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { filmPaths, requireKeys } from './film/lib/env.mjs';
import { Ledger } from './film/lib/ledger.mjs';
import { critique, formatCritique, fixBrief, diffCritiques } from './film/lib/critic.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => {
  const f = args.find((a) => a.startsWith(`--${n}=`));
  return f ? f.split('=').slice(1).join('=') : d;
};
const id = args.find((a) => !a.startsWith('--'));
if (!id) {
  console.error('usage: node scripts/critique.mjs <id> [--beats=3,7-9] [--focus="..."] [--src=…] [--brief]');
  process.exit(2);
}
const journeyDir = resolve('src/journeys', id);
if (!existsSync(journeyDir)) {
  console.error(`no such journey: ${id}`);
  process.exit(2);
}

const via = flag('via', 'terra');
const effort = flag('effort', 'medium');
const maxUsd = flag('max-usd') != null ? Number(flag('max-usd')) : null;
const focus = flag('focus', '');
const paths = filmPaths(id);
const out = resolve('review-shots', `${id}-critique.json`);

// --- which beats ------------------------------------------------------------
// "3,7-9" -> [3,7,8,9]. One-based, matching the frame filenames and the way
// beats are talked about everywhere else in this repo.
function parseBeats(spec) {
  if (!spec) return null;
  const set = new Set();
  for (const part of spec.split(',')) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!m) throw new Error(`bad --beats segment: ${part}`);
    const lo = +m[1], hi = m[2] ? +m[2] : lo;
    for (let k = lo; k <= hi; k++) set.add(k);
  }
  return [...set].sort((a, b) => a - b);
}
const want = parseBeats(flag('beats'));

// --- capture, if it has not been done ---------------------------------------
// The frames are the BLIND ones — the critic is given headings separately, as
// text. Reusing the same directory means no second capture run, and the frames
// carry no burned-in caption that could be mistaken for rendered content.
if (!existsSync(paths.blind)) {
  console.log('(capturing frames first)');
  const r = spawnSync(process.execPath, ['scripts/shots.mjs', id, paths.blind, '5175', '--blind'], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('capture failed — is the dev server up?');
    process.exit(1);
  }
}

// --- assemble the payload ---------------------------------------------------
const { beats } = await import(pathToFileURL(join(journeyDir, 'beats.js')).href);
const meta = (await import(pathToFileURL(join(journeyDir, 'meta.js')).href)).default;

const frames = [];
readdirSync(paths.blind)
  .filter((f) => /^beat-\d+\.png$/i.test(f))
  .sort()
  .forEach((f) => {
    const n = Number(/(\d+)/.exec(f)[1]);
    if (want && !want.includes(n)) return;
    const b = beats[n - 1];
    frames.push({
      file: join(paths.blind, f),
      label: b ? `beat ${n} — "${b.heading}"\ncopy: ${b.body}` : `beat ${n}`,
    });
  });

// --- which source -----------------------------------------------------------
// Default is the journey's own layers.js, which is where visual defects almost
// always live. --src= adds or replaces; an archetype is the usual addition,
// because "this subject cannot be expressed" is a finding about the archetype.
const srcSpec = flag('src');
const srcPaths = srcSpec
  ? srcSpec.split(',').map((s) => resolve(s.trim()))
  : [join(journeyDir, 'layers.js')];
const sources = [];
for (const p of srcPaths) {
  if (!existsSync(p)) {
    console.error(`no such source file: ${p}`);
    process.exit(2);
  }
  sources.push({ path: p.replace(resolve('.') + '\\', '').replace(/\\/g, '/'), text: readFileSync(p, 'utf8') });
}

// --- agent backend: print the brief, spend nothing ---------------------------
if (via === 'agent') {
  console.log(`
Hand this to a review agent instead of spending on Terra:

  Look at the frames in:
    ${paths.blind}${want ? `\n  Only these beats: ${want.join(', ')}` : ''}
  Read the source in:
${sources.map((s) => `    ${s.path}`).join('\n')}
${focus ? `\n  The specific complaint to investigate:\n    ${focus}\n` : ''}
  Say what is WRONG and exactly what would fix it — name the file, the symbol
  and the values. Flag anything that no existing archetype can express, because
  a new reusable archetype is the honest fix there, not a tuned parameter.

Note this is the INFORMED review. Do not use \`journey-blind-reviewer\` for it —
that agent must never see the source or the headings.
`);
  process.exit(0);
}

// --- terra backend ----------------------------------------------------------
requireKeys(['openai']);
const ledger = new Ledger();
const previous = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;

console.log(`\n${meta.title} — critique${want ? ` (beats ${want.join(', ')})` : ''}\n`);

const c = await critique({
  frames,
  sources,
  focus,
  workDir: resolve('review-shots', `${id}-critic-frames`),
  ledger,
  effort,
  maxUsd,
  log: (m) => console.log(`  ${m}`),
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(c, null, 2));

if (args.includes('--json')) {
  console.log(JSON.stringify(c, null, 2));
} else {
  console.log('');
  console.log(formatCritique(c));
}

// --- step 2: the brief for whoever applies it -------------------------------
if (args.includes('--brief')) {
  const briefPath = resolve('review-shots', `${id}-fix-brief.txt`);
  writeFileSync(briefPath, fixBrief(id, c, out));
  console.log(`\n${'='.repeat(78)}`);
  console.log(fixBrief(id, c, out));
  console.log('='.repeat(78));
  console.log(`\n→ ${briefPath}   (hand this to the \`journey-builder\` agent)`);
}

if (previous && args.includes('--diff')) {
  const d = diffCritiques(previous, c);
  console.log('\nSINCE THE LAST CRITIQUE');
  console.log(`  fixed       ${d.fixed.length}`);
  console.log(`  remaining   ${d.remaining.length}`);
  console.log(`  introduced  ${d.introduced.length}`);
  for (const f of d.introduced) console.log(`    NEW    [${f.severity}] ${f.title}`);
  for (const f of d.remaining) console.log(`    still  [${f.severity}] ${f.title}`);
} else if (previous) {
  console.log('\n(a previous critique exists — pass --diff to compare)');
}

console.log(`\n→ ${out}`);
console.log('\nSPEND');
console.log(ledger.table());
