// Engine + journey math checks that need no browser. These are the modules
// most likely to be wrong in ways that only surface twelve decades into a
// journey, where a visual review would never catch them.
//
//   node scripts/smoke.mjs
import { makeAxis } from '../src/engine/axis.js';
import { makeRebaser } from '../src/engine/rebase.js';
import { axisDef } from '../src/journeys/big-bang/axis-def.js';
import { beats } from '../src/journeys/big-bang/beats.js';
import { length } from '../src/journeys/big-bang/pacing.js';
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
// Thresholds are legibility, not aesthetics. The journey is 62 viewport
// heights, so 0.2% of the axis is ~0.12vh (~110 px) of scroll — about the
// least a beat can occupy and still be read. The floor came down from 0.3%
// for the wheel: on a log-lookback axis the wheel (6.5 kya) and writing
// (5.2 kya) sit 0.21% apart, and both belong in the story at their honest
// dates. 11% is roughly two full screens with no copy, which reads as the
// page having broken.
ok(minGap > 0.002, 'no two beats collide', `min gap ${(minGap * 100).toFixed(2)}%`);
ok(maxGap < 0.11, 'no dead stretch of scroll', `max gap ${(maxGap * 100).toFixed(2)}%`);

// --- beat pacing, in viewport-heights ------------------------------------
// The check above is a fraction of the AXIS, and that is what let the real
// defect through: segment weights were tuned when the life era was nine static
// globes needing no time, and were never revisited once those beats carried
// scenes. "A star is born" — the entire formation of the solar system, with a
// six-decade zoom inside it — was 0.40vh, about 360 pixels. It passed every
// check here, because as a fraction of the axis it looked ordinary.
//
// So gate on what the reader actually experiences: how many screens of scroll
// each beat occupies. A beat holds the scroll from its own mark to the next
// one; the last one holds it to the end.
console.log('\n# beat pacing (viewport-heights)');
const spans = us.map((u, i) => (i === us.length - 1 ? 1 : us[i + 1]) - u);
const vh = spans.map((s) => s * length);

// Beats 19–30 (Our galaxy → the K–Pg impact) each stage a scene that has to be
// looked at, so they get a real floor. 1.5vh is about four seconds of ordinary
// scrolling — enough to read the copy and still watch something happen.
const SCENE_FROM = 19;
const SCENE_TO = 30;
const SCENE_FLOOR = 1.5;
// The human era, 31–39, gets its own floor. It used to be lumped in with
// "everywhere else" on the argument that the wheel and writing are honestly
// 1,300 years apart and nothing can be done about it — which was wrong twice
// over. The dates constrain where a beat SITS, not how much scroll it is given:
// a segment boundary at each beat's own mark buys any weighting you like
// without moving a single date. And the consequence of not doing it was that
// every one of these beats was built, looked at, and found to be showing
// nothing — at 0.13vh "The wheel" was 120 pixels of scroll, which no amount of
// work on what it draws could have survived.
const HUMAN_FROM = 31;
const HUMAN_FLOOR = 1.2;
// Everywhere else the floor is only "did not vanish".
const FLOOR = 0.15;

const scene = vh.slice(SCENE_FROM - 1, SCENE_TO);
const human = vh.slice(HUMAN_FROM - 1);
const tightScene = Math.min(...scene);
const tightHuman = Math.min(...human);
const tightest = Math.min(...vh);
ok(
  tightScene >= SCENE_FLOOR,
  `every scene beat (${SCENE_FROM}–${SCENE_TO}) gets ${SCENE_FLOOR}vh of scroll`,
  `tightest ${tightScene.toFixed(2)}vh at beat ${vh.indexOf(tightScene) + 1}`,
);
ok(
  tightHuman >= HUMAN_FLOOR,
  `every human-era beat (${HUMAN_FROM}+) gets ${HUMAN_FLOOR}vh of scroll`,
  `tightest ${tightHuman.toFixed(2)}vh at beat ${vh.indexOf(tightHuman) + 1}`,
);
ok(
  tightest >= FLOOR,
  `no beat anywhere drops under ${FLOOR}vh`,
  `tightest ${tightest.toFixed(2)}vh at beat ${vh.indexOf(tightest) + 1}`,
);

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
  const n = vh[i];
  const flag = n < (i + 1 >= SCENE_FROM && i + 1 <= SCENE_TO ? SCENE_FLOOR : FLOOR) ? ' <<' : '';
  console.log(
    `  ${String(i + 1).padStart(2)}  u=${us[i].toFixed(4)}  ${A.format(us[i]).padEnd(16)}` +
      `${n.toFixed(2).padStart(6)}vh  ${b.heading}${flag}`,
  );
});
console.log(`\n  total ${length}vh · scene beats ${SCENE_FROM}–${SCENE_TO}` +
  ` sum ${scene.reduce((a, b) => a + b, 0).toFixed(1)}vh`);

console.log(`\n${failures === 0 ? 'SMOKE PASS' : `SMOKE FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
