// Shared distance constants and the readout formatter.
//
// The axis value is ALWAYS metres from Earth's surface along the flight path —
// one monotonic quantity, as the engine requires. Everything reader-facing
// ("110 km above the Moon", "38,000 km to go") is presentation and lives here.
//
// The sibling of big-bang's time.js, and it exists for the same reason: layer
// bounds, the scale law and the camera all want to be written in the units the
// science is quoted in, and scripts/smoke.mjs has to be able to import them in
// Node without pulling in the browser-only journey registry.

export const R_EARTH = 6.371e6;   // mean radius, m
export const R_MOON = 1.7374e6;   // mean radius, m
export const TOTAL = 3.844e8;     // mean Earth centre → Moon centre, m

// Earth's surface to the Moon's surface. Every distance in this journey is
// measured from the pad, so this is where the flight ends and the walk begins.
export const MOON_D = TOTAL - R_EARTH - R_MOON; // 3.76292e8 m

// Distance from Earth's surface for a point `alt` metres above the MOON.
// Descending toward the Moon increases the axis value, which is what lets the
// lunar-orbit beats (314 → 111 → 100 → 15 km) stay strictly ordered without
// inventing anything: they really did descend.
export const overMoon = (alt) => MOON_D - alt;
// …and past the surface, distance walked from the ladder.
export const walked = (m) => MOON_D + m;

// Radius from Earth's CENTRE at axis value d — what the planet layer needs.
export const rEarth = (d) => R_EARTH + d;
// Distance to the Moon's centre at axis value d.
export const dMoon = (d) => TOTAL - R_EARTH - d;

// The point where lunar gravity exceeds Earth's: GM_e/r² = GM_m/(TOTAL-r)²,
// and sqrt(81.30) = 9.017, so r = TOTAL / (1 + 1/9.017) = 0.9002 × TOTAL.
export const CROSSOVER = 0.9002 * TOTAL - R_EARTH; // ≈ 3.397e8 m

const sig = (x) => (x >= 100
  ? Math.round(x).toLocaleString('en-US')
  : Number(x.toPrecision(3)).toLocaleString('en-US'));

// Two modes, switching where the story does — the same idea as time.js counting
// up before the Sun and down afterwards. On the way out the number that matters
// is how far you have come; past the halfway point it is how far is left, which
// is the number the crew actually read.
export function formatDistance(d) {
  if (d >= MOON_D) {
    const w = d - MOON_D;
    if (w < 1) return 'on the Moon';
    return `${sig(w)} m from the ladder`;
  }

  const alt = MOON_D - d; // metres above the lunar surface
  if (alt < 4e5) {
    if (alt < 1e3) return `${sig(alt)} m above the Moon`;
    return `${sig(alt / 1e3)} km above the Moon`;
  }

  if (d > TOTAL / 2) return `${sig(alt / 1e3)} km to the Moon`;

  if (d < 1e3) return `${sig(d)} m up`;
  if (d < 1e6) return `${sig(d / 1e3)} km up`;
  return `${sig(d / 1e3)} km from Earth`;
}
