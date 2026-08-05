// Make the film. One journey in, one finished video out.
//
//   node scripts/film.mjs <id> [--dry-run] [--rewrite] [--from=<stage>]
//                              [--fps=24] [--port=5175] [--chrome=ribbon|none|full]
//                              [--score=plan|prompt] [--no-score] [--no-sfx]
//                              [--karaoke] [--keep-frames]
//
// Stages run in order and stop at the first failure, cheapest first, because
// the render costs ~15 minutes and is meaningless if the script is broken.
//
// --dry-run makes ZERO paid API calls: stub narration at a measured speaking
// rate, silent score, 6 fps at 320x180. Every code path downstream of the
// generators still executes, so the render, the mix and the gate are all
// debuggable for free. Prove a change there before spending money on it.
//
// A journey must already pass `journey-gate.mjs`. Filming a journey that
// cannot pass its own still gate produces a bad film very slowly, and the
// preflight refuses rather than letting that happen.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { filmPaths, ensureDirs, requireKeys, FFMPEG } from './film/lib/env.mjs';
import { Ledger } from './film/lib/ledger.mjs';
import { beatMarks, solve } from './film/solve-timeline.mjs';
import { writeScript } from './film/write-script.mjs';
import { makeVoice } from './film/make-voice.mjs';
import { makeScore } from './film/make-score.mjs';
import { makeSfx } from './film/make-sfx.mjs';
import { renderFrames } from './film/render-frames.mjs';
import { encodeMaster, buildCaptions, burnCaptions, mixAudio, renderDuckedScore } from './film/assemble.mjs';

// Declared HERE, above the try that catches it: `class` is not hoisted the way
// `function` is, so a class declared below would be in the temporal dead zone
// at the moment `err instanceof StageFailure` is evaluated — turning every
// failure into a ReferenceError. This project has paid for that twice already
// (frame-check.mjs, journey-gate.mjs). In a script whose job is reporting
// failure honestly, the failure path is the one that must not be broken.
class StageFailure extends Error {}
// Same rule, same reason: `let` is not hoisted either, and `stage()` reads
// this on its very first call from inside the try below.
let skipNote = null;

const args = process.argv.slice(2);
const flag = (n, d) => {
  const f = args.find((a) => a.startsWith(`--${n}=`));
  return f ? f.split('=').slice(1).join('=') : d;
};
const id = args.find((a) => !a.startsWith('--'));
if (!id) {
  console.error('usage: node scripts/film.mjs <id> [--dry-run] [--rewrite] [--from=<stage>]');
  process.exit(2);
}
if (!existsSync(resolve('src/journeys', id))) {
  console.error(`no such journey: ${id}`);
  process.exit(2);
}

const dryRun = args.includes('--dry-run');
const rewrite = args.includes('--rewrite');
const port = Number(flag('port', 5175));
const fps = Number(flag('fps', dryRun ? 6 : 24));
const chrome = flag('chrome', 'ribbon');
const scoreMode = flag('score', 'plan');
const wantScore = !args.includes('--no-score');
const wantSfx = !args.includes('--no-sfx');
const karaoke = args.includes('--karaoke');
const keepFrames = args.includes('--keep-frames');
const width = Number(flag('width', dryRun ? 320 : 1920));
const height = Number(flag('height', dryRun ? 180 : 1080));
// Resume from a stage, for iterating on the back half without re-rendering.
const STAGES = ['script', 'voice', 'timeline', 'audio', 'render', 'assemble', 'gate'];
const from = flag('from', 'script');
if (!STAGES.includes(from)) {
  console.error(`--from must be one of: ${STAGES.join(', ')}`);
  process.exit(2);
}
const fromIdx = STAGES.indexOf(from);
const doStage = (name) => STAGES.indexOf(name) >= fromIdx;

const NODE = process.execPath;
const paths = filmPaths(id);
ensureDirs(paths);

