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

// The per-beat pacing floor, in viewport-heights, as a function of the beat's
// 1-based index. Declared here rather than inside scripts/smoke.mjs so the
// smoke test can iterate over journeys generically — every journey has its own
// idea of which of its beats are scenes.
//
// Beats 19–30 (Our galaxy → the K–Pg impact) each stage a scene that has to be
// looked at: 1.5vh is about four seconds of ordinary scrolling. The human era,
// 31–39, gets 1.2 — it was lumped in with "everywhere else" on the argument
// that the wheel and writing are honestly 1,300 years apart, which was wrong
// twice over, and "The wheel" shipped at 0.13vh as a result. Everywhere else
// the floor is only "did not vanish".
export const floorVh = (i) => (i >= 19 && i <= 30 ? 1.5 : i >= 31 ? 1.2 : 0.15);
