// How long the page is, in viewport-heights of scroll, and the per-beat floor.
// Split out so scripts/smoke.mjs can import it in Node.
//
// 62 vh over 22 beats. Σweight = 24.25 (see plan.js — each beat's three
// segments sum to its own declared weight), so the tightest beat, at weight
// 1.00, comes out at 2.56 vh and the widest, the Pale Blue Dot at 1.45, at
// 3.71 vh. The first build ran 82 vh over 32 beats for a mean of 2.56; this
// one is shorter and every beat gets more scroll, which is what "fewer, denser
// beats" costs and buys.
export const length = 62;

// Flat floor, same reasoning as earth-to-mars: every beat here stages a
// concrete scene — there is no tiered floor of the kind big-bang needs for
// eras with wildly different visual density, because the cruise beats that
// had nothing to stage were cut rather than paced around. 1.5 vh matches the
// other three spaceflight journeys exactly, and every beat clears it with at
// least a viewport of margin.
export const floorVh = () => 1.5;
