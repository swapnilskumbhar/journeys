// Shared depth constants and the readout formatter — the sibling of every
// other journey's distance.js/time.js, kept import-safe for Node so
// scripts/smoke.mjs can load it without a browser.
//
// THE AXIS. Depth below the surface, in metres, 0 → 6.371e6 m (Earth's mean
// radius — the centre). A log axis cannot reach zero, so the floor is a third
// of a metre: real topsoil, not an arbitrary near-zero the way a spacecraft's
// "1 m off the pad" is arbitrary elsewhere in this project.

export const D0 = 0.3;                  // floor: topsoil
export const R_EARTH = 6.371e6;         // centre of the Earth
export const R_INNER_CORE = 1.221e6;    // inner-core radius (depth to its boundary = R_EARTH - this)
export const D_ICB = R_EARTH - R_INNER_CORE;   // 5.150e6 m — inner-core boundary
export const D_CMB = 2.891e6;           // core–mantle boundary
export const D_MOHO = 3.5e4;            // Mohorovičić discontinuity, continental average
export const D_KOLA = 1.2262e4;         // Kola Superdeep Borehole, real depth
export const D_MPONENG = 4.0e3;         // Mponeng gold mine, real depth

const sig = (x) => (x >= 100
  ? Math.round(x).toLocaleString('en-US')
  : Number(x.toPrecision(3)).toLocaleString('en-US'));

// Switches: cm near the surface (soil is read in centimetres, not metres),
// then metres, then km once the numbers are inconveniently large, then a
// fraction of Earth's radius once genuinely planetary — the unit the reader
// actually needs changes as fast as the material does.
//
// The deep branch used to read `"2,895 km down · 45.4% to centre"` —
// concatenating BOTH units rather than switching between them like every
// other branch here (and every other journey's formatter). Two consequences,
// one cosmetic and one real: it broke this journey's own convention of one
// unit at a time, and its length swings from ~19 to ~34 characters across the
// axis. The ribbon's `.ribbon-readout` is `min-width` but not `max-width` —
// it grows with its content — so that swing visibly narrows `.ribbon-track`
// (`flex: 1` beside it) as the reader scrubs into deep-Earth territory, a
// wrinkle no other journey's shorter, near-constant-width readout shows.
// Percentage alone is both the more honest number at this scale (nobody
// reasons in kilometres once they are most of the way to the centre) and
// nearly constant width (`"1.7% to the centre"` → `"100.0% to the centre"`),
// so it fixes both problems by dropping the concatenation rather than
// padding around it.
export function formatDepth(d) {
  if (d < 1) return `${sig(d * 100)} cm down`;
  if (d < 1e3) return `${sig(d)} m down`;
  if (d < 1e5) return `${sig(d / 1e3)} km down`;
  if (d >= R_EARTH - 1) return 'the centre';
  return `${(d / R_EARTH * 100).toFixed(1)}% to the centre`;
}
