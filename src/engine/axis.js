// The axis is the whole product. A journey is one monotonic parameter —
// time, distance, or scale — and everything else (camera, world state, copy,
// the ribbon) is a pure function of it.
//
// Two coordinate spaces, always kept distinct:
//   u      normalized progress, 0→1, what scroll maps to and what every
//          journey callback receives
//   value  the real-world quantity at that u (seconds, metres, years BP)
//
// Log axes are the default for anything spanning orders of magnitude. Earth's
// surface to the observable universe is 10^0 → 10^27 m; on a linear axis the
// first 26 decades occupy less than one pixel of scroll. `from`/`to` are
// EXPONENTS for log axes, plain values for linear ones.

const KINDS = new Set(['linear', 'log']);

export function makeAxis({ kind = 'log', from, to, unit = '', label = '' }) {
  if (!KINDS.has(kind)) throw new Error(`unknown axis kind: ${kind}`);
  if (from === to) throw new Error('axis from/to must differ');

  const span = to - from;

  // u → real-world value
  const toValue = kind === 'log'
    ? (u) => 10 ** (from + u * span)
    : (u) => from + u * span;

  // real-world value → u (inverse; used to place beats by real quantity)
  const toU = kind === 'log'
    ? (value) => (Math.log10(value) - from) / span
    : (value) => (value - from) / span;

  return {
    kind, from, to, span, unit, label,
    toValue,
    toU: (value) => clamp01(toU(value)),
    // unclamped — beats slightly outside the range should fail loudly in dev
    // rather than silently pile up at 0 or 1
    toURaw: toU,
    format: (u) => formatValue(toValue(u), unit, kind),
  };
}

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Readable magnitude for the ribbon HUD. Log axes get scientific notation past
// ~1e5 because "4,240,000,000,000,000 m" communicates nothing; linear axes stay
// grouped because they're usually years or seconds a reader can hold onto.
function formatValue(v, unit, kind) {
  const abs = Math.abs(v);
  if (kind === 'log' && (abs >= 1e5 || (abs > 0 && abs < 1e-2))) {
    const exp = Math.floor(Math.log10(abs));
    const mant = v / 10 ** exp;
    const m = Math.abs(mant - 1) < 0.05 ? '' : `${mant.toFixed(1)} × `;
    return `${m}10${superscript(exp)} ${unit}`.trim();
  }
  const rounded = abs >= 100 ? Math.round(v) : Number(v.toPrecision(3));
  return `${rounded.toLocaleString('en-US')} ${unit}`.trim();
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const superscript = (n) => String(n).split('').map((c) => SUP[c] ?? c).join('');
