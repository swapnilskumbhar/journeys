// Capture a journey at chosen points along its axis.
//
//   node scripts/shots.mjs big-bang [outDir] [port] [--at=0.1,0.5] [--beats] [--sheet]
//
// The only reliable way to SEE a journey: the IDE preview tab is compositor
// throttled and screenshots there time out. Captures are deterministic because
// the player reads `window.__u` when it is defined and ignores scroll — the
// same hook the video exporter uses, so what this shows is what renders.
//
// Default sample set is every beat, which is the review unit that matters:
// a beat whose copy does not match what is on screen is the defect this
// catches.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}`));
const id = args.find((a) => !a.startsWith('--')) ?? 'big-bang';
const positional = args.filter((a) => !a.startsWith('--'));
const outDir = resolve(positional[1] ?? `review-shots/${id}`);
const port = Number(positional[2] ?? 5175);

mkdirSync(outDir, { recursive: true });

// Sample points: --at=... wins, otherwise one shot per beat, taken slightly
// PAST each beat so the panel has swapped and its layers have faded in.
let samples;
const atFlag = flag('at');
if (atFlag) {
  samples = atFlag.split('=')[1].split(',').map(Number).map((u) => ({ u, label: u.toFixed(4) }));
} else {
  const dir = resolve('src/journeys', id);
  const { axisDef } = await import(pathToFileURL(join(dir, 'axis-def.js')).href);
  const { beats } = await import(pathToFileURL(join(dir, 'beats.js')).href);
  const { makeAxis } = await import(pathToFileURL(resolve('src/engine/axis.js')).href);
  const A = makeAxis(axisDef);
  const us = beats.map((b) => A.toU(b.at)).sort((a, b) => a - b);
  samples = us.map((u, i) => {
    const next = us[i + 1] ?? 1;
    return {
      u: Math.min(1, u + (next - u) * 0.45), // mid-beat, where the copy is settled
      label: `${String(i + 1).padStart(2, '0')}-${slug(beats[i].heading)}`,
    };
  });
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const url = `http://localhost:${port}/${id}`;
await page.goto(url, { waitUntil: 'networkidle' });

// The player publishes __journey once mounted; without this the first capture
// races the lazy chunk and comes back as an empty canvas.
await page.waitForFunction(() => window.__journey?.journey?.beats?.length > 0, null, { timeout: 20000 });
await page.waitForTimeout(1200); // fonts, entrance transition, first layers

const index = [];
for (const { u, label } of samples) {
  await page.evaluate((v) => { window.__u = v; }, u);
  // Layers mount on the next sync; give the fades and the ambient clock a
  // moment, then hold one more frame so the composited result is what lands.
  await page.waitForTimeout(700);

  const state = await page.evaluate(() => ({
    u: window.__u,
    readout: document.querySelector('.ribbon-value')?.textContent ?? '',
    heading: document.querySelector('.beat-panel h2')?.textContent ?? '',
    layers: window.__journey?.streamer?.size ?? 0,
    scale: window.__journey?.rebase?.metersPerUnit ?? 0,
  }));

  const file = join(outDir, `${label}.png`);
  await page.screenshot({ path: file });
  index.push({ ...state, label, file });
  console.log(
    `${label.padEnd(28)} u=${u.toFixed(4)}  ${state.readout.padEnd(16)} ` +
    `layers=${String(state.layers).padStart(2)}  ${state.heading}`,
  );
}

writeFileSync(join(outDir, 'index.json'), JSON.stringify(index, null, 2));

if (flag('sheet')) {
  const sheet = await browser.newPage({ viewport: { width: 1320, height: 1000 } });
  // Embedded as data URIs, not file:// — a page created with setContent has an
  // opaque origin and silently refuses to load local files, which produces a
  // sheet of broken-image icons that still screenshots "successfully".
  const tiles = index.map((r) => {
    const b64 = readFileSync(r.file).toString('base64');
    return `<figure style="margin:0">
      <img src="data:image/png;base64,${b64}" style="width:100%;display:block;border-radius:3px">
      <figcaption style="padding:3px 2px 6px">${r.label} · ${r.readout}</figcaption>
    </figure>`;
  });
  await sheet.setContent(`
    <body style="margin:0;background:#08090d;font:10px system-ui;color:#8a94a6">
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:5px">
    ${tiles.join('')}
    </div></body>`);
  await sheet.waitForTimeout(2000);
  await sheet.screenshot({ path: join(outDir, 'contact-sheet.png'), fullPage: true });
  console.log(`\ncontact sheet → ${join(outDir, 'contact-sheet.png')}`);
}

await browser.close();

if (errors.length) {
  console.log(`\n${errors.length} console error(s):`);
  for (const e of [...new Set(errors)].slice(0, 10)) console.log(`  ${e}`);
  process.exit(1);
}
console.log(`\n${index.length} shots → ${outDir}`);

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
}
