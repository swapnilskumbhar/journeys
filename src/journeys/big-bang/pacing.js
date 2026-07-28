// How long the page is, in viewport-heights of scroll.
//
// Split out of index.js so scripts/smoke.mjs can import it in Node — index.js
// pulls in the journey registry, which is browser-only. The smoke test needs
// this number because the pacing defect it guards against is only visible in
// viewport-heights: a beat can look fine as a fraction of the axis and still be
// 360 pixels of scroll on screen.
// 78 → 82 when the human era was cut into one segment per beat: those beats
// needed real scroll and taking it from the life era would have re-created the
// defect there.
export const length = 82;
