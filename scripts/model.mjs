// Look at a frame, edit the code that drew it, rebuild, look again.
//
//   node scripts/model.mjs <id> --files=a.js,b.js [--beats=20-22] [--at=0.7,0.8]
//        [--focus="..."] [--model=gpt-5.6-sol] [--rounds=3] [--effort=high]
//        [--max-usd=] [--gate] [--dry-run] [--keep-on-fail]
//
// THE THIRD TOOL, and the first one that WRITES.
//
//   review.mjs    BLIND     frames only            "does the picture show what
//                                                   the copy claims?"
//   critique.mjs  INFORMED  frames + source        "how would I fix this?"
//   model.mjs     BUILDER   frames + source + EDIT "fix it, then look again"
//
// `CLAUDE.md` says creation stays agent-backed because building a journey is an
// edit → gate → read-failure → edit loop that one API call cannot run. That is
// still true of a JOURNEY. It is not true of a MODEL: an archetype's whole
// quality is visible in one rendered frame, so the loop is small enough to be a
// script. This is that script. It is deliberately NOT allowed to grow into an
// agent — see the scope rules below.
//
// WHAT IT MAY TOUCH. Only `--files`. There is no discovery step, no repo
// walking, and no "while I was here". The operator chooses the scope; the model
// does the craft inside it. A write outside the set is refused and reported.
//
// WHY THE LOOP IS THE WHOLE POINT. A single call is a guess: it edits code it
// cannot see the effect of. Round 2 is the first time the model sees its own
// work rendered, and in practice that is where most of the quality arrives —
// the same reason this repo insists a human looks at frames rather than at
// metrics. Rounds are capped and every round is a ledger line.
//
// COST. Frames dominate at ~1,700 tokens each, and the source is re-sent every
// round because it changes every round. `--max-usd` is checked per round BEFORE
// sending, not reported afterwards.
import { existsSync, writeFileSync, readFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const flag = (n, d) => {
  const f = args.find((a) => a.startsWith(`--${n}=`));
  return f ? f.split('=').slice(1).join('=') : d;
};
const has = (n) => args.includes(`--${n}`);

const id = args.find((a) => !a.startsWith('--'));
if (!id) {
  console.error(
    'usage: node scripts/model.mjs <id> --files=a.js,b.js [--beats=20-22] [--at=0.7]\n' +
    '                                  [--focus="..."] [--model=] [--rounds=3]\n' +
    '                                  [--effort=high] [--max-usd=] [--gate] [--dry-run]',
  );
  process.exit(2);
}
const journeyDir = resolve('src/journeys', id);
if (!existsSync(journeyDir)) { console.error(`no such journey: ${id}`); process.exit(2); }

// MODEL SELECTION MUST HAPPEN BEFORE env.mjs IS IMPORTED. `OPENAI_MODEL` is
// read at module load into a const, so a static import would bind the default
// before this line ran. Hence the dynamic imports further down.
const model = flag('model', 'gpt-5.6-sol');
process.env.OPENAI_MODEL = model;

const rounds = Number(flag('rounds', '3'));
const effort = flag('effort', 'high');
const maxUsd = flag('max-usd') != null ? Number(flag('max-usd')) : null;
const focus = flag('focus', '');
const dryRun = has('dry-run');
const wantGate = has('gate');
const keepOnFail = has('keep-on-fail');
const port = flag('port', '5175');

const filesArg = flag('files');
if (!filesArg) { console.error('--files is required: the model may edit nothing else'); process.exit(2); }

// READ-ONLY CONTEXT. The model has NO web access — it is a bounded API call,
// not an agent — so "go and look up how a real one is built" is not something
// it can do, however it is asked. `--reference=` is the substitute: research
// gathered by whoever runs this, handed over as text the model may read and
// must not edit. Keeping it separate from `--files` is the whole point; a
// reference document is evidence, and evidence that the model can rewrite is
// not evidence.
const referenceArg = flag('reference', '');

const { filmPaths, requireKeys } = await import('./film/lib/env.mjs');
const { Ledger } = await import('./film/lib/ledger.mjs');
const { modelRound, formatRound, backup } = await import('./film/lib/modeller.mjs');
if (!dryRun) requireKeys(['openai']);

const paths = filmPaths(id);
const workDir = resolve('review-shots', `${id}-model`);
mkdirSync(workDir, { recursive: true });

// --- the writable set -------------------------------------------------------
const writable = new Map();
for (const raw of filesArg.split(',')) {
  const rel = raw.trim().replace(/\\/g, '/');
  if (!rel) continue;
  const abs = resolve(rel);
  if (!abs.startsWith(resolve('.'))) { console.error(`refused (outside repo): ${rel}`); process.exit(2); }
  writable.set(rel, abs);
}
if (!writable.size) { console.error('--files matched nothing'); process.exit(2); }

const references = [];
for (const raw of referenceArg.split(',')) {
  const rel = raw.trim().replace(/\\/g, '/');
  if (!rel) continue;
  const abs = resolve(rel);
  if (!existsSync(abs)) { console.error(`no such reference file: ${rel}`); process.exit(2); }
  if (writable.has(rel)) { console.error(`${rel} cannot be both --files and --reference`); process.exit(2); }
  references.push({ path: rel, text: readFileSync(abs, 'utf8') });
}

// --- which frames -----------------------------------------------------------
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
const wantBeats = parseBeats(flag('beats'));
const wantAt = flag('at');

const { beats } = await import(pathToFileURL(join(journeyDir, 'beats.js')).href);

// Frames are recaptured EVERY round into a round-specific directory. Reusing a
// directory is how `reviewer.mjs` once spent a whole review describing a build
// that no longer existed — the capture overwrites `beat-23.png` with
// `beat-23.png`, so nothing downstream can tell the file changed.
function capture(round) {
  const dir = join(workDir, `round-${round}`);
  rmSync(dir, { recursive: true, force: true });
  const argv = ['scripts/shots.mjs', id, dir, port, '--blind'];
  if (wantAt) argv.push(`--at=${wantAt}`);
  const r = spawnSync(process.execPath, argv, { stdio: ['ignore', 'pipe', 'inherit'] });
  if (r.status !== 0) { console.error('capture failed — is the dev server up on ' + port + '?'); process.exit(1); }

  const files = readdirSync(dir).filter((f) => /\.png$/i.test(f)).sort();
  const out = [];
  for (const f of files) {
    const m = /^beat-(\d+)\.png$/i.exec(f);
    if (m) {
      const n = Number(m[1]);
      if (wantBeats && !wantBeats.includes(n)) continue;
      const b = beats[n - 1];
      out.push({ file: join(dir, f), label: b ? `beat ${n} — "${b.heading}"\ncopy: ${b.body}` : `beat ${n}` });
    } else {
      out.push({ file: join(dir, f), label: `u=${basename(f, '.png')}` });
    }
  }
  return out;
}

function build() {
  const r = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}\n${r.stderr ?? ''}`.trim() };
}

// ---------------------------------------------------------------------------
console.log(`\nmodel builder · ${id} · ${model} · ${rounds} round(s)`);
console.log(`  writable: ${[...writable.keys()].join(', ')}`);
if (focus) console.log(`  focus: ${focus.slice(0, 160)}${focus.length > 160 ? '…' : ''}`);
console.log('');

const ledger = new Ledger();
const restore = backup(writable, join(workDir, 'backup'));

let feedback = '';
let lastGood = true;
let stopped = '';

for (let round = 1; round <= rounds; round++) {
  const frames = capture(round);
  if (!frames.length) { console.error('no frames captured — check --beats/--at'); process.exit(1); }

  let res;
  try {
    res = await modelRound({
      frames, writable, references, focus, feedback, round, rounds,
      workDir: join(workDir, 'send'), effort, maxUsd, ledger, dryRun,
    });
  } catch (e) {
    console.error(`\n  round ${round} failed: ${e.message}`);
    stopped = e.message;
    break;
  }
  if (res.dry) { stopped = 'dry run'; break; }

  console.log(formatRound(res.json, res.applied, res.failures));

  // Nothing changed and the model says it is finished.
  if (!res.applied.length && res.json?.done) { stopped = 'model reports done'; break; }
  if (!res.applied.length && !res.failures.length) { stopped = 'model proposed no changes'; break; }

  const b = build();
  feedback = '';
  if (res.failures.length) feedback += `${res.failures.join('\n')}\n`;
  if (!b.ok) {
    // A round that does not compile must not become the base for the next one.
    // The model gets the compiler's own words — that is what fixes it.
    const tail = b.out.split('\n').slice(-40).join('\n');
    console.log(`      ✗ BUILD FAILED`);
    feedback += `\nTHE BUILD IS BROKEN by your edits. Fix it before anything else.\n${tail}\n`;
    lastGood = false;
  } else {
    console.log(`      ✓ build ok`);
    lastGood = true;
    if (res.json?.done) { stopped = 'model reports done'; break; }
  }
  console.log('');
}

if (!lastGood) {
  if (keepOnFail) {
    console.log('\nBUILD IS BROKEN and --keep-on-fail was passed. The tree is left as-is.');
  } else {
    restore();
    console.log('\nBUILD IS BROKEN after the last round — every writable file has been RESTORED.');
    console.log('Re-run with more --rounds, or with --keep-on-fail to inspect the breakage.');
  }
} else {
  console.log(`\ndone${stopped ? ` (${stopped})` : ''}. Backups in ${join(workDir, 'backup')}`);
  console.log('Review the diff before trusting it:  git diff -- ' + [...writable.keys()].join(' '));
}

if (wantGate && lastGood && !dryRun) {
  console.log('\n▶ gate\n');
  const r = spawnSync(process.execPath, ['scripts/journey-gate.mjs', id, '--quick'], { stdio: 'inherit' });
  if (r.status !== 0) console.log('\nGATE FAILED — the model may have regressed something it could not see.');
}

if (!dryRun) console.log(ledger.table());
writeFileSync(join(workDir, 'last-run.json'), JSON.stringify({ id, model, rounds, focus, files: [...writable.keys()], stopped }, null, 2));
