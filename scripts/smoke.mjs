// Engine + journey math checks that need no browser. These are the modules
// most likely to be wrong in ways that only surface twelve decades into a
// journey, where a visual review would never catch them.
//
//   node scripts/smoke.mjs
import { makeAxis } from '../src/engine/axis.js';
import { makeRebaser } from '../src/engine/rebase.js';
import { axisDef } from '../src/journeys/big-bang/axis-def.js';
import { beats } from '../src/journeys/big-bang/beats.js';
import { AGE, YR } from '../src/journeys/big-bang/time.js';

let failures = 0;
const ok = (cond, name, detail = '') => {
  if (!cond) failures++;
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};
const close = (a, b, rel = 1e-9) => Math.abs(a - b) <= Math.abs(b) * rel;

// --- log axis ------------------------------------------------------------
console.log('# log axis (Earth → observable universe)');
const scale = makeAxis({ kind: 'log', from: 0, to: 27, unit: 'm' });
ok(close(scale.toValue(0), 1), 'u=0 → 1 m');
ok(close(scale.toValue(1), 1e27), 'u=1 → 1e27 m');
ok(close(scale.toValue(scale.toU(1.496e11)), 1.496e11, 1e-12), '1 AU round-trips');

// --- rebaser -------------------------------------------------------------
console.log('\n# scale rebasing');
const r = makeRebaser();
r.setScale(1.496e11 / 4);
ok(close(r.toWorld(1.496e11), 4), '1 AU frames at 4 world units');
ok(r.visible(1.496e11) && !r.visible(1e21), 'renderable band culls both ends');
ok(close(r.frameMeters(), 1.496e11), 'frameMeters round-trips the scale law');

// --- segmented axis ------------------------------------------------------
console.log('\n# big-bang segmented axis');
const A = makeAxis(axisDef);
ok(close(A.toValue(0), 1e-44, 1e-6), 'u=0 → the Planck era', A.format(0));
ok(A.toValue(1) > AGE - 2 * YR && A.toValue(1) <= AGE, 'u=1 → today', A.format(1));

// Monotonic: the axis must never go backwards, or scroll would run time in
// reverse across a segment seam.
let mono = true;
let prev = -Infinity;
for (let i = 0; i <= 4000; i++) {
  const v = A.toValue(i / 4000);
  if (v < prev) mono = false;
  prev = v;
}
ok(mono, 'value increases monotonically across all seams');

// Round-trip every segment boundary — the seams are where an off-by-one in the
// weight accumulation would show up.
let seams = true;
for (const s of A.segments) {
  if (!close(A.toValue(A.toU(s.from)), s.from, 1e-6)) seams = false;
}
ok(seams, 'every segment boundary round-trips');

// --- beat placement ------------------------------------------------------
console.log('\n# beat placement');
const us = beats.map((b) => A.toU(b.at));
ok(us.every((u, i) => i === 0 || u > us[i - 1]), 'beats are strictly ordered');
ok(us[0] >= 0 && us.at(-1) <= 1, 'all beats inside the axis range');

const gaps = us.slice(1).map((u, i) => u - us[i]);
const minGap = Math.min(...gaps);
const maxGap = Math.max(...gaps);
// Thresholds are legibility, not aesthetics. The journey is 56 viewport
// heights, so 0.3% of the axis is ~0.17vh of scroll — about the least a beat
// can occupy and still be read. 11% is roughly two full screens with no copy
// on them, which reads as the page having broken.
ok(minGap > 0.003, 'no two beats collide', `min gap ${(minGap * 100).toFixed(2)}%`);
ok(maxGap < 0.11, 'no dead stretch of scroll', `max gap ${(maxGap * 100).toFixed(2)}%`);

// The whole point of the segmented axis: the first second and the last
// 66 million years should each own a real share of the scroll.
const firstSecond = A.toU(1);
const sinceKPg = 1 - A.toU(AGE - 66e6 * YR);
ok(firstSecond > 0.15, 'the first second gets real scroll', `${(firstSecond * 100).toFixed(0)}%`);
ok(sinceKPg > 0.15, 'the age of mammals gets real scroll', `${(sinceKPg * 100).toFixed(0)}%`);

console.log('\n# readout across the journey');
for (const u of [0, 0.1, 0.24, 0.35, 0.5, 0.62, 0.7, 0.8, 0.9, 0.96, 0.99, 1]) {
  console.log(`  u=${u.toFixed(2)}  ${A.format(u)}`);
}

console.log('\n# beats');
beats.forEach((b, i) => {
  console.log(`  ${String(i + 1).padStart(2)}  u=${us[i].toFixed(4)}  ${A.format(us[i]).padEnd(16)} ${b.heading}`);
});

console.log(`\n${failures === 0 ? 'SMOKE PASS' : `SMOKE FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