const results = [];
let server = null;
let timeline = null;
// Every paid call is recorded here. Units are measured, money is derived —
// see lib/ledger.mjs for why the two are kept apart.
const ledger = new Ledger();
const budget = flag('max-usd', null) === null ? null : Number(flag('max-usd', null));

try {
  if (!dryRun) requireKeys(['openai', 'eleven']);

  // --- 0. preflight ---------------------------------------------------------
  await stage('preflight', async () => {
    if (!existsSync(FFMPEG)) throw new Error('ffmpeg-static binary missing — npm install');
    // The journey's own gate, quick mode. A film cannot be better than the
    // journey it is made of, and finding that out after a 15-minute render is
    // the expensive way to find it out.
    if (dryRun) return true;
    // Two minutes, and it re-runs on every retry of a later stage. Skippable
    // ONLY because nothing in the film layer can change the journey's own
    // numbers — if you have touched src/, do not pass this.
    if (args.includes('--skip-preflight')) return skip('skipped by flag');
    const ok = await run(NODE, ['scripts/journey-gate.mjs', id, '--quick', `--port=${port}`]);
    if (!ok) throw new Error(`${id} does not pass its own gate — fix the journey before filming it`);
    return true;
  });

  // --- 1. the script --------------------------------------------------------
  await stage('script', async () => {
    if (!doStage('script')) return skip('resumed past');
    if (existsSync(paths.film) && !rewrite) {
      console.log(`  film.js exists — keeping it (pass --rewrite to regenerate)`);
      return true;
    }
    if (dryRun) {
      writeFileSync(paths.film, stubFilm(await beatMarks(id)));
      console.log(`  DRY RUN — stub film.js from the beat copy`);
      return true;
    }
    // The director needs to SEE. Capture one unoccluded frame per beat first.
    server = await ensureServer(port);
    const ok = await run(NODE, ['scripts/shots.mjs', id, paths.blind, String(port), '--blind']);
    if (!ok) throw new Error('blind capture failed');
    await writeScript({ id, blindDir: paths.blind, out: paths.film, ledger, log: (m) => console.log(`  ${m}`) });
    return true;
  });

  const film = await loadFilm();

  // --- 2. the voice ---------------------------------------------------------
  await stage('voice', async () => {
    if (!doStage('voice') && existsSync(paths.timings)) return skip('resumed past');
    checkBudget('voice');
    await makeVoice({ film, paths, dryRun, ledger, log: (m) => console.log(`  ${m}`) });
    return true;
  });

  // --- 3. solve the timeline ------------------------------------------------
  await stage('timeline', async () => {
    const timings = JSON.parse(readFileSync(paths.timings, 'utf8'));
    const marks = await beatMarks(id);
    timeline = solve({ id, marks, film, timings, fps, chrome, width, height, dryRun });
    writeFileSync(paths.timeline, JSON.stringify(timeline, null, 2));
    const mins = Math.floor(timeline.duration / 60);
    console.log(
      `  ${timeline.shots.length} shots · ${mins}m${String(Math.round(timeline.duration % 60)).padStart(2, '0')}s · ` +
      `${timeline.frames} frames @ ${fps}fps · ${timeline.acts.length} acts`,
    );
    const silent = timeline.shots.filter((s) => s.silent).length;
    if (silent) console.log(`  ${silent} wordless shot(s), narration cut into ${timeline.segments.length} segments`);
    return true;
  });

  // --- 4. score and sfx -----------------------------------------------------
  let sfxCues = [];
  await stage('audio', async () => {
    if (!doStage('audio') && existsSync(paths.score)) {
      sfxCues = await makeSfx({ timeline, paths, dryRun: true, log: () => {} });
      return skip('resumed past');
    }
    checkBudget('score and sfx');
    if (wantScore) await makeScore({ timeline, film, paths, mode: scoreMode, dryRun, ledger, log: (m) => console.log(`  ${m}`) });
    else console.log('  score: skipped (--no-score)');
    if (wantSfx) sfxCues = await makeSfx({ timeline, paths, dryRun, ledger, log: (m) => console.log(`  ${m}`) });
    else console.log('  sfx: skipped (--no-sfx)');
    return true;
  });

  // --- 5. render ------------------------------------------------------------
  await stage(`render (${timeline.frames} frames)`, async () => {
    if (!doStage('render') && existsSync(paths.master)) return skip('resumed past');
    server = server ?? await ensureServer(port);
    const { errors } = await renderFrames(timeline, {
      port,
      outDir: paths.frames,
      onProgress: ({ frame, total, etaSeconds }) => {
        if (frame % (fps * 10) === 0 || frame === total) {
          process.stdout.write(`  ${frame}/${total} frames · ETA ${fmtDur(etaSeconds)}\n`);
        }
      },
    });
    if (errors.length) {
      console.log(`  ${errors.length} page error(s):`);
      for (const e of errors.slice(0, 5)) console.log(`    ${e}`);
      throw new Error('the page threw while rendering — the film would be wrong');
    }
    return true;
  });

  // --- 6. assemble ----------------------------------------------------------
  await stage('assemble', async () => {
    if (doStage('render') || !existsSync(paths.master)) {
      encodeMaster(paths.frames, paths.master, fps);
      console.log(`  master: ${rel(paths.master)}`);
    }
    const words = JSON.parse(readFileSync(paths.words, 'utf8'));
    const { ass, cues } = buildCaptions(timeline, words, { karaoke });
    writeFileSync(paths.ass, ass);
    burnCaptions(paths.master, paths.ass, paths.captioned, paths.root);
    console.log(`  captioned: ${rel(paths.captioned)} (${cues.length} cues)`);

    const score = wantScore && existsSync(paths.score) ? paths.score : null;
    mixAudio({
      videoIn: paths.captioned, out: paths.final, timeline,
      narration: paths.narration, score, sfxCues,
      log: (m) => console.log(`  ${m}`),
    });
    if (score) renderDuckedScore({ out: join(paths.audio, 'score-ducked.mp3'), timeline, narration: paths.narration, score });
    console.log(`  final: ${rel(paths.final)}`);
    if (!keepFrames) rmSync(paths.frames, { recursive: true, force: true });
    return true;
  });

  // --- 7. the verdict -------------------------------------------------------
  await stage('film-gate', () => run(NODE, ['scripts/film-gate.mjs', id]));
} catch (err) {
  if (!(err instanceof StageFailure)) {
    console.error(`\npipeline error (not a film defect): ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    if (server) server.kill();
    process.exit(2);
  }
} finally {
  if (server) server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log('\n' + '═'.repeat(64));
for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.name.padEnd(34)} ${r.ms}s${r.note ? `  (${r.note})` : ''}`);
console.log('═'.repeat(64));

// The ledger prints whether the run passed or failed — a run that died at the
// render stage has still paid for its director and its voice, and hiding that
// on failure is how a pipeline quietly becomes expensive.
if (ledger.entries.length) {
  console.log('\nSPEND');
  console.log(ledger.table());
  writeFileSync(join(paths.root, 'cost.json'), JSON.stringify(ledger.toJSON(), null, 2));
  console.log(`\n  → ${rel(join(paths.root, 'cost.json'))}`);
}

if (failed.length) {
  console.log(`\nFILM FAIL — ${id}`);
  console.log(`failed: ${failed.map((r) => r.name).join(', ')}`);
  console.log('\nThis film is NOT done. Do not report it as done.');
  process.exit(1);
}
console.log(`\nFILM PASS — ${id}${dryRun ? '  (DRY RUN — no real audio, stub script)' : ''}`);
console.log(`\n  ${rel(paths.final)}`);
if (!dryRun) {
  console.log('\nStill owed before calling this done: a BLIND review of the master —');
  console.log(`  node scripts/film-shots.mjs ${id}`);
  console.log('read by an agent that has not seen the script. The numbers cannot tell');
  console.log('you whether the words match the pictures.');
}
process.exit(0);

// --- plumbing ---------------------------------------------------------------
function skip(note) { skipNote = note; return true; }

/**
 * Checked at the top of each paid stage. The budget cannot be enforced per
 * call — nothing knows what the next one will cost until it returns — but it
 * can stop the run before the NEXT expensive thing, which is what a runaway
 * actually looks like.
 */
function checkBudget(stageName) {
  if (ledger.wouldExceed(budget)) {
    throw new Error(
      `budget: $${ledger.totalUsd.toFixed(4)} spent, limit $${budget} — stopping before ${stageName}`,
    );
  }
}

async function stage(name, fn) {
  const t0 = Date.now();
  skipNote = null;
  process.stdout.write(`\n▶ ${name}\n`);
  let ok = false;
  try {
    ok = await fn();
  } catch (err) {
    console.error(`  ${err.message}`);
    ok = false;
  }
  results.push({ name, ok, ms: ((Date.now() - t0) / 1000).toFixed(1), note: skipNote });
  if (!ok) throw new StageFailure(name);
}

function run(cmd, argv) {
  return new Promise((res) => {
    const p = spawn(cmd, argv, { stdio: 'inherit', shell: false });
    p.on('close', (code) => res(code === 0));
    p.on('error', () => res(false));
  });
}

async function loadFilm() {
  if (!existsSync(paths.film)) throw new Error(`${rel(paths.film)} missing — run without --from to write it`);
  // Cache-bust: this module may have just been rewritten in this same process,
  // and Node's ESM loader caches by URL. Without the query the run that
  // regenerates film.js would import the version from before it was written.
  return (await import(`${pathToFileURL(paths.film).href}?t=${Date.now()}`)).default;
}

async function ensureServer(p) {
  if (server) return server;
  if (await alive(p)) { console.log(`  (using the dev server already on :${p})`); return null; }
  console.log(`  (starting a dev server on :${p})`);
  const proc = spawn(NODE, ['node_modules/vite/bin/vite.js', '--port', String(p)], { stdio: 'ignore', shell: false });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await alive(p)) return proc;
  }
  proc.kill();
  throw new Error(`dev server did not come up on :${p}`);
}

