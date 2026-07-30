// How long the page is, in viewport-heights of scroll, and the per-beat floor.
// Split out so scripts/smoke.mjs can import it in Node.
//
// 68 vh over 27 beats, Σweight = 28.35. Tightest beats (weight 0.90 — beats 5,
// 7, 11, 20, 24) come out at ~2.16 vh; widest (weight 1.30 — beats 21, 25, 27,
// the three structural events plus the closing beat) at ~3.12 vh.
export const length = 68;

// Flat floor, same reasoning as the three spaceflight journeys: every beat
// here — even the plainest crustal transit — carries a concrete material
// change (colour, texture, lit-vs-glowing) rather than being an abstract era
// to coast through, so there is no tiered floor the way big-bang needs one.
export const floorVh = () => 1.5;
