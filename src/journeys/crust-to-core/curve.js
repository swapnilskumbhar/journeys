// Small editorial curve helpers, copied verbatim from earth-to-mars/curve.js —
// deliberately per-journey rather than promoted to the engine (see that
// file's own note). Kept byte-for-byte identical so behaviour is proven.

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

export function band(x, a, b, c = Infinity, d = Infinity) {
  if (x <= a) return 0;
  if (x < b) return smooth((x - a) / (b - a));
  if (x >= d) return 0;
  if (x > c) return smooth((d - x) / (d - c));
  return 1;
}

export function plog(keys, x) {
  const [a, b, t] = pick(keys, x);
  if (!(a > 0) || !(b > 0)) return a + (b - a) * smooth(t);
  return a * (b / a) ** smooth(t);
}

export function plin(keys, x) {
  const [a, b, t] = pick(keys, x);
  const s = smooth(t);
  return Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * s) : a + (b - a) * s;
}

export function mixHex(a, b, t) {
  const s = smooth(clamp01(t));
  const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * s;
  const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * s;
  const bl = (a & 255) + ((b & 255) - (a & 255)) * s;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

export function scaleHex(c, k) {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
  const b = Math.min(255, Math.round((c & 255) * k));
  return (r << 16) | (g << 8) | b;
}

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
