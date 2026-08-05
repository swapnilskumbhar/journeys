import { auTo, D0, formatDistance } from './distance.js';
import { PLAN, END_AU } from './plan.js';

// THE AXIS. Heliocentric range — distance from the Sun, in metres — 1 AU at
// launch to Proxima Centauri's distance at the far end. Monotonic by
// construction: Voyager 1 and 2's real heliocentric range never decreases
// after launch, even though their actual flight path bends hard at every
// gravity assist (see distance.js for why range, not path length, is the
// right quantity here — the inverse of earth-to-mars' choice, and for the
// same underlying reason: pick the quantity that is both true and monotonic).
//
// THREE SEGMENTS PER BEAT, not one. The first build used one segment per beat
// with the boundary on the beat's own mark, which is enough to control PACING
// and not enough to control COMPOSITION: `shots.mjs` and `frame-check.mjs`
// both sample 45% of the way from a beat's mark to the next beat's mark, and
// with one segment that lands wherever the arithmetic happens to put it —
// which for the Golden Record beat was 4,600 AU, thirty times past the
// spacecraft, and for the Pale Blue Dot beat was 67 AU, well past the
// photograph.
//
// So every beat declares in plan.js where its own midpoint has to land, and
// this file splits the beat there:
//
//   [mark  → star]   weight 0.45w    the approach
//   [star  → hold]   weight 0.30w    the composition holds; the sample is here
//   [hold  → next]   weight 0.25w    the move to the next beat
//
// 0.45 of the beat's total weight sits before `star`, so the 45% sample lands
// exactly on it whatever the beat's own weight is — and re-weighting a beat
// for pacing cannot move any beat's midpoint off its subject. That is the
// encounter/departure split CLAUDE.md records for the K–Pg fireball, made
// structural instead of hand-tuned per beat.
//
// `space` is log almost everywhere — this axis spans 5.5 decades — and linear
// inside the encounter clusters, where consecutive marks sit within a few
// hundred-thousandths of an AU of each other and linear makes the intended
// near-equal spacing explicit rather than relying on a log curve to look flat
// over a span of 1.00002.
const END = auTo(END_AU);

const LINEAR_RATIO = 1.001;

function segments() {
  const out = [];
  const push = (fromAU, toAU, weight) => {
    if (!(toAU > fromAU)) throw new Error(`voyager axis: non-increasing segment ${fromAU} → ${toAU}`);
    out.push({
      from: auTo(fromAU),
      to: auTo(toAU),
      space: toAU / fromAU < LINEAR_RATIO ? 'linear' : 'log',
      weight,
    });
  };
  PLAN.forEach(([, at, star, hold, w], i) => {
    const next = i + 1 < PLAN.length ? PLAN[i + 1][1] : END_AU;
    push(at, star, w * 0.45);
    push(star, hold, w * 0.30);
    push(hold, next, w * 0.25);
  });
  return out;
}

export const axisDef = {
  kind: 'segments',
  unit: 'm',
  label: '',
  format: formatDistance,
  segments: segments(),
};

// Sanity that costs nothing and would have caught a real defect: the axis must
// start exactly at the declared floor.
if (Math.abs(axisDef.segments[0].from - D0) > 1) {
  throw new Error('voyager axis: first segment does not start at 1 AU');
}
if (Math.abs(axisDef.segments.at(-1).to - END) > 1) {
  throw new Error('voyager axis: last segment does not end at the declared end');
}
