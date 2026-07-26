// Capture per-step screenshots of an explainer for visual review.
// The Claude preview tab is compositor-throttled and cannot screenshot;
// this drives a real headless Chromium instead, where rAF runs normally.
//
//   node scripts/review-shots.mjs <explainer-id> [outDir] [port] [flags]
//
// Flags:
//   --steps=2,5   capture ONLY these steps (1-based) — use while iterating on
//                 a fix so one changed step doesn't cost a full re-render
//   --half        640x400 instead of 1280x800 — cheaper to capture AND far
//                 cheaper for an agent to read; full res for final passes
//   --sheet       emit contact-sheet.png (all captures stitched into one
//                 image — a whole-explainer glance is ONE image read). ON BY
//                 DEFAULT for a full-set capture (the cheapest way to review
//                 a whole explainer); pass --no-sheet to skip. A --steps
//                 subset run never sheets unless --sheet is given explicitly.
//
// DETERMINISTIC captures: each step is activated, the camera fly-to allowed
// to settle, then the loop is PAUSED and seeked to fixed fractions of its lap
// (30% for the -a shot, 60% for -b). Same command, same pixels, every run —
// no more "was that a bug or did the capture land mid-camera-flight?" false
// findings, and identical a/b pairs become a RIGOROUS frozen-pose signal
// instead of a probabilistic one.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const pos = args.filter((a) => !a.startsWith('--'));
const id = pos[0];
if (!id) {
  console.error('usage: node scripts/review-shots.mjs <explainer-id> [outDir] [port] [--steps=2,5] [--half] [--sheet]');
  process.exit(1);
}
const outDir = resolve(pos[1] ?? `review-shots/${id}`);
const port = pos[2] ?? '5174';
const onlySteps = flags.steps
  ? String(flags.steps).split(',').map((s) => parseInt(s, 10) - 1)
  : null;
const half = !!flags.half;
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: half ? { width: 640, height: 400 } : { width: 1280, height: 800 },
});
page.on('console', (m) => {
  if (m.type() === 'error') console.error(`[page error] ${m.text()}`);
});

// activate(k)'s camera fly-to (1300ms) races the section-scroll's
// IntersectionObserver, which can re-fire activate() for a stale index AFTER
// our explicit call and restart the tween late — a flat wait intermittently
// samples mid-flight. Poll for the camera position to stop moving instead.
async function waitForCameraSettle(pg, { timeoutMs = 3000, intervalMs = 150 } = {}) {
  let prev = null;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pos = await pg.evaluate(() => window.__hiw.stage.camera.position.toArray());
    if (prev && Math.hypot(pos[0] - prev[0], pos[1] - prev[1], pos[2] - prev[2]) < 0.001) return;
    prev = pos;
    await pg.waitForTimeout(intervalMs);
  }
}

await page.goto(`http://localhost:${port}/#/${id}`);
await page.waitForFunction(() => window.__hiw?.stepRuntimes?.length > 0, null, {
  timeout: 20000,
});
// let the env map and entry animations settle
await page.waitForTimeout(1500);

const steps = await page.evaluate(() => window.__hiw.stepRuntimes.length);
const captureList = onlySteps ?? [...Array(steps).keys()];
console.log(`${id}: ${steps} steps, capturing [${captureList.map((i) => i + 1).join(',')}] -> ${outDir}`);

const files = [];
// hero shot only on full runs (it's the pre-scroll landing frame)
if (!onlySteps) {
  await page.screenshot({ path: `${outDir}/00-hero.png` });
  files.push('00-hero.png');
}

for (const i of captureList) {
  if (i < 0 || i >= steps) {
    console.warn(`  step ${i + 1} out of range, skipping`);
    continue;
  }
  // scroll the section into view (hides the hero overlay, shows the step
  // panel) AND activate explicitly — scrolling alone triggers activation via
  // an observer, but that timing is racy in headless; activate() is
  // idempotent so driving both is deterministic
  await page.evaluate((n) => {
    document.querySelectorAll('.step')[n]?.scrollIntoView({ block: 'center' });
    window.__hiw.activate(n);
  }, i);
  await page.waitForTimeout(200); // let scroll paint before polling starts
  await waitForCameraSettle(page); // camera fly-to settles (race-tolerant)
  await page.waitForTimeout(300); // panel fade settle

  const tag = String(i + 1).padStart(2, '0');
  // seek the loop to fixed lap fractions so captures are reproducible
  for (const [suffix, frac] of [['a', 0.3], ['b', 0.6]]) {
    await page.evaluate(
      ([n, f]) => {
        const rt = window.__hiw.stepRuntimes[n];
        if (rt?.tl) {
          // loop:true timelines report duration as a ~1e12 sentinel; the
          // real lap length is iterationDuration — seek within that
          const lap = rt.tl.iterationDuration ?? rt.tl.duration;
          rt.tl.pause();
          rt.tl.seek(lap * f);
        }
      },
      [i, frac],
    );
    await page.waitForTimeout(160); // one rendered frame at the seeked pose
    await page.screenshot({ path: `${outDir}/${tag}-${suffix}.png` });
    files.push(`${tag}-${suffix}.png`);
  }
  // NOTE: deliberately no tl.play() resume here — playing a pause+seek()ed
  // looped timeline wedges the anime engine (page main thread hangs; found
  // empirically). Each step's activate() plays its own fresh timeline, so
  // nothing needs resuming; this page is closed when captures finish.
  console.log(`  step ${i + 1}/${steps} captured (seeked 30%/60%)`);
}

// contact sheet: stitch captures into one grid image via a throwaway page
// contact sheet: default ON for full-set runs (cheapest whole-explainer
// review), opt-in for --steps subsets, off entirely with --no-sheet
const wantSheet = flags.sheet ?? (!onlySteps && !flags['no-sheet']);
if (wantSheet && files.length) {
  const cells = files
    .map((f) => {
      const b64 = readFileSync(join(outDir, f)).toString('base64');
      return `<div class="c"><img src="data:image/png;base64,${b64}"><span>${f}</span></div>`;
    })
    .join('');
  const html = `<style>
    body{margin:0;background:#111;display:grid;grid-template-columns:repeat(2,1fr);gap:6px;padding:6px}
    .c{position:relative}
    img{width:100%;display:block}
    span{position:absolute;top:4px;left:6px;font:12px monospace;color:#fff;background:#000a;padding:1px 5px;border-radius:3px}
  </style>${cells}`;
  const sheetPage = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  await sheetPage.setContent(html);
  // wait for the data-URL images to decode — fullPage of an unloaded grid
  // computes a degenerate height and CDP refuses the capture
  await sheetPage.evaluate(() => Promise.all([...document.images].map((im) => im.decode())));
  await sheetPage.screenshot({ path: `${outDir}/contact-sheet.png`, fullPage: true });
  await sheetPage.close();
  console.log('  contact-sheet.png written');
}

await browser.close();
console.log('done');
