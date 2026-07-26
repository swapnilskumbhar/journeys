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

await browser.close();
if (errors.length) {
  console.log(`\n${errors.length} console error(s):`);
  for (const e of [...new Set(errors)].slice(0, 8)) console.log('  ' + e);
  process.exit(1);
}
console.log('\nno console errors');
