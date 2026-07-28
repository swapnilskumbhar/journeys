// Temporary: verify the REAL user path (document scroll → u), not the __u
// override every other check uses.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:5175/big-bang', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__journey?.journey?.beats?.length > 0, null, { timeout: 20000 });
await page.waitForTimeout(1500);

const geom = await page.evaluate(() => ({
  scrollHeight: document.documentElement.scrollHeight,
  viewport: window.innerHeight,
  range: document.documentElement.scrollHeight - window.innerHeight,
  expectedVh: window.__journey.journey.length,
  uOverride: window.__u,
}));
console.log('geometry:', geom);
console.log(`  scroll range / viewport = ${(geom.range / geom.viewport).toFixed(1)} viewport-heights (journey declares ${geom.expectedVh})`);

for (const frac of [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.97, 1]) {
  const want = await page.evaluate((f) => {
    const range = document.documentElement.scrollHeight - window.innerHeight;
    const y = Math.round(f * range);
    window.scrollTo(0, y);
    return y;
  }, frac);
  // smooth scroll-behavior animates the jump; wait for arrival, then for the
  // player's own damping to settle
  await page.waitForFunction((y) => Math.abs(window.scrollY - y) <= 2, want, { timeout: 15000 });
  await page.waitForTimeout(700);
  const s = await page.evaluate(() => ({
    readout: document.querySelector('.ribbon-value')?.textContent,
    heading: document.querySelector('.beat-panel h2')?.textContent,
    visible: document.querySelector('.beat-panel')?.classList.contains('is-visible'),
    fill: document.querySelector('.ribbon-fill')?.style.width,
    layers: window.__journey?.streamer?.size,
    hero: document.querySelector('.journey-hero')?.style.opacity,
  }));
  console.log(
    `scroll ${String(Math.round(frac * 100)).padStart(3)}%  fill=${(s.fill ?? '').padEnd(7)} ` +
    `${(s.readout ?? '').padEnd(16)} layers=${String(s.layers).padStart(2)} hero=${(s.hero ?? '').padEnd(5)} ` +
    `panel=${s.visible ? 'on ' : 'OFF'} ${s.heading}`,
  );
}

// The wheel must scroll the page, never be captured by the canvas overlay.
// Start from the top — testing this at the bottom of the page proves nothing.
// html { scroll-behavior: smooth } animates scrollTo, so wait for it to settle
// or `before` is sampled mid-flight and the comparison is meaningless.
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForFunction(() => window.scrollY === 0, null, { timeout: 5000 });
await page.waitForTimeout(300);
const before = await page.evaluate(() => window.scrollY);
await page.mouse.move(720, 450);
await page.mouse.wheel(0, 900);
await page.waitForTimeout(400);
const after = await page.evaluate(() => window.scrollY);
console.log(`\nwheel over canvas: scrollY ${before} → ${after}  ${after > before ? 'OK (page scrolled)' : 'FAIL (overlay ate the wheel)'}`);

// Ribbon tick navigation.
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
await page.locator('.ribbon-tick').nth(30).click();
await page.waitForTimeout(1600);
const seeked = await page.evaluate(() => ({
  y: window.scrollY,
  readout: document.querySelector('.ribbon-value')?.textContent,
  heading: document.querySelector('.beat-panel h2')?.textContent,
}));
console.log(`tick 31 click → scrollY=${seeked.y}  ${seeked.readout}  "${seeked.heading}"`);

// --- the camera is a pure function of u ------------------------------------
// The regression this exists for: the bearing used to be `t * 0.035`, so the
// same u rendered a different viewpoint depending on how long the tab had been
// open — the Earth–Moon pair drifted 76° off its framing inside three minutes,
// and review shots of one beat were never twice the same picture. Hold u still,
// run the clock forward, and the camera must not have moved.
const drift = await page.evaluate(async () => {
  const cam = window.__journey.stage.camera;
  const read = () => [cam.position.x, cam.position.y, cam.position.z,
    ...cam.quaternion.toArray()].map((n) => +n.toFixed(6));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  window.__u = 0.5004; // "The Moon" — the beat the defect was found on
  await wait(600);
  const before = read();
  // Take the virtual clock and run three virtual minutes past in ~1s of real
  // time. Under the old bearing this was 180° of orbit.
  window.__vt = true;
  window.__vtDelta = 3;
  await wait(1100);
  window.__vtDelta = 0;
  await wait(200);
  const after = read();

  delete window.__vt;
  delete window.__vtDelta;
  delete window.__u;
  return { before, after, worst: Math.max(...before.map((v, i) => Math.abs(v - after[i]))) };
});
const pure = drift.worst < 1e-5;
if (!pure) errors.push(`camera drifted with the clock at fixed u: ${JSON.stringify(drift)}`);
console.log(
  `\ncamera at fixed u, +180 virtual seconds: max drift ${drift.worst.toExponential(1)}  ` +
  `${pure ? 'OK (pure function of u)' : 'FAIL (viewpoint depends on wall clock)'}`,
);

// --- dragging the ribbon scrubs, and lands where it is let go ---------------
// Easing anywhere in this path shows up as the frame arriving behind the
// pointer and then carrying on after it stops.
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(600);
const box = await page.locator('.ribbon-track').boundingBox();
const xAt = (f) => box.x + box.width * f;
const yMid = box.y + box.height / 2;

await page.mouse.move(xAt(0.2), yMid);
await page.mouse.down();
const dragged = [];
for (const f of [0.2, 0.45, 0.7, 0.62]) {
  await page.mouse.move(xAt(f), yMid, { steps: 4 });
  await page.waitForTimeout(120); // ~7 frames: an eased seek would still be moving
  dragged.push({ f, ...(await page.evaluate(() => ({
    u: window.scrollY / (document.documentElement.scrollHeight - window.innerHeight),
    readout: document.querySelector('.ribbon-value')?.textContent,
    heading: document.querySelector('.beat-panel h2')?.textContent,
  }))) });
}
await page.mouse.up();
await page.waitForTimeout(400);
const settled = await page.evaluate(() => ({
  u: window.scrollY / (document.documentElement.scrollHeight - window.innerHeight),
  heading: document.querySelector('.beat-panel h2')?.textContent,
}));

for (const d of dragged) {
  const err = Math.abs(d.u - d.f);
  if (err > 0.01) errors.push(`drag to ${d.f} settled at u=${d.u.toFixed(4)} (lagging)`);
  console.log(
    `drag → ${d.f.toFixed(2)}  u=${d.u.toFixed(4)} (err ${err.toFixed(4)})  ` +
    `${(d.readout ?? '').padEnd(16)} "${d.heading}"`,
  );
}
// Let go at 0.62; nothing may keep travelling afterwards.
const overshoot = Math.abs(settled.u - 0.62);
if (overshoot > 0.01) errors.push(`released at 0.62 but drifted to ${settled.u.toFixed(4)}`);
console.log(`release → u=${settled.u.toFixed(4)} (drift ${overshoot.toFixed(4)})  "${settled.heading}"`);

await browser.close();
if (errors.length) {
  console.log(`\n${errors.length} console error(s):`);
  for (const e of [...new Set(errors)].slice(0, 8)) console.log('  ' + e);
  process.exit(1);
}
console.log('\nno console errors');
