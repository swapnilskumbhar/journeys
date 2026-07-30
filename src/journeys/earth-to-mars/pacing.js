// How long the page is, in viewport-heights of scroll, and the per-beat floor.
// Split out so scripts/smoke.mjs can import it in Node.
//
// 64 vh over 28 beats, Σweight = 29.60 (see DESIGN.md §1). Tightest beat
// (11, "Nothing close to anything", and 13, "Crossing Earth's orbit") comes
// out at 1.84 vh; widest (21 and 26) at 2.81 vh.
export const length = 64;

// Flat floor, same reasoning as earth-to-moon: every beat here stages a scene
// — even the cruise beats carry a concrete visual device (the curved
// trajectory, the shrinking sun, a ring crossing, the panel deployment) rather
// than being an abstract era to coast through, so there is no tiered floor.
export const floorVh = () => 1.5;
