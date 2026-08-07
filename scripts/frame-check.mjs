// Does this journey LOOK like anything?
//
//   node scripts/frame-check.mjs [id …] [--port=5175] [--out=dir] [--json]
//                                [--look=32] [--gate=ship]
//
// The pacing gate taught this project that a defect you can only describe in
// adjectives ("too fast") stays unfixed until someone measures it in the unit
// the reader actually experiences (viewport-heights). This is that same move
// for the OTHER half of rule 9.
//
// `shots.mjs` proves a frame rendered. It cannot tell you the frame is empty,
// or that it is the fourth identical grey limb in a row, or that the only
// legible thing in it is the copy panel — and those are the defects that
// actually make a journey bad. They pass every existing check. A batch of four
// journeys shipped with:
//
//   · 20 of 32 `voyager` beats being the same white sticker on black,
//   · `earth-to-moon` beats 9–12 being one identical grey limb,
//   · most of `crust-to-core` being a full-frame fog with no structure in it.
//
// Every one of those built clean, passed smoke, passed scroll-check, and was
// signed off by an agent that had "looked at" the screenshots.
//
// THE ONE IDEA: measure the frame with the COPY PANEL MASKED OUT. A journey is
// a visual medium; if the picture is only legible because of the caption
// sitting on it, the picture failed. Everything below follows from that.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readdirSync } from 'node:fs';
// The RULER lives in one module so `film-gate.mjs` scores a film's own frames
// with the same numbers the stills were gated on. This file keeps the POLICY:
// which beats to sample, and what the bar is.
import { measure, sigDistance, mean, fmt, GATE, SHIP, MASKS, shipBarFor } from './lib/frame-metrics.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => {
  const f = args.find((a) => a.startsWith(`--${n}=`));
  return f ? f.split('=').slice(1).join('=') : d;
};
const port = Number(flag('port', 5175));
const outDir = resolve(flag('out', 'review-shots/_frame-check'));
const asJson = args.includes('--json');
// `--look` also scores the view ±N° off the authored direction, which is what a
// reader gets by left-dragging. Off by default: it triples capture time.
const lookDeg = args.includes('--look') ? 32 : Number(flag('look', 0));
// `--gate=ship` additionally applies the JOURNEY-level bar below. Without it
// this script only gates per-beat, and per-beat floors are so low that
// `voyager` — 0.026 occupancy, the same white sticker 32 times — very nearly
// cleared them. Per-beat floors catch broken frames; only the journey bar
// catches a journey that is uniformly, consistently not worth scrolling.
const shipGate = flag('gate', '') === 'ship';

