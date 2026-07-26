// Generate 16:9 thumbnail candidates for an explainer's long-form upload.
//
//   node scripts/make-thumbnails.mjs <explainer-id> [--port=5174] [--steps=1,4]
//                                    [--labels] [--frac=0.45]
//
// On long-form the thumbnail decides the click, and this repo already renders
// deterministic poses — so cover plates are nearly free. Output is CLEAN
// PLATES (page chrome and CSS2D callouts hidden by default): pick one, add
// your headline text on top. Pass --labels to keep the part callouts in frame.
//
// Captures are deterministic exactly as review-shots.mjs is: activate the step,
// wait for the camera fly-to to settle, then pause the loop and seek it to a
// fixed lap fraction. Same command, same pixels.
//
// Output: renders/<id>/thumbs/NN-stepN.jpg  (1920x1080, q92)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const id = args.find((a) => !a.startsWith('--'));
if (!id) {
  console.error('usage: node scripts/make-thumbnails.mjs <explainer-id> [--port=5174] [--steps=1,4] [--labels] [--frac=0.45]');
  process.exit(1);
}
const port = flags.port ?? '5174';
const frac = Number(flags.frac ?? 0.45);
const outDir = resolve('renders', id, 'thumbs');
mkdirSync(outDir, { recursive: true });

// same settle poll as review-shots: activate()'s fly-to races the section
// IntersectionObserver, so wait for the camera to actually stop moving
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

const browser = await chromium.launch({
  args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
page.on('console', (m) => {
  if (m.type() === 'error') console.error(`[page error] ${m.text()}`);
});

await page.goto(`http://localhost:${port}/#/${id}`);
await page.waitForFunction(() => window.__hiw?.stepRuntimes?.length > 0, null, { timeout: 180000 });
await page.waitForTimeout(2000); // HDRI env map + lazy chunk

await page.addStyleTag({
  content: `
    .player-hero, .steps, .rail, .back-link, .scroll-hint { display: none !important; }
    ${flags.labels ? '' : '.callout { display: none !important; }'}
    body { overflow: hidden; }
  `,
});

const stepCount = await page.evaluate(() => window.__hiw.stepRuntimes.length);
// default: an even spread across the explainer (up to 4 candidates). The hero
// step is always included — it is the finished product shot and usually the
// strongest cover.
const picks = flags.steps
  ? String(flags.steps).split(',').map((s) => parseInt(s, 10) - 1)
  : [...new Set([0, ...[1, 2, 3].map((k) => Math.round((k * (stepCount - 1)) / 3))])];

console.log(`${id}: ${stepCount} steps, thumbnails for [${picks.map((i) => i + 1).join(',')}] -> ${outDir}`);

let n = 0;
for (const i of picks) {
  if (i < 0 || i >= stepCount) {
    console.warn(`  step ${i + 1} out of range, skipping`);
    continue;
  }
  await page.evaluate((k) => {
    document.querySelectorAll('.step')[k]?.scrollIntoView({ block: 'center' });
    window.__hiw.activate(k);
  }, i);
  await page.waitForTimeout(200);
  await waitForCameraSettle(page);
  await page.waitForTimeout(300);

  await page.evaluate(
    ([k, f]) => {
      const rt = window.__hiw.stepRuntimes[k];
      if (rt?.tl) {
        // loop:true timelines report a ~1e12 duration sentinel; iterationDuration
        // is the real lap
        const lap = rt.tl.iterationDuration ?? rt.tl.duration;
        rt.tl.pause();
        rt.tl.seek(lap * f);
      }
    },
    [i, frac],
  );
  await page.waitForTimeout(160);
  // NOTE: no tl.play() resume — replaying a pause+seek()ed looped timeline
  // wedges the anime engine (see review-shots.mjs). This page is closed below.
  const name = `${String(++n).padStart(2, '0')}-step${i + 1}.jpg`;
  await page.screenshot({ path: join(outDir, name), quality: 92, type: 'jpeg' });
  console.log(`  ${name}`);
}

await browser.close();
console.log(`done — ${n} candidates in ${outDir}`);
