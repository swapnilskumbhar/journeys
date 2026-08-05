// Is this film DONE?
//
//   node scripts/film-gate.mjs <id> [--json]
//
// One command, one verdict — the same contract `journey-gate.mjs` holds for a
// journey, and it exists for the same reason. A film has failure modes that
// no still gate can see:
//
//   · a journey can pass frame-check on 22 sampled beats and still be a black
//     screen for thirty continuous seconds of film, because the gate sampled
//     the good instants;
//   · a shot can be perfectly composed and completely STATIC for its whole
//     eight seconds, which is not visible in any single frame;
//   · the voice can drift out of the picture it belongs to;
//   · the mix can be quiet, clipped, or have a score sitting on top of the
//     narration instead of under it.
//
// So this measures the film's OWN frames, with the same ruler
// `frame-check.mjs` uses — imported, not reimplemented, so a film cannot pass
// a bar the journey failed.
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { measure, sigDistance, mean, fmt, MASKS, GATE, SHIP } from './lib/frame-metrics.mjs';
import { filmPaths } from './film/lib/env.mjs';
import { run, duration, loudness, meanVolumeIn, invertWindows } from './film/lib/ffmpeg.mjs';
import { makeCurve } from './film/solve-timeline.mjs';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const asJson = args.includes('--json');
if (!id) {
  console.error('usage: node scripts/film-gate.mjs <id> [--json]');
  process.exit(2);
}

const BAR = {
  // PER-SHOT floors use `GATE`; the JOURNEY-level bar uses `SHIP`. Keeping
  // those straight matters and getting it wrong is not a small error: `SHIP`
  // is a bar on the MEAN of a whole journey, and applying its 0.25 occupancy
  // as a per-shot floor is twelve times stricter than the 0.02 per-beat floor
  // `frame-check.mjs` actually uses. The first version of this file did
  // exactly that and flagged 13 of big-bang's 39 shots — including several the
  // still gate passed without comment — which reads as "the film is broken"
  // when what was broken was the ruler.
  occupancy: GATE.occupancy,
  contrast: GATE.contrast,
  // How much the picture may fail to change across one shot's hold. This is
  // the film-only metric: `adjacent` asks whether two BEATS look different,
  // this asks whether anything moved while a sentence was being spoken. A
  // fully frozen shot scores ~0.
  motion: 1.2,
  // The journey-level means, held to the same bar the stills were held to.
  meanOccupancy: SHIP.occupancy,
  meanContrast: SHIP.contrast,
  // Fraction of shots allowed to fail any picture check. Same 15% slack
  // big-bang takes on stills — a film is allowed its hard beats.
  flaggedFraction: 0.15,
  // Integrated loudness target and tolerance, in LU.
  lufs: -14,
  lufsTolerance: 1.5,
  truePeak: -1.0,
  // The score must be measurably quieter under speech than between it.
  duckDb: 2.0,
  // Picture and sound must agree on how long the film is.
  durationTolerance: 0.15,
};

const paths = filmPaths(id);
const problems = [];
const notes = [];
const report = { id, checks: {} };

// Declared UP HERE, above the first place `finish()` can be called from.
// `finish()` reads these, and a missing-artefact exit calls it before the
// picture stage has run — if they were `const`s further down, that exit would
// hit the temporal dead zone and report a ReferenceError instead of the
// missing file. Same trap that has already cost this repo two scripts
// (frame-check's `const mean`, journey-gate's `class StageFailure`), and the
// failure path of a gate is the one that must never itself be broken.
let shotRows = [];
let meanOcc = 0, meanCon = 0, meanMot = 0;

// --- 1. artefacts ------------------------------------------------------------
for (const [name, p] of [
  ['timeline', paths.timeline], ['master', paths.master],
  ['final', paths.final], ['narration', paths.narration], ['words', paths.words],
]) {
  if (!existsSync(p)) problems.push(`missing ${name}: ${p}`);
}
if (problems.length) finish();

