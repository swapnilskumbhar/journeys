// Does this journey LOOK like anything?
//
//   node scripts/frame-check.mjs [id …] [--port=5175] [--out=dir] [--json]
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

const ids = args.filter((a) => !a.startsWith('--'));
const allIds = readdirSync(resolve('src/journeys'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
const targets = ids.length ? ids : allIds;

// --- the gates -------------------------------------------------------------
// Calibrated against `big-bang`, which is the journey that works, and against
// the four that did not. These are FLOORS, not targets: a frame can pass every
// one of them and still be dull. Failing one is close to proof it is broken.
const GATE = {
  // Fraction of the un-masked frame that is meaningfully different from the
  // frame's own background level. Below this the picture is a void with a
  // caption on it. `voyager`'s cruise beats score ~0.004.
  occupancy: 0.02,
  // Luminance spread. A single flat wash of colour — the "brown wall" — has
  // almost none. `crust-to-core`'s mantle beats score ~0.02.
  contrast: 0.045,
  // Perceptual distance between ADJACENT beats, 0–100. Consecutive beats that
  // score below this are the same picture twice, whatever the copy says.
  // Four identical grey limbs in `earth-to-moon` score ~1.5.
  adjacent: 6.0,
  // How many consecutive near-identical frames before it is a defect rather
  // than a deliberate hold. Two is a hold; three is a stall.
  runLength: 3,
};

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
    const m = await measure(scratch, buf);

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
        sides.push((await measure(scratch, await page.screenshot())).occupancy);
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
    emptiest: worst.label,
  };
  report.push({ ...summary, frames });

  if (!asJson) {
    console.log(`\n${id} — ${frames.length} beats`);
    console.log(`  occupancy ${fmt(summary.meanOccupancy)}   contrast ${fmt(summary.meanContrast)}   adjacent ${summary.meanAdjacent.toFixed(1)}`);
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
  }
  if (flags.length) failed++;
}

await browser.close();

const path = join(outDir, 'frame-check.json');
writeFileSync(path, JSON.stringify(report, null, 2));

if (asJson) console.log(JSON.stringify(report.map(({ frames, ...s }) => s), null, 2));
else {
  console.log(`\n→ ${path}`);
  console.log(failed ? `\nFRAME CHECK FAIL — ${failed} journey(s) have flagged beats` : '\nFRAME CHECK PASS');
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

// --- measurement -----------------------------------------------------------
// Runs in the page because that is where an image decoder already exists; this
// project has no image dependency and does not need one for this.
async function measure(pg, buf) {
  const b64 = buf.toString('base64');
  return pg.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const W = 192, H = 120;
    const c = new OffscreenCanvas(W, H);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data;

    // THE MASK. Everything the ENGINE draws on top of the world is excluded:
    // the copy panel (lower left), the ribbon (bottom strip), the header
    // (top strip). What is left is the picture the journey actually made.
    const masked = (x, y) => {
      const u = x / W, v = y / H;
      if (v > 0.90) return true;                       // ribbon
      if (v < 0.055) return true;                      // header
      if (u < 0.36 && v > 0.50 && v < 0.90) return true; // copy panel
      return false;
    };

    const lums = [];
    const cells = 16 * 10;
    const sig = new Float64Array(cells * 3);
    const sigN = new Float64Array(cells);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (masked(x, y)) continue;
        const i = (y * W + x) * 4;
        const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
        lums.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
        const cell = Math.floor((y / H) * 10) * 16 + Math.floor((x / W) * 16);
        sig[cell * 3] += r; sig[cell * 3 + 1] += g; sig[cell * 3 + 2] += b;
        sigN[cell]++;
      }
    }
    for (let k = 0; k < cells; k++) {
      const n = sigN[k] || 1;
      sig[k * 3] /= n; sig[k * 3 + 1] /= n; sig[k * 3 + 2] /= n;
    }

    lums.sort((a, b) => a - b);
    const q = (p) => lums[Math.min(lums.length - 1, Math.floor(p * lums.length))];
    const med = q(0.5);
    const m = lums.reduce((a, v) => a + v, 0) / lums.length;
    const sd = Math.sqrt(lums.reduce((a, v) => a + (v - m) ** 2, 0) / lums.length);

    // Occupancy: how much of the picture is NOT its own background. Measured
    // against the median rather than against black, so a bright field on a
    // bright sky counts the same as a bright object on black.
    let occ = 0;
    for (const v of lums) if (Math.abs(v - med) > 0.055) occ++;

    return {
      occupancy: occ / lums.length,
      contrast: sd,
      meanLum: m,
      sig: Array.from(sig),
    };
  }, b64);
}

function sigDistance(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return (s / a.length) * 100;
}

function mean(xs) { return xs.reduce((a, b) => a + b, 0) / (xs.length || 1); }
function fmt(v) { return v.toFixed(3).padStart(6); }
function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
}
