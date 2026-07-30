// How long the page is, in viewport-heights of scroll, and the per-beat floor.
//
// Split out of index.js so scripts/smoke.mjs can import it in Node — index.js
// pulls in the journey registry, which is browser-only.
//
// 56 vh over 28 beats is 2.0 vh a beat on average. The axis carries one segment
// per beat, so each beat's scroll is exactly its own weight's share of that:
// tightest 1.64 vh, widest 2.41.
export const length = 56;

// Every beat in this journey stages a scene that has to be looked at — a pad, a
// staging event, a limb, a descent, a bootprint. There is no equivalent of
// big-bang's abstract-field era where 0.2 vh is survivable, so the floor is
// flat rather than tiered. 1.5 vh is roughly four seconds of ordinary
// scrolling: enough to read three sentences and still watch something happen.
export const floorVh = () => 1.5;