const timeline = JSON.parse(readFileSync(paths.timeline, 'utf8'));
const words = JSON.parse(readFileSync(paths.words, 'utf8'));

// --- 2. the timeline ---------------------------------------------------------
{
  const curve = makeCurve(timeline);
  let prev = -Infinity;
  let worstBack = 0;
  for (let t = 0; t <= timeline.duration; t += 1 / (timeline.fps * 2)) {
    const u = curve(t);
    if (u < prev - 1e-9) worstBack = Math.max(worstBack, prev - u);
    prev = u;
  }
  const u0 = curve(0);
  const u1 = curve(timeline.duration);
  if (worstBack > 1e-6) problems.push(`u(t) goes backwards by up to ${worstBack.toFixed(5)} — the axis is monotonic and so is the film`);
  if (u0 > 0.01) problems.push(`film starts at u=${u0.toFixed(4)}, not at the beginning of the journey`);
  if (u1 < 0.995) problems.push(`film ends at u=${u1.toFixed(4)}, short of the end of the journey`);

  for (const s of timeline.shots) {
    const dur = s.end - s.start;
    if (dur <= s.travel + 0.2) {
      problems.push(`shot ${s.i} (beat ${s.beat}) is ${dur.toFixed(2)}s but spends ${s.travel.toFixed(2)}s travelling — no hold left`);
    }
    // AV sync sentinel: a shot's own spoken line must begin inside its own
    // screen time. If this fails, every caption after it is on the wrong shot.
    if (!s.silent && (s.contentStart < s.start - 0.05 || s.contentStart >= s.end)) {
      problems.push(`shot ${s.i}: its line starts at ${s.contentStart.toFixed(2)}s, outside its window [${s.start.toFixed(2)}, ${s.end.toFixed(2)}]`);
    }
  }
  report.checks.timeline = { u0: +u0.toFixed(4), u1: +u1.toFixed(4), shots: timeline.shots.length, backtrack: worstBack };
}

// --- 3. the picture ----------------------------------------------------------
// Two samples per shot, both inside the dwell: one just after the transit
// settles, one just before the shot ends. The pair answers both questions —
// is there anything there, and did any of it move.
const gateFrames = join(paths.root, 'gate-frames');
rmSync(gateFrames, { recursive: true, force: true });
mkdirSync(gateFrames, { recursive: true });

const samples = [];
for (const s of timeline.shots) {
  const a = Math.min(s.end - 0.15, s.start + s.travel + 0.25);
  const b = Math.max(a + 0.3, s.end - 0.3);
  samples.push({ shot: s.i, beat: s.beat, when: 'a', t: a });
  samples.push({ shot: s.i, beat: s.beat, when: 'b', t: b });
}

for (const [k, smp] of samples.entries()) {
  smp.file = join(gateFrames, `${String(k).padStart(4, '0')}.jpg`);
  // -ss BEFORE -i is the fast seek; at these durations the keyframe rounding
  // is well under the 0.3s the two samples are separated by.
  run(['-ss', smp.t.toFixed(3), '-i', paths.master, '-frames:v', '1', '-q:v', '3', smp.file], 'gate frame');
}

const browser = await chromium.launch();
const scratch = await browser.newPage({ viewport: { width: 400, height: 300 } });
const mask = timeline.chrome === 'none' ? MASKS.none : timeline.chrome === 'full' ? MASKS.journey : MASKS.film;
for (const smp of samples) {
  Object.assign(smp, await measure(scratch, readFileSync(smp.file), { mime: 'image/jpeg', mask }));
}
await browser.close();

const byShot = new Map();
for (const smp of samples) {
  if (!byShot.has(smp.shot)) byShot.set(smp.shot, {});
  byShot.get(smp.shot)[smp.when] = smp;
}

