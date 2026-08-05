// Is this journey DONE?
//
//   node scripts/journey-gate.mjs <id> [--sweep] [--quick] [--port=5175]
//
// One command, one verdict. This file is the definition of "completed", and it
// exists because the previous definition was an agent's own opinion.
//
// Four journeys were built by four agents. Every one of them built clean,
// printed SMOKE PASS, passed scroll-check, and was signed off with "screenshots
// looked at". One of them — `voyager` — was the same white sticker on black in
// 30 of its 32 beats. The agent was not lying; it had genuinely run everything
// it had been given, and nothing it had been given could see the defect.
//
// So the rule here is: a journey is complete when THIS script exits 0, and at
// no other time. An agent may not report a journey finished on any other
// evidence, including its own reading of the screenshots. If a defect exists
// that this script cannot see, the fix is a new check in this script — not a
// judgement call at the end of a long context.
//
// The stages run cheapest-first and stop at the first failure, because the
// later ones cost minutes and are meaningless if the build is broken.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => {
  const f = args.find((a) => a.startsWith(`--${n}=`));
  return f ? f.split('=').slice(1).join('=') : d;
};
const ids = args.filter((a) => !a.startsWith('--'));
const port = Number(flag('port', 5175));
// --sweep: after the target journey passes, re-check EVERY other journey.
// This is not paranoia. A PBR material change made for one journey silently
// took `voyager` from 0.026 to 0.019 occupancy, because it used the archetype
// and had no light — found days later, by accident. Anything touching
// src/archetypes or src/engine is a change to all five journeys at once.
const sweep = args.includes('--sweep');
// --quick: numeric loop only (build + smoke + frame-check). For the tight
// iterate-on-one-beat cycle, where scroll-check and pages-check cannot have
// changed and cost a minute each.
const quick = args.includes('--quick');

const NODE = process.execPath;
const id = ids[0];
if (!id) {
  console.error('usage: node scripts/journey-gate.mjs <id> [--sweep] [--quick]');
  process.exit(2);
}
if (!existsSync(resolve('src/journeys', id))) {
  console.error(`no such journey: ${id}`);
  process.exit(2);
}

const results = [];
let server = null;

// Declared HERE, not down with the other helpers: `class` is not hoisted the
// way `function` is, and the try/catch below runs during top-level evaluation.
// A class declared after it would be in the temporal dead zone at the moment
// `err instanceof StageFailure` is evaluated, turning every gate failure into a
// ReferenceError. Same trap that already cost this project once, in
// frame-check.mjs, where `const mean` was used before its initialiser.
class StageFailure extends Error {}

try {
  // --- 1. build ------------------------------------------------------------
  // First because the dev server MASKS duplicate-identifier errors as a blank
  // page with no console output, so every later stage would measure a blank
  // page and report it as an empty journey rather than as a broken one.
  await stage('build', () => run(NODE, ['node_modules/vite/bin/vite.js', 'build']));

  // --- 2. smoke ------------------------------------------------------------
  // Axis round-tripping, segment seams, monotonicity, and the vh pacing floor.
  // No browser, so it is seconds, and it catches the class of defect that
  // otherwise only shows up twelve decades into a journey.
  await stage('smoke', () => run(NODE, ['scripts/smoke.mjs', id]));

  // --- 3. the picture ------------------------------------------------------
  // Everything below here needs a server. Start our own if nothing is
  // answering, so this script is runnable unattended by an agent that has not
  // been told to start one.
  server = await ensureServer(port);

  await stage('frame-check', () =>
    run(NODE, ['scripts/frame-check.mjs', id, `--port=${port}`, '--look=32', '--gate=ship']));

  if (!quick) {
    // --- 4. the real scroll path -------------------------------------------
    // Everything above drives window.__u directly, which bypasses scroll
    // entirely. This is the only stage that exercises document scroll → u, the
    // wheel not being eaten by the canvas overlay, ribbon drag-scrubbing, and
    // camera purity.
    await stage('scroll-check', () => run(NODE, ['scripts/scroll-check.mjs', id, String(port)]));

    // --- 5. the deployed URL shape -----------------------------------------
    // Pages resolves paths differently from `vite preview`, which falls back to
    // index.html for any unknown path — so a broken deep link passes there and
    // 404s in production.
    await stage('pages-check', () => run(NODE, ['scripts/pages-check.mjs', 'dist', '/journeys/']));
  }

  // --- 6. regression sweep -------------------------------------------------
  if (sweep) {
    const others = readJourneyIds().filter((x) => x !== id);
    await stage(`sweep (${others.length} other journeys)`, () =>
      run(NODE, ['scripts/frame-check.mjs', ...others, `--port=${port}`, '--gate=ship']));
  }
} catch (err) {
  // A StageFailure is the normal way a gate run ends — it means a stage failed
  // and the rest were skipped deliberately. Anything else is this script being
  // broken, which must not be reported as a journey defect.
  if (!(err instanceof StageFailure)) {
    console.error(`\ngate error (not a journey defect): ${err.message}`);
    if (server) server.kill();
    process.exit(2);
  }
} finally {
  if (server) server.kill();
}

