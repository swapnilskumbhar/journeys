// Shared distance constants and the readout formatter for `voyager`.
// The axis is HELIOCENTRIC RANGE — distance from the Sun, in metres — not
// distance travelled by the spacecraft (Voyager's actual path is not radial;
// it bends hard at every gravity assist). A journey about a single monotonic
// axis needs a monotonic quantity, and heliocentric range is the one that is
// both true of the real mission (JPL quotes Voyager 1/2 position exactly this
// way) and monotonically increasing for the whole post-Saturn cruise, which
// is most of this journey's length.

export const AU = 1.496e11;      // one astronomical unit, m
export const LY = 9.4607e15;     // one light-year, m

export const auTo = (au) => au * AU;

// Real orbital radii, AU, for the four giant planets and Pluto (mean).
export const R_JUPITER_AU = 5.20;
export const R_SATURN_AU = 9.58;
export const R_URANUS_AU = 19.20;
export const R_NEPTUNE_AU = 30.10;
export const R_PLUTO_AU = 39.50;

// Real body radii, m — used to size the planets themselves (never Saturn's
// rings, which are drawn as a `trajectory` ring, not geometry).
export const R_SUN = 6.957e8;
export const R_JUPITER = 6.9911e7;
export const R_SATURN = 5.8232e7;
export const R_URANUS = 2.5362e7;
export const R_NEPTUNE = 2.4622e7;
export const R_PLUTO = 1.1883e6;
export const R_EARTH = 6.371e6;
export const R_MOON = 1.7374e6;

// The floor. Log space cannot reach zero, and launch is genuinely ~1 AU from
// the Sun (Earth's own orbital radius) — so 1 AU is both the mathematically
// necessary floor AND the true starting distance, unlike earth-to-moon/mars
// where the floor is an arbitrary near-zero metres. Nothing to apologise for.
export const D0 = AU;

// Voyager 1's real distance today (per JPL's live tracker, rounded) — the
// anchor beat 28 is built on.
export const VGR1_TODAY_AU = 166;

const sig = (x) => Number(x.toPrecision(3)).toLocaleString('en-US');

// Switches: AU (the unit this whole journey is actually quoted in) up to
// ~5,000 AU, then light-years once the number would otherwise run to five or
// six digits — the same "quote it in the unit it's actually discussed in"
// principle as earth-to-mars' formatDistance.
export function formatDistance(d) {
  const au = d / AU;
  if (au < 100) return `${au < 10 ? au.toFixed(2) : Math.round(au)} AU from the Sun`;
  if (au < 5000) return `${sig(au)} AU from the Sun`;
  const ly = d / LY;
  if (ly < 0.01) return `${sig(au)} AU from the Sun`;
  return `${sig(ly)} light-years from the Sun`;
}
