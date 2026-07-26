// Shared time constants and the readout formatter.
//
// The axis value is ALWAYS seconds since the Big Bang — one monotonic
// quantity, as rule 1 of the engine requires. Everything reader-facing
// (years ago, Gyr, "today") is a presentation concern handled here.

export const YR = 3.15576e7; // Julian year, seconds
export const AGE = 13.797e9 * YR; // Planck 2018 age of the universe ≈ 4.354e17 s

// Time since the Big Bang for something that happened `years` ago.
export const ago = (years) => AGE - years * YR;
// ...and for something that happened `years` after it.
export const after = (years) => years * YR;

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (n) => String(n).split('').map((c) => SUP[c] ?? c).join('');
const sig = (x) => (x >= 100 ? Math.round(x).toLocaleString('en-US') : Number(x.toPrecision(3)).toLocaleString('en-US'));

// Two modes, switching where the story does. Before the Sun forms, what matters
// is how long the universe has existed, so the readout counts up from zero.
// After it, human intuition works in "ago", and 13.797 vs 13.796 billion years
// would tell the reader nothing — so it counts down to now.
export function formatTime(t) {
  const remaining = AGE - t;

  if (remaining < 4.7e9 * YR) {
    const yrs = remaining / YR;
    if (yrs < 5) return 'today';
    if (yrs < 1e3) return `${sig(yrs)} yr ago`;
    if (yrs < 1e6) return `${sig(yrs / 1e3)} kyr ago`;
    if (yrs < 1e9) return `${sig(yrs / 1e6)} Myr ago`;
    return `${sig(yrs / 1e9)} Gyr ago`;
  }

  if (t < 1e-2) {
    let exp = Math.floor(Math.log10(t));
    let mant = t / 10 ** exp;
    // Math.log10(1e-12) can land a hair below -12, which floors to -13 and
    // renders the exact power of ten as "10.0×10⁻¹³". Renormalise.
    if (mant >= 9.995) { mant /= 10; exp += 1; }
    const m = Math.abs(mant - 1) < 0.02 ? '' : `${mant.toFixed(1)}×`;
    return `t = ${m}10${sup(exp)} s`;
  }
  if (t < 90) return `t = ${sig(t)} s`;
  if (t < 5400) return `t = ${sig(t / 60)} min`;
  if (t < 1.7e5) return `t = ${sig(t / 3600)} h`;
  if (t < YR) return `t = ${sig(t / 86400)} days`;

  // Thresholds carry a hair of slack: `after(1e9)` round-trips through the
  // axis a whisker under 1e9 years, which would otherwise print "1,000 Myr".
  const yrs = t / YR;
  if (yrs < 999.5) return `t = ${sig(yrs)} yr`;
  if (yrs < 999.5e3) return `t = ${sig(yrs / 1e3)} kyr`;
  if (yrs < 999.5e6) return `t = ${sig(yrs / 1e6)} Myr`;
  return `t = ${sig(yrs / 1e9)} Gyr`;
}