// --- verdict ---------------------------------------------------------------
const failedStages = results.filter((r) => !r.ok);
console.log('\n' + '═'.repeat(64));
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.name.padEnd(34)} ${r.ms}s`);
}
console.log('═'.repeat(64));

if (failedStages.length) {
  console.log(`\nGATE FAIL — ${id}`);
  console.log(`failed: ${failedStages.map((r) => r.name).join(', ')}`);
  console.log('\nThis journey is NOT complete. Do not report it as complete.');
  console.log('Read the stage output above; every failure names the beat and the metric.');
  process.exit(1);
}

console.log(`\nGATE PASS — ${id}`);
console.log(quick
  ? '\nNumeric bar met. Still owed: scroll-check, pages-check, and a blind review.'
  : '\nThe measurable bar is met. Still owed before calling this done: a BLIND'
    + '\nreview — node scripts/shots.mjs ' + id + ' --blind --sheet — read by an'
    + '\nagent that has not seen the design brief. The numbers cannot tell you'
    + '\nwhether the picture shows what the copy claims.');
process.exit(0);

// --- plumbing --------------------------------------------------------------
async function stage(name, fn) {
  const t0 = Date.now();
  process.stdout.write(`\n▶ ${name}\n`);
  const ok = await fn();
  const ms = ((Date.now() - t0) / 1000).toFixed(1);
  results.push({ name, ok, ms });
  if (!ok) {
    // Stop at the first failure: the later stages cost minutes and are
    // meaningless once something upstream is broken.
    throw new StageFailure(name);
  }
}

function run(cmd, argv) {
  return new Promise((res) => {
    const p = spawn(cmd, argv, { stdio: 'inherit', shell: false });
    p.on('close', (code) => res(code === 0));
    p.on('error', () => res(false));
  });
}

// Start a dev server only if nothing is already answering, and only then own
// it. Killing a server the user started would be a rude surprise.
async function ensureServer(p) {
  if (await alive(p)) {
    console.log(`\n(using the dev server already on :${p})`);
    return null;
  }
  console.log(`\n(starting a dev server on :${p})`);
  const proc = spawn(NODE, ['node_modules/vite/bin/vite.js', '--port', String(p)], {
    stdio: 'ignore',
    shell: false,
  });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await alive(p)) return proc;
  }
  proc.kill();
  throw new Error(`dev server did not come up on :${p}`);
}

async function alive(p) {
  try {
    const r = await fetch(`http://localhost:${p}/`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}

function readJourneyIds() {
  return spawnSync(NODE, ['-e', `
    const { readdirSync } = require('node:fs');
    console.log(readdirSync('src/journeys', { withFileTypes: true })
      .filter((d) => d.isDirectory()).map((d) => d.name).join(' '));
  `], { encoding: 'utf8' }).stdout.trim().split(/\s+/).filter(Boolean);
}
