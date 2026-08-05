// Temporary: verify the REAL user path (document scroll → u), not the __u
// override every other check uses.
//
//   node scripts/scroll-check.mjs [id] [port]
//
// The id and port are arguments rather than constants because there is more
// than one journey now, and the defect this catches (an unreachable final beat,
// off-by-one ribbon navigation, a wheel eaten by the canvas overlay) is a
// per-journey defect — it depends on the journey's length and beat count.
import { chromium } from 'playwright';

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const ID = args[0] ?? 'big-bang';
const PORT = Number(args[1] ?? 5175);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`http://localhost:${PORT}/${ID}`, { waitUntil: 'networkidle' });
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
const tickIndex = Math.min(30, (await page.locator('.ribbon-tick').count()) - 2);
await page.locator('.ribbon-tick').nth(tickIndex).click();
await page.waitForTimeout(1600);
const seeked = await page.evaluate(() => ({
  y: window.scrollY,
  readout: document.querySelector('.ribbon-value')?.textContent,
  heading: document.querySelector('.beat-panel h2')?.textContent,
}));
console.log(`tick ${tickIndex + 1} click → scrollY=${seeked.y}  ${seeked.readout}  "${seeked.heading}"`);

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
// The track's own bounding box is measured FRESH before every drag step, not
// once up front. `.ribbon-readout` is `min-width: 12rem` but otherwise sized
// to its content (`white-space: nowrap`, no max-width), and `.ribbon-track`
// is `flex: 1` beside it — so a journey whose readout STRING LENGTH varies a
// lot across the axis (crust-to-core's `formatDepth` grows from "6.96 km
// down" to "2,895 km down · 45.4% to centre") visibly narrows the track as
// the reader scrubs into longer-format territory. A single box captured
// before the whole sequence goes stale the moment that happens, and every
// `xAt(f)` computed from it targets the wrong live pixel — which is exactly
// what produced a reproducible ~3% "drag lag" on crust-to-core and nothing on
// journeys whose readout format stays a roughly constant width. That is a
// real (if cosmetic) UX wrinkle in whichever journey has the growing label —
// worth fixing there — but it is not a drag-handling defect: `ribbon.js`'s
// own `uAtPointer` already re-reads `getBoundingClientRect()` on every single
// pointermove, so a real user's pointer never actually decouples from the
// track under their finger. This harness needs the same discipline.
const trackBox = () => page.locator('.ribbon-track').boundingBox();
const yMidOf = (box) => box.y + box.height / 2;

let box0 = await trackBox();
await page.mouse.move(box0.x + box0.width * 0.2, yMidOf(box0));
await page.mouse.down();
const dragged = [];
for (const f of [0.2, 0.45, 0.7, 0.62]) {
  const box = await trackBox();
  const xAt = (frac) => box.x + box.width * frac;
  await page.mouse.move(xAt(f), yMidOf(box), { steps: 4 });
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

// --- look-around ------------------------------------------------------------
// Left-drag on the canvas turns the view. Three things have to hold at once,
// and they pull against each other: the direction must actually change, the
// PAGE must not move (the drag is a look, not a scrub — and the canvas is a
// fixed full-viewport element sitting under the wheel, rule 5), and the frame
// must come back to the authored direction on release so the next beat is
// composed as it was written.
// SETTLE THE SCROLL FIRST. This test compares the camera quaternion before the
// drag with the one after release, and that difference is only the LOOK if `u`
// is the same at both moments. It is not: the preceding ribbon-tick click
// starts a smooth scroll of tens of thousands of pixels, and `html` carries
// `scroll-behavior: smooth`, so the page is still travelling a second later.
// Measured on `voyager`, whose tick 21 is 50,000 px down the page: 700 ms after
// the click scrollY was 41,765 and still moving, and the camera quaternion
// drifted 4.3e-1 over the next second purely from the axis advancing — while
// the look itself returned to exactly 0.0 once the page had stopped.
//
// So this reported "view did not return to the authored direction" for a
// journey whose view returns perfectly, and passed or failed depending on how
// the timing fell. Same defect class as the stale bounding box this file's own
// drag test used to cache (see CLAUDE.md): rule out the test's timing before
// suspecting player.js. Waiting for two consecutive identical scroll positions
// makes the check measure the thing it names.
await page.waitForFunction(() => {
  const y = window.scrollY;
  if (window.__settleY === y) return true;
  window.__settleY = y;
  return false;
}, null, { timeout: 8000, polling: 250 });

const lookBefore = await page.evaluate(() => {
  const c = window.__journey.stage.camera;
  return { x: c.quaternion.x, y: c.quaternion.y, z: c.quaternion.z, w: c.quaternion.w, scrollY: window.scrollY };
});

const cx = Math.round(page.viewportSize().width / 2);
const cy = Math.round(page.viewportSize().height * 0.35); // clear of panel and ribbon
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx + 260, cy - 90, { steps: 8 });
await page.waitForTimeout(120);