async function alive(p) {
  try { return (await fetch(`http://localhost:${p}/`, { signal: AbortSignal.timeout(1500) })).ok; }
  catch { return false; }
}

/**
 * A dry run needs a film.js without paying a director. The beat's own copy,
 * first sentence only, is a decent stand-in: it is real prose of roughly the
 * right length, so the solved pacing is representative rather than uniform.
 */
function stubFilm(marks) {
  const shots = marks.map((m) => {
    const line = (m.body ?? m.heading).split(/(?<=[.!?])\s/)[0].slice(0, 220);
    return `  { beat: ${m.index}, narration: ${JSON.stringify(line)}, travel: 1.8 },`;
  }).join('\n');
  return `// DRY RUN stub — generated by scripts/film.mjs --dry-run.
// Not a script. Overwritten by the real director on the next non-dry run.
export default {
  title: ${JSON.stringify(marks[0]?.heading?.toUpperCase().slice(0, 20) ?? 'JOURNEY')},
  endCard: 'A journey\\njourneys',
  score: { prompt: 'slow cinematic ambient underscore, instrumental', acts: [] },
  shots: [
${shots}
  ],
};
`;
}

function rel(p) { return p.replace(resolve('.') + '\\', '').replace(/\\/g, '/'); }
function fmtDur(s) {
  if (!isFinite(s)) return '?';
  const m = Math.floor(s / 60);
  return m ? `${m}m${String(Math.round(s % 60)).padStart(2, '0')}s` : `${Math.round(s)}s`;
}
