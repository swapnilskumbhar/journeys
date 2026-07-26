// Small editorial curve helpers. These are pacing tools for THIS journey's
// scale law, camera path and material drives — deliberately not in the engine,
// which should stay ignorant of how any one journey chooses to feel.

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

// Ramp up between a→b, hold, ramp down between c→d. The universal opacity
// envelope: every layer fades in and out rather than popping, because at these
// scale ratios a pop is the most visible artefact there is.
// c/d default to Infinity so `band(x, a, b)` means "fade in, then stay" — a
// layer that runs to the end of the journey must not be handed c=d=1, which
// would evaluate to zero exactly at u=1.
export function band(x, a, b, c = Infinity, d = Infinity) {
  if (x <= a) return 0;
  if (x < b) return smooth((x - a) / (b - a));
  if (x >= d) return 0;
  if (x > c) return smooth((d - x) / (d - c));
  return 1;
}

// Piecewise interpolation over [key, value] pairs.
// `plog` interpolates in log space — correct for anything spanning decades
// (sizes, distances); `plin` for values that are already linear, including
// arrays (camera positions).
//
// Keys may be given ascending OR descending. Descending matters more than it
// sounds: everything in the Earth phase is keyed on years-before-present,
// which counts DOWN toward the present, and forcing those tables to be written
// backwards would make them impossible to check against a reference.
export function plog(keys, x) {
  const [a, b, t] = pick(keys, x);
  if (!(a > 0) || !(b > 0)) return a + (b - a) * smooth(t); // log undefined at 0
  return a * (b / a) ** smooth(t);
}

export function plin(keys, x) {
  const [a, b, t] = pick(keys, x);
  const s = smooth(t);
  return Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * s) : a + (b - a) * s;
}

// Returns [valueBefore, valueAfter, tBetween]. Indexes without allocating —
// these run several times per frame.
function pick(keys, x) {
  const n = keys.length;
  const desc = keys[0][0] > keys[n - 1][0];
  const at = (i) => keys[desc ? n - 1 - i : i];
  if (x <= at(0)[0]) return [at(0)[1], at(0)[1], 0];
  if (x >= at(n - 1)[0]) return [at(n - 1)[1], at(n - 1)[1], 0];
  let i = 0;
  while (i < n - 2 && x > at(i + 1)[0]) i++;
  const A = at(i);
  const B = at(i + 1);
  return [A[1], B[1], (x - A[0]) / (B[0] - A[0])];
}