const ids = args.filter((a) => !a.startsWith('--'));
const allIds = readdirSync(resolve('src/journeys'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
const targets = ids.length ? ids : allIds;

// The gates and the ship bar are defined in `lib/frame-metrics.mjs`, alongside
// the measurement they grade, so the film gate cannot drift from this one.

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const scratch = await browser.newPage({ viewport: { width: 400, height: 300 } });

const report = [];
let failed = 0;

for (const id of targets) {
  const samples = await samplesFor(id);
  if (!samples) { console.log(`skip ${id} (no axis-def/beats)`); continue; }

  await page.goto(`http://localhost:${port}/${id}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__journey?.journey?.beats?.length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(1200);

  const frames = [];
  for (const { u, label, heading } of samples) {
    await page.evaluate((v) => { window.__u = v; window.__look = { yaw: 0, pitch: 0 }; }, u);
    await page.waitForTimeout(650);
    const buf = await page.screenshot();
    const m = await measure(scratch, buf, { mask: MASKS.journey });

    // The flanks. Readers can left-drag the view ±40°, so the world just
    // outside the authored frame is now reachable — and a composition that is
    // one object floating in void reveals that the moment anyone turns. Scored
    // as the WORSE of the two sides; a beat only passes if both hold up.
    let flank = null;
    if (lookDeg) {
      const sides = [];
      for (const yaw of [-lookDeg, lookDeg]) {
        await page.evaluate((y) => { window.__look = { yaw: y, pitch: 0 }; }, yaw);
        await page.waitForTimeout(420);
        sides.push((await measure(scratch, await page.screenshot(), { mask: MASKS.journey })).occupancy);
      }
      flank = Math.min(...sides);
      await page.evaluate(() => { window.__look = { yaw: 0, pitch: 0 }; });
    }
    frames.push({ label, heading, u, flank, ...m });
  }

  // Adjacent distance, and runs of sameness.
  for (let i = 0; i < frames.length; i++) {
    frames[i].adjacent = i === 0 ? null : sigDistance(frames[i - 1].sig, frames[i].sig);
  }
  let run = 1;
  for (let i = 1; i < frames.length; i++) {
    run = frames[i].adjacent < GATE.adjacent ? run + 1 : 1;
    frames[i].run = run;
  }

  const flags = [];
  for (const f of frames) {
    const bad = [];
    if (f.occupancy < GATE.occupancy) bad.push('EMPTY');
    if (f.contrast < GATE.contrast) bad.push('FLAT');
    if ((f.run ?? 1) >= GATE.runLength) bad.push(`SAME×${f.run}`);
    if (f.flank !== null && f.flank < GATE.occupancy) bad.push('FLANK-EMPTY');
    if (f.clip > GATE.clip) bad.push('CLIPPED');
    f.flags = bad;
    if (bad.length) flags.push(f);
  }

  const worst = [...frames].sort((a, b) => a.occupancy - b.occupancy)[0];
  const summary = {
    id,
    beats: frames.length,
    flagged: flags.length,
    meanOccupancy: mean(frames.map((f) => f.occupancy)),
    meanContrast: mean(frames.map((f) => f.contrast)),
    meanAdjacent: mean(frames.slice(1).map((f) => f.adjacent)),
    meanClip: mean(frames.map((f) => f.clip)),
    emptiest: worst.label,
  };

  // The ship bar. Reported as named shortfalls rather than one boolean,
  // because "which of the four did I miss, and by how much" is the whole
  // content of the next iteration.
  // The journey's own bar, if it declares one. See `shipBarFor` for why a
  // journey is allowed to move its floor and what it owes in return.
  const bar = await shipBarFor(id);
  const shortfalls = [];
  if (summary.meanOccupancy < bar.occupancy)
    shortfalls.push(`occupancy ${fmt(summary.meanOccupancy)} < ${bar.occupancy}`);
  if (summary.meanContrast < bar.contrast)
    shortfalls.push(`contrast ${fmt(summary.meanContrast)} < ${bar.contrast}`);
  if (summary.meanAdjacent < bar.adjacent)
    shortfalls.push(`adjacent ${summary.meanAdjacent.toFixed(1)} < ${bar.adjacent}`);
  const flaggedFrac = flags.length / (frames.length || 1);
  if (flaggedFrac > bar.flaggedFraction)
    shortfalls.push(`flagged ${(flaggedFrac * 100).toFixed(0)}% > ${bar.flaggedFraction * 100}%`);
  summary.shipBar = bar;
  summary.shipShortfalls = shortfalls;
  summary.ship = shortfalls.length === 0;

  report.push({ ...summary, frames });

  if (!asJson) {
    console.log(`\n${id} — ${frames.length} beats`);
    console.log(
      `  occupancy ${fmt(summary.meanOccupancy)}   contrast ${fmt(summary.meanContrast)}` +
      `   adjacent ${summary.meanAdjacent.toFixed(1)}   clip ${fmt(summary.meanClip)}`,
    );
    for (const f of frames) {
      const mark = f.flags.length ? '  ✗' : '   ';
      const adj = f.adjacent === null ? '   —' : f.adjacent.toFixed(1).padStart(5);
      console.log(
        `${mark} ${f.label.padEnd(30)} occ ${fmt(f.occupancy)}  con ${fmt(f.contrast)}  adj ${adj}` +
        (f.flank === null ? '' : `  flank ${fmt(f.flank)}`) +
        (f.flags.length ? `   ${f.flags.join(' ')}` : ''),
      );
    }
    if (flags.length) console.log(`  → ${flags.length}/${frames.length} beats flagged`);
    if (shipGate) {
      // A moved floor is ALWAYS printed, pass or fail. A threshold that a
      // journey quietly lowered and nothing ever mentions again is not a bar,
      // it is a disabled check — and the whole value of this gate is that
      // "done" is an exit code nobody had to be trusted about.
      if (bar.overridden?.length) {
        console.log(`  → ship bar overridden by ${id}/gate.js: ${bar.overridden.join(' · ')}`);
        if (bar.reason) console.log(`     reason: ${bar.reason}`);
      }
      console.log(
        shortfalls.length
          ? `  → SHIP BAR NOT MET: ${shortfalls.join(' · ')}`
          : '  → ship bar met',
      );
    }
  }
  // Without --gate=ship a single flagged beat fails the run, which is the
  // right behaviour for the tight fix-one-beat loop. With it, the journey bar
  // is what decides: a 30-beat journey is allowed its 15% of hard beats, the
  // same slack big-bang takes.
  if (shipGate ? shortfalls.length > 0 : flags.length > 0) failed++;
}

await browser.close();

const path = join(outDir, 'frame-check.json');
writeFileSync(path, JSON.stringify(report, null, 2));

if (asJson) console.log(JSON.stringify(report.map(({ frames, ...s }) => s), null, 2));
else {
  console.log(`\n→ ${path}`);
  const what = shipGate ? 'miss the ship bar' : 'have flagged beats';
  console.log(failed ? `\nFRAME CHECK FAIL — ${failed} journey(s) ${what}` : '\nFRAME CHECK PASS');
}
process.exit(failed ? 1 : 0);

// --- sampling: identical to shots.mjs, mid-beat ----------------------------
async function samplesFor(id) {
  const dir = resolve('src/journeys', id);
  try {
    const { axisDef } = await import(pathToFileURL(join(dir, 'axis-def.js')).href);
    const { beats } = await import(pathToFileURL(join(dir, 'beats.js')).href);
    const { makeAxis } = await import(pathToFileURL(resolve('src/engine/axis.js')).href);
    const A = makeAxis(axisDef);
    const us = beats.map((b) => A.toU(b.at)).sort((a, b) => a - b);
    return us.map((u, i) => ({
      u: Math.min(1, u + ((us[i + 1] ?? 1) - u) * 0.45),
      label: `${String(i + 1).padStart(2, '0')}-${slug(beats[i].heading)}`,
      heading: beats[i].heading,
    }));
  } catch { return null; }
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
}
