// Engine + journey math checks that need no browser. These are the modules
// most likely to be wrong in ways that only surface twelve decades into a
// journey, where a visual review would never catch them.
//
//   node scripts/smoke.mjs [id …]
//
// Every registered journey is checked, not just the first one. That
// generalisation is the point: the pacing defect this file exists for
// (a beat that looks fine as a fraction of the axis and is 360 pixels of scroll
// on screen) is not a big-bang defect, it is a defect any journey can have, and
// it was found twice in big-bang alone before anyone thought to gate on it.
// Each journey declares its own per-beat floor in its pacing.js.
import { readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeAxis } from '../src/engine/axis.js';
import { makeRebaser } from '../src/engine/rebase.js';

let failures = 0;
const ok = (cond, name, detail = '') => {
  if (!cond) failures++;
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};
const close = (a, b, rel = 1e-9) => Math.abs(a - b) <= Math.abs(b) * rel;

// --- engine --------------------------------------------------------------
console.log('# log axis (Earth → observable universe)');
const scale = makeAxis({ kind: 'log', from: 0, to: 27, unit: 'm' });
ok(close(scale.toValue(0), 1), 'u=0 → 1 m');
ok(close(scale.toValue(1), 1e27), 'u=1 → 1e27 m');
ok(close(scale.toValue(scale.toU(1.496e11)), 1.496e11, 1e-12), '1 AU round-trips');

console.log('\n# scale rebasing');
const r = makeRebaser();
r.setScale(1.496e11 / 4);
ok(close(r.toWorld(1.496e11), 4), '1 AU frames at 4 world units');
ok(r.visible(1.496e11) && !r.visible(1e21), 'renderable band culls both ends');
ok(close(r.frameMeters(), 1.496e11), 'frameMeters round-trips the scale law');

// --- the registry --------------------------------------------------------
// Same discovery rule as engine/journey.js's glob, done with the filesystem
// because Node has no import.meta.glob: any directory under src/journeys with
// an axis-def.js is a journey and gets checked.
const root = resolve('src/journeys');
const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const ids = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(root, d.name, 'axis-def.js')))
  .map((d) => d.name)
  .filter((id) => wanted.length === 0 || wanted.includes(id))
  .sort();

const load = (id, file) => import(pathToFileURL(join(root, id, file)).href);

// Journey-specific structural claims that are not pacing. Anything that belongs
// to one journey's editorial argument lives here rather than in the generic
// loop, so the loop stays honest about applying to all of them.
const EXTRA = {
  'big-bang': (A) => {
    const YR = 3.15576e7;
    const AGE = 13.797e9 * YR;
    ok(A.toValue(1) > AGE - 2 * YR && A.toValue(1) <= AGE, '  u=1 → today', A.format(1));
    const firstSecond = A.toU(1);
    const sinceKPg = 1 - A.toU(AGE - 66e6 * YR);
    ok(firstSecond > 0.15, '  the first second gets real scroll', `${(firstSecond * 100).toFixed(0)}%`);
    ok(sinceKPg > 0.15, '  the age of mammals gets real scroll', `${(sinceKPg * 100).toFixed(0)}%`);
  },
  'earth-to-moon': (A) => {
    // The two claims the segmented distance axis is FOR. A pure log axis gives
    // the ascent 62% of the page and the lunar arrival about one pixel; if
    // either of these ever fails, the segment weights have drifted back toward
    // the thing they were written to prevent.
    const toOrbit = A.toU(1.855e5);
    const arrival = 1 - A.toU(3.70e8);
    ok(toOrbit > 0.25 && toOrbit < 0.45, '  the ascent gets a third of the page, not two thirds',
      `${(toOrbit * 100).toFixed(0)}%`);
    ok(arrival > 0.25, '  the lunar arrival gets real scroll', `${(arrival * 100).toFixed(0)}%`);
  },
};

for (const id of ids) {
  console.log(`\n\n=== ${id} ===`);
  const { axisDef } = await load(id, 'axis-def.js');
  const { beats } = await load(id, 'beats.js');
  const { length, floorVh = () => 0.15 } = await load(id, 'pacing.js');
  const A = makeAxis(axisDef);

  // --- axis ---------------------------------------------------------------
  console.log('# axis');
  ok(close(A.toValue(0), axisDef.segments?.[0]?.from ?? A.from, 1e-6),
    '  u=0 → the first value', A.format(0));

  // Monotonic: the axis must never go backwards, or scroll would run the
  // journey in reverse across a segment seam.
  let mono = true;
  let prev = -Infinity;
  for (let i = 0; i <= 4000; i++) {
    const v = A.toValue(i / 4000);
    if (v < prev) mono = false;
    prev = v;
  }
  ok(mono, '  value increases monotonically across all seams');

  // Round-trip every segment boundary — the seams are where an off-by-one in
  // the weight accumulation would show up.
  let seams = true;
  for (const s of A.segments ?? []) {
    if (!close(A.toValue(A.toU(s.from)), s.from, 1e-6)) seams = false;
  }
  ok(seams, '  every segment boundary round-trips');

  EXTRA[id]?.(A);

  // --- beat placement -----------------------------------------------------
  console.log('# beat placement');
  const us = beats.map((b) => A.toU(b.at));
  ok(us.every((u, i) => i === 0 || u > us[i - 1]), '  beats are strictly ordered');
  ok(us[0] >= 0 && us.at(-1) <= 1, '  all beats inside the axis range');

  const gaps = us.slice(1).map((u, i) => u - us[i]);
  const minGap = Math.min(...gaps);
  const maxGap = Math.max(...gaps);
  // Legibility, not aesthetics: 0.2% of the axis is roughly a tenth of a screen
  // on any journey this length, about the least a beat can occupy and still be
  // read. 11% is two full screens with no copy, which reads as the page having
  // broken.
  ok(minGap > 0.002, '  no two beats collide', `min gap ${(minGap * 100).toFixed(2)}%`);
  ok(maxGap < 0.11, '  no dead stretch of scroll', `max gap ${(maxGap * 100).toFixed(2)}%`);

  // --- beat pacing, in viewport-heights ------------------------------------
  // The check above is a fraction of the AXIS, and that is what let the real
  // defect through twice: "A star is born" — the entire formation of the solar
  // system — was 0.40vh, about 360 pixels, and passed everything that measured
  // the axis rather than the screen. So gate on what the reader experiences.
  // A beat holds the scroll from its own mark to the next; the last one holds
  // it to the end.
  console.log('# beat pacing (viewport-heights)');
  const vh = us.map((u, i) => ((i === us.length - 1 ? 1 : us[i + 1]) - u) * length);
  let worst = null;
  vh.forEach((n, i) => {
    const floor = floorVh(i + 1);
    if (worst === null || n - floor < worst.slack) worst = { i, n, floor, slack: n - floor };
  });
  ok(worst.slack >= 0,
    `  every beat clears its own floor`,
    `tightest beat ${worst.i + 1} at ${worst.n.toFixed(2)}vh (floor ${worst.floor})`);

  console.log('# beats');
  beats.forEach((b, i) => {
    const flag = vh[i] < floorVh(i + 1) ? ' <<' : '';
    console.log(
      `  ${String(i + 1).padStart(2)}  u=${us[i].toFixed(4)}  ${A.format(us[i]).padEnd(22)}` +
        `${vh[i].toFixed(2).padStart(6)}vh  ${b.heading}${flag}`,
    );
  });
  console.log(`  total ${length}vh · ${beats.length} beats · mean ${(length / beats.length).toFixed(2)}vh`);
}

console.log(`\n${failures === 0 ? 'SMOKE PASS' : `SMOKE FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