const lookDuring = await page.evaluate(() => {
  const c = window.__journey.stage.camera;
  return {
    q: { x: c.quaternion.x, y: c.quaternion.y, z: c.quaternion.z, w: c.quaternion.w },
    look: { ...window.__journey.look },
    scrollY: window.scrollY,
  };
});
await page.mouse.up();

// WAIT FOR THE EASE TO FINISH, rather than assuming a fixed 900 ms covers it.
// The return is `dv/dt = -(returnRate·v + returnFloor)`, which from the ±40°
// yaw clamp this drag always hits needs about 580 ms of RENDERED time — so a
// 900 ms wall-clock wait leaves only ~300 ms of slack for render latency, and
// the heaviest journey in the repo spends it. `voyager` reported 5.4e-2
// "did not return" with a view that reaches exactly 0.0 a few frames later,
// and passed or failed on how the timing fell.
//
// Polling for the actual condition is both stricter and honest: a view that
// genuinely never returns still fails, because the loop times out and the
// quaternion comparison below runs on a view that is still turned.
await page.waitForFunction(
  () => window.__journey.look.yaw === 0 && window.__journey.look.pitch === 0,
  null,
  { timeout: 3000, polling: 50 },
).catch(() => {});
await page.waitForTimeout(80); // one more frame, so the camera has been rebuilt

const lookAfter = await page.evaluate(() => {
  const c = window.__journey.stage.camera;
  return { q: { x: c.quaternion.x, y: c.quaternion.y, z: c.quaternion.z, w: c.quaternion.w }, look: { ...window.__journey.look } };
});

const qd = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) + Math.abs(a.w - b.w);
const turned = qd(lookBefore, lookDuring.q);
const returned = qd(lookBefore, lookAfter.q);

if (turned < 1e-3) errors.push(`left-drag did not turn the view (quaternion delta ${turned.toExponential(1)})`);
if (lookDuring.scrollY !== lookBefore.scrollY) {
  errors.push(`left-drag scrolled the page (${lookBefore.scrollY} → ${lookDuring.scrollY}) — it must look, not scrub`);
}
if (returned > 1e-3) errors.push(`view did not return to the authored direction after release (delta ${returned.toExponential(1)})`);
console.log(
  `\nlook drag → yaw ${lookDuring.look.yaw.toFixed(1)}° pitch ${lookDuring.look.pitch.toFixed(1)}°  ` +
  `turn ${turned.toFixed(4)}  ·  after release ${returned.toExponential(1)}  ·  page ${lookBefore.scrollY === lookDuring.scrollY ? 'still' : 'MOVED'}`,
);

// And it must stay out of deterministic mode entirely: with __u set, a drag is
// ignored, or every review shot and exported frame becomes gesture-dependent.
await page.evaluate(() => { window.__u = 0.5; });
await page.waitForTimeout(200);
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx + 300, cy - 120, { steps: 6 });
await page.waitForTimeout(150);
const det = await page.evaluate(() => ({ ...window.__journey.look }));
await page.mouse.up();
await page.evaluate(() => { delete window.__u; });
if (det.yaw !== 0 || det.pitch !== 0) {
  errors.push(`drag moved the camera while __u was set (yaw ${det.yaw}, pitch ${det.pitch}) — review shots would not be reproducible`);
}
console.log(`deterministic mode: drag ignored (yaw ${det.yaw}, pitch ${det.pitch})`);

await browser.close();
if (errors.length) {
  console.log(`\n${errors.length} console error(s):`);
  for (const e of [...new Set(errors)].slice(0, 8)) console.log('  ' + e);
  process.exit(1);
}
console.log('\nno console errors');
