// The axis is the whole product. A journey is one monotonic parameter —
// time, distance, or scale — and everything else (camera, world state, copy,
// the ribbon) is a pure function of it.
//
// Two coordinate spaces, always kept distinct:
//   u      normalized progress, 0→1, what scroll maps to and what every
//          journey callback receives
//   value  the real-world quantity at that u (seconds, metres, years)
//
// THREE KINDS.
//
// `linear` and `log` are the simple cases. `log` is the default for anything
// spanning orders of magnitude: Earth's surface to the observable universe is
// 10^0 → 10^27 m, and on a linear axis the first 26 decades occupy less than
// one pixel of scroll.
//
// `segments` exists because a single log is not always enough either. Time
// since the Big Bang runs from 10^-43 s to 10^17.6 s; a uniform log axis gives
// the Planck epoch and the Cambrian explosion identical billing, and crams all
// of human history into the final 0.00001 of the scroll. A segmented axis
// stitches spans together with explicit scroll weights, so pacing becomes
// editorial rather than an accident of the units.
//
// A segment may also be declared in `lookback` space — interpolated
// logarithmically in *time remaining until the pivot* rather than time since
// the start. That is the only way the recent past gets room to breathe: in
// lookback space, 66 million years ago and last Tuesday are nine decades apart.

const KINDS = new Set(['linear', 'log', 'segments']);

export function makeAxis(def) {
  const { kind = 'log', unit = '', label = '', format } = def;
  if (!KINDS.has(kind)) throw new Error(`unknown axis kind: ${kind}`);

  const core = kind === 'segments' ? segmentedAxis(def) : simpleAxis(def);

  return {
    kind,
    unit,
    label,
    ...core,
    toU: (value) => clamp01(core.toURaw(value)),
    format: format
      ? (u) => format(core.toValue(u))
      : (u) => formatValue(core.toValue(u), unit, kind),
  };
}

// --- linear / log --------------------------------------------------------
// `from`/`to` are EXPONENTS for log axes, plain values for linear ones.
function simpleAxis({ kind = 'log', from, to }) {
  if (from === to) throw new Error('axis from/to must differ');
  const span = to - from;
  return {
    from, to, span,
    toValue: kind === 'log'
      ? (u) => 10 ** (from + u * span)
      : (u) => from + u * span,
    // unclamped on purpose — a beat placed outside the range should warn in
    // journey.js rather than silently pile up at 0 or 1
    toURaw: kind === 'log'
      ? (value) => (Math.log10(value) - from) / span
      : (value) => (value - from) / span,
  };
}

// --- segments ------------------------------------------------------------
// segments: [{ from, to, weight, space?: 'log' | 'linear' | 'lookback', pivot? }]
// `from`/`to` are real values here, not exponents. Weights are relative and
// normalized, so they can be written as percentages or as any ratio.
function segmentedAxis({ segments }) {
  if (!segments?.length) throw new Error('segments axis needs a `segments` array');

  const total = segments.reduce((s, seg) => s + (seg.weight ?? 1), 0);
  let acc = 0;
  const segs = segments.map((seg) => {
    const w = (seg.weight ?? 1) / total;
    const s = { ...seg, space: seg.space ?? 'log', u0: acc, u1: acc + w, w };
    acc += w;
    if (s.space === 'lookback') {
      if (!(s.pivot > s.to)) throw new Error('lookback segment needs pivot > to');
      s.L0 = s.pivot - s.from;
      s.L1 = s.pivot - s.to;
      if (!(s.L1 > 0)) throw new Error('lookback segment: `to` must stay short of `pivot`');
    }
    return s;
  });
  segs.at(-1).u1 = 1; // absorb float drift so u=1 lands exactly on the last value

  const at = (u) => segs.find((s) => u <= s.u1) ?? segs.at(-1);

  const localValue = (s, t) => {
    if (s.space === 'linear') return s.from + (s.to - s.from) * t;
    if (s.space === 'lookback') return s.pivot - s.L0 * (s.L1 / s.L0) ** t;
    return s.from * (s.to / s.from) ** t;
  };

  const localT = (s, value) => {
    if (s.space === 'linear') return (value - s.from) / (s.to - s.from);
    if (s.space === 'lookback') {
      return Math.log((s.pivot - value) / s.L0) / Math.log(s.L1 / s.L0);
    }
    return Math.log(value / s.from) / Math.log(s.to / s.from);
  };

  return {
    from: segs[0].from,
    to: segs.at(-1).to,
    segments: segs,
    toValue(u) {
      const s = at(clamp01(u));
      return localValue(s, (clamp01(u) - s.u0) / s.w);
    },
    toURaw(value) {
      const s = segs.find((seg) => value <= seg.to) ?? segs.at(-1);
      return s.u0 + clamp01(localT(s, value)) * s.w;
    },
  };
}

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Default readout. Journeys with a domain-specific unit (years, light years)
// should pass their own `format` — this is the generic fallback.
function formatValue(v, unit, kind) {
  const abs = Math.abs(v);
  if (kind !== 'linear' && (abs >= 1e5 || (abs > 0 && abs < 1e-2))) {
    const exp = Math.floor(Math.log10(abs));
    const mant = v / 10 ** exp;
    const m = Math.abs(mant - 1) < 0.05 ? '' : `${mant.toFixed(1)} × `;
    return `${m}10${superscript(exp)} ${unit}`.trim();
  }
  const rounded = abs >= 100 ? Math.round(v) : Number(v.toPrecision(3));
  return `${rounded.toLocaleString('en-US')} ${unit}`.trim();
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export const superscript = (n) => String(n).split('').map((c) => SUP[c] ?? c).join('');