for (const s of timeline.shots) {
  const { a, b } = byShot.get(s.i);
  const row = {
    shot: s.i, beat: s.beat, heading: s.heading,
    occupancy: (a.occupancy + b.occupancy) / 2,
    contrast: (a.contrast + b.contrast) / 2,
    motion: sigDistance(a.sig, b.sig),
    flags: [],
  };
  if (row.occupancy < BAR.occupancy) row.flags.push('EMPTY');
  if (row.contrast < BAR.contrast) row.flags.push('FLAT');
  if (row.motion < BAR.motion) row.flags.push('STATIC');
  shotRows.push(row);
}

const flagged = shotRows.filter((r) => r.flags.length);
meanOcc = mean(shotRows.map((r) => r.occupancy));
meanCon = mean(shotRows.map((r) => r.contrast));
meanMot = mean(shotRows.map((r) => r.motion));
report.checks.picture = { meanOccupancy: meanOcc, meanContrast: meanCon, meanMotion: meanMot, flagged: flagged.length, shots: shotRows.length };

if (meanOcc < BAR.meanOccupancy) problems.push(`picture: mean occupancy ${fmt(meanOcc)} < ${BAR.meanOccupancy}`);
if (meanCon < BAR.meanContrast) problems.push(`picture: mean contrast ${fmt(meanCon)} < ${BAR.meanContrast}`);
const flagFrac = flagged.length / (shotRows.length || 1);
if (flagFrac > BAR.flaggedFraction) {
  problems.push(`picture: ${flagged.length}/${shotRows.length} shots flagged (${(flagFrac * 100).toFixed(0)}% > ${BAR.flaggedFraction * 100}%)`);
}
rmSync(gateFrames, { recursive: true, force: true });

// --- 4. sound ----------------------------------------------------------------
{
  const vidDur = duration(paths.master);
  const finDur = duration(paths.final);
  report.checks.duration = { timeline: timeline.duration, master: vidDur, final: finDur };
  if (Math.abs(vidDur - timeline.duration) > BAR.durationTolerance) {
    problems.push(`master is ${vidDur.toFixed(2)}s but the timeline says ${timeline.duration.toFixed(2)}s`);
  }
  if (Math.abs(finDur - vidDur) > BAR.durationTolerance) {
    problems.push(`final is ${finDur.toFixed(2)}s but the master is ${vidDur.toFixed(2)}s — the mix changed the picture's length`);
  }

  // A dry run's audio is deliberate silence, and silence measures as NaN LUFS
  // and a 0 dB duck. Reporting that as a broken mix would train whoever reads
  // this gate to ignore its audio section, which is worse than not checking.
  // The picture, the timeline and the captions are all still real, so those
  // stages below run either way.
  if (timeline.dryRun) {
    notes.push('audio NOT checked — dry run, the tracks are silence by design');
  } else {
    const loud = loudness(paths.final);
    report.checks.loudness = loud;
    if (!loud) notes.push('loudness could not be measured');
    else {
      if (Math.abs(loud.integrated - BAR.lufs) > BAR.lufsTolerance) {
        problems.push(`loudness ${loud.integrated.toFixed(1)} LUFS, target ${BAR.lufs} ±${BAR.lufsTolerance}`);
      }
      if (loud.truePeak > BAR.truePeak) problems.push(`true peak ${loud.truePeak.toFixed(1)} dBTP > ${BAR.truePeak}`);
    }

    // Did the score actually duck? Measured on the ducked score ALONE, never
    // on the final mix: during speech the voice dominates the mix, so the mix
    // gets LOUDER exactly where the music got quieter, and measuring there
    // would report a working duck as a broken one.
    const ducked = join(paths.audio, 'score-ducked.mp3');
    if (existsSync(ducked)) {
      const speech = timeline.shots.filter((s) => !s.silent).map((s) => [s.contentStart, Math.min(s.end, timeline.duration)]);
      const gaps = invertWindows(speech, timeline.duration);
      const under = meanVolumeIn(ducked, speech);
      const between = meanVolumeIn(ducked, gaps);
      report.checks.duck = { under, between, delta: under != null && between != null ? +(between - under).toFixed(2) : null };
      if (under != null && between != null) {
        const delta = between - under;
        if (delta < BAR.duckDb) {
          problems.push(`score is only ${delta.toFixed(1)} dB quieter under speech (want ≥ ${BAR.duckDb}) — the voice is fighting the music`);
        }
      } else notes.push('duck could not be measured (no gaps between lines?)');
    } else notes.push('no ducked-score probe — score disabled?');
  }
}

