// Shared motion math for explainer pose functions. Every model.js used to
// re-implement these locally (three times over in this repo before they were
// consolidated) — import them instead so there is ONE tested implementation.
export const TAU = Math.PI * 2;

export const clamp01 = (t) => Math.min(1, Math.max(0, t));

// smoothstep 0→1
export const smooth = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

// smoothstep window: 0 before a, 1 after b, eased between
export const win = (u, a, b) => smooth((u - a) / (b - a));

// Numerically integrated speed profile → angle lookup, scaled so one lap
// advances EXACTLY `laps` whole turns — the seamless-loop contract for any
// mechanism whose speed varies across the lap (spin-ups, synchro drags,
// stop-and-go choreography). `rateFn(u)` gives relative speed at lap fraction
// u∈[0,1]; returns { at(u) → radians, k } where k is the scale factor
// (rad per lap-unit at rate 1), useful for deriving coupled constant rates.
export function profileTable(rateFn, laps, N = 1024) {
  const cum = new Float64Array(N + 1);
  let acc = 0;
  for (let i = 0; i < N; i++) {
    acc += ((rateFn(i / N) + rateFn((i + 1) / N)) / 2) * (1 / N);
    cum[i + 1] = acc;
  }
  const k = (laps * TAU) / acc;
  const at = (u) => {
    const x = clamp01(u) * N;
    const i = Math.min(N - 1, Math.floor(x));
    return (cum[i] + (cum[i + 1] - cum[i]) * (x - i)) * k;
  };
  return { at, k };
}
