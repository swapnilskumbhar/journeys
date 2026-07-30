// Shared distance constants and the readout formatter — the sibling of
// earth-to-moon's distance.js and big-bang's time.js, for the same reason:
// layer bounds, the scale law and the camera all want real units, and
// scripts/smoke.mjs has to import this in Node without the browser-only
// journey registry.

export const R_EARTH = 6.371e6;   // mean radius, m
export const R_MARS = 3.3895e6;   // mean radius, m

// The axis is DISTANCE TRAVELLED ALONG THE FLIGHT PATH — not the ~2.25e11 m
// straight-line opposition distance. A Hohmann transfer is half of an ellipse
// with semi-major axis a = (1 AU + 1.524 AU)/2 = 1.888e11 m and semi-minor
// b = sqrt(1 AU × 1.524 AU) = 1.846e11 m; the Ramanujan perimeter
// approximation puts half that ellipse's arc length at ~5.86e11 m. 5.60e11 m
// is the round number this journey uses end to end (ascent and descent legs
// shave a little off both ends of the pure transfer arc), and it is more than
// double the straight-line distance — which is the whole point of choosing a
// PATH length for this axis.
export const MARS_D = 5.60e11; // Earth's surface to Mars' surface, along the path

// One AU, for the readout and for placing the two orbital-path rings.
export const AU = 1.496e11;
export const MARS_AU = 2.279e11; // Mars' mean orbital radius

export const walked = (m) => MARS_D + m;

// Radius from Earth's centre / Mars' centre at axis value d.
export const rEarth = (d) => R_EARTH + d;
export const rMars = (d) => MARS_D - R_MARS - d;

// The geometric midpoint of the free-flight phase — where the "frame the
// nearer body" scale law peaks, same role as CROSSOVER in earth-to-moon.
export const MIDPOINT = MARS_D / 2;

const sig = (x) => (x >= 100
  ? Math.round(x).toLocaleString('en-US')
  : Number(x.toPrecision(3)).toLocaleString('en-US'));

// Switches register the same way time.js and earth-to-moon's formatDistance
// do: metres/km near a body, AU once the distance is genuinely interplanetary
// (the unit the number is actually quoted in), then counting DOWN to Mars
// past the geometric midpoint, then altitude, then on the ground.
export function formatDistance(d) {
  if (d >= MARS_D) {
    const w = d - MARS_D;
    if (w < 1) return 'on Mars';
    return `${sig(w)} m from the ladder`;
  }

  const alt = MARS_D - d;
  if (alt < 4e5) {
    if (alt < 1e3) return `${sig(alt)} m above Mars`;
    return `${sig(alt / 1e3)} km above Mars`;
  }

  if (d > MIDPOINT) return `${sig(alt / AU)} AU to Mars`;

  if (d < 1e3) return `${sig(d)} m up`;
  if (d < 1e6) return `${sig(d / 1e3)} km up`;
  if (d < 1e9) return `${sig(d / 1e3)} km from Earth`;
  return `${sig(d / AU)} AU from Earth`;
}
