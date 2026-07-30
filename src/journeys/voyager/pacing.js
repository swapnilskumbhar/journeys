// How long the page is, in viewport-heights of scroll, and the per-beat floor.
// Split out so scripts/smoke.mjs can import it in Node.
//
// 82 vh over 32 beats, Σweight = 34.40 (see DESIGN.md §1). Tightest beat
// (3, "The Moon, in passing", weight 0.90) comes out at ~2.15 vh; widest
// (23, "The Pale Blue Dot", weight 1.35) at ~3.22 vh — deliberately the
// widest beat in the journey, because it is the emotional centre and the one
// place DESIGN.md insists must not be rushed.
export const length = 82;

// Flat floor, same reasoning as earth-to-mars: every beat here — including
// every cruise beat — carries a concrete visual device (see DESIGN.md §3),
// so there is no tiered floor the way big-bang needs one for eras with wildly
// different visual density. 1.5 vh matches the other two spaceflight
// journeys' floor exactly; every beat here clears it with at least 0.6 vh of
// margin (see the table above), which is intentional slack given how much
// harder the cruise beats are to hold visually than either earlier journey's.
export const floorVh = () => 1.5;
