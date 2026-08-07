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

// Real orbital radii, AU, for the four giant planets, Mars and Pluto (mean).
export const R_MARS_AU = 1.524;
export const R_JUPITER_AU = 5.20;
export const R_SATURN_AU = 9.58;
export const R_URANUS_AU = 19.20;
export const R_NEPTUNE_AU = 30.10;
export const R_PLUTO_AU = 39.50;

// Real body radii, m.
export const R_SUN = 6.957e8;
export const R_MARS = 3.3895e6;
export const R_JUPITER = 6.9911e7;
export const R_SATURN = 5.8232e7;
export const R_URANUS = 2.5362e7;
export const R_NEPTUNE = 2.4622e7;
export const R_PLUTO = 1.1883e6;
export const R_EARTH = 6.371e6;
export const R_MOON = 1.7374e6;

// The four moons this journey actually stops at, with the radius of their own
// orbit about their planet. A moon's position relative to the SPACECRAFT is
// not expressible on this axis — heliocentric range cannot tell Io from
// Jupiter, they differ by 0.003 AU while the whole encounter lasts hours — so
// every moon encounter is staged as an authored flyby geometry (see
// layers.js). What stays true is the moon's own size and the ANGULAR SIZE of
// its planet seen from it, both computed from these numbers.
export const R_IO = 1.8216e6;
export const R_EUROPA = 1.5608e6;
export const R_TITAN = 2.5747e6;
export const R_TRITON = 1.3534e6;
export const D_IO = 4.217e8;       // Io's orbital radius about Jupiter
export const D_EUROPA = 6.711e8;
export const D_TITAN = 1.2219e9;
export const D_TRITON = 3.548e8;

// Saturn's ring system, real radii in metres. The Cassini division between the
// B and A rings is the one gap a reader can name, so it is drawn as an actual
// gap between two separate particle annuli rather than as a painted line.
export const RING_C_IN = 7.400e7;
export const RING_B_IN = 9.200e7;
export const RING_B_OUT = 1.1758e8;
export const RING_A_IN = 1.2217e8;
export const RING_A_OUT = 1.3673e8;
export const RING_F = 1.4040e8;
// Uranus' epsilon ring — the bright outer one, and the one that makes the
// 98° axial tilt readable in a single frame because it runs vertically.
export const RING_EPSILON = 5.110e7;

// The floor. Log space cannot reach zero, and launch is genuinely ~1 AU from
// the Sun (Earth's own orbital radius) — so 1 AU is both the mathematically
// necessary floor AND the true starting distance, unlike earth-to-moon/mars
// where the floor is an arbitrary near-zero metres. Nothing to apologise for.
export const D0 = AU;

// Distance from Earth, expressed on the axis. The first two beats happen
// within a few tens of thousands of kilometres of Earth, which is 1e-4 AU —
// so they are written in metres-from-Earth and converted, never in AU, where
// the interesting digits fall off the end of the number.
export const fromEarth = (m) => (AU + m) / AU;

// Voyager 1's real distance today (per JPL's live tracker, rounded).
export const VGR1_TODAY_AU = 166;

const sig = (x) => Number(x.toPrecision(3)).toLocaleString('en-US');

// Switches: AU (the unit this whole journey is actually quoted in) up to
// ~5,000 AU, then light-years once the number would otherwise run to five or
// six digits — the same "quote it in the unit it's actually discussed in"
// principle as earth-to-mars' formatDistance.
export function formatDistance(d) {
  const au = d / AU;
  if (au < 1.001) return `${Math.round((d - AU) / 1e3).toLocaleString('en-US')} km from Earth`;
  if (au < 100) return `${au < 10 ? au.toFixed(2) : Math.round(au)} AU from the Sun`;
  if (au < 5000) return `${sig(au)} AU from the Sun`;
  const ly = d / LY;
  if (ly < 0.01) return `${sig(au)} AU from the Sun`;
  return `${sig(ly)} light-years from the Sun`;
}