// --- 5. captions -------------------------------------------------------------
if (existsSync(paths.ass)) {
  const lines = readFileSync(paths.ass, 'utf8').split('\n').filter((l) => l.startsWith('Dialogue:'));
  const parse = (t) => { const [h, m, s] = t.split(':'); return +h * 3600 + +m * 60 + +s; };
  const caps = lines.map((l) => {
    const p = l.slice('Dialogue: '.length).split(',');
    return { start: parse(p[1]), end: parse(p[2]), style: p[3], text: p.slice(9).join(',') };
  });
  const over = caps.filter((c) => c.end > timeline.duration + 0.05);
  if (over.length) problems.push(`${over.length} caption(s) run past the end of the film`);

  const capOnly = caps.filter((c) => c.style === 'Cap').sort((a, b) => a.start - b.start);
  let overlaps = 0;
  for (let i = 1; i < capOnly.length; i++) if (capOnly[i].start < capOnly[i - 1].end - 0.01) overlaps++;
  if (overlaps) problems.push(`${overlaps} overlapping caption pair(s) — two lines stacking on one anchor`);

  // Every spoken word must appear somewhere in the burned text. This is what
  // catches a segment-mapping bug: the audio says one thing, the screen
  // another, and nothing else in this gate would notice.
  const burned = capOnly.map((c) => c.text.replace(/\{[^}]*\}/g, '')).join(' ').toLowerCase();
  const missing = words.filter((w) => !burned.includes(w.t.toLowerCase())).length;
  report.checks.captions = { cues: capOnly.length, words: words.length, missing, overlaps };
  if (missing > words.length * 0.02) {
    problems.push(`${missing}/${words.length} spoken words never appear in the captions`);
  }
} else notes.push('no captions file');

finish();

// -----------------------------------------------------------------------------
function finish() {
  report.problems = problems;
  report.notes = notes;
  report.pass = problems.length === 0;
  if (existsSync(paths.root)) writeFileSync(paths.report, JSON.stringify(report, null, 2));

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(problems.length ? 1 : 0);
  }

  if (report.checks.picture) {
    console.log(`\n${id} — ${shotRows.length} shots`);
    console.log(`  occupancy ${fmt(meanOcc)}   contrast ${fmt(meanCon)}   motion ${meanMot.toFixed(1)}`);
    for (const r of shotRows) {
      console.log(
        `${r.flags.length ? '  ✗' : '   '} ${String(r.shot).padStart(2)} ${String(r.heading ?? '').slice(0, 30).padEnd(31)}` +
        ` occ ${fmt(r.occupancy)}  con ${fmt(r.contrast)}  mot ${r.motion.toFixed(1).padStart(5)}` +
        (r.flags.length ? `   ${r.flags.join(' ')}` : ''),
      );
    }
  }
  if (report.checks.loudness) {
    const l = report.checks.loudness;
    console.log(`\n  loudness ${l.integrated?.toFixed(1)} LUFS · peak ${l.truePeak?.toFixed(1)} dBTP` +
      (report.checks.duck?.delta != null ? ` · duck ${report.checks.duck.delta} dB` : ''));
  }
  for (const n of notes) console.log(`  note: ${n}`);

  console.log('\n' + '═'.repeat(64));
  if (problems.length) {
    console.log(`FILM GATE FAIL — ${id}\n`);
    for (const p of problems) console.log(`  ✗ ${p}`);
    console.log('\nThis film is NOT done. Do not report it as done.');
    process.exit(1);
  }
  console.log(`FILM GATE PASS — ${id}`);
  process.exit(0);
}
