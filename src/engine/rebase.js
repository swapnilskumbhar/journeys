// Scale rebasing — the reason this engine exists as its own thing.
//
// THE PROBLEM. "Earth to the observable universe" spans ~10^0 to ~10^27 metres.
// A float32 mantissa holds ~7 decimal digits. You cannot put both a human and a
// galaxy supercluster in one coordinate system: positions jitter, depth
// z-fights, and geometry either vanishes or swallows the camera. Every space
// renderer that works solves this; none solve it by using bigger numbers.
//
// THE SOLUTION, in two parts:
//
//  1. The camera never leaves the origin. Travel is expressed by changing the
//     SCALE of the world, not by moving through it. `metersPerUnit` is the
//     single live number: at 1e3 one world unit is a kilometre, at 1e21 one
//     world unit is ~100 light years.
//
//  2. Nothing outside the renderable window is instantiated. An object of real
//     size R metres occupies R/metersPerUnit world units; below ~1e-3 it is a
//     sub-pixel speck and above ~1e5 it engulfs the frustum. Objects live only
//     while they are inside that band, which is also what keeps the scene graph
//     small no matter how long the journey is (see stream.js).
//
// Consequence for content authors: NEVER write a world-space position. Declare
// real quantities in metres and convert through the rebaser every frame. A
// hardcoded `mesh.position.z = -400` is a bug that only shows up 12 decades
// later.

// World-unit band that renders cleanly. Deliberately narrow — roughly eight
// decades — because that is about what a single float32 depth range tolerates
// even with a logarithmic depth buffer.
export const MIN_UNITS = 1e-3;
export const MAX_UNITS = 1e5;

export function makeRebaser({ minUnits = MIN_UNITS, maxUnits = MAX_UNITS } = {}) {
  let metersPerUnit = 1;

  const api = {
    get metersPerUnit() {
      return metersPerUnit;
    },

    // Called once per frame by the player, from the journey's axis position.
    setScale(m) {
      if (!(m > 0) || !Number.isFinite(m)) throw new Error(`bad scale: ${m}`);
      metersPerUnit = m;
    },

    // metres → world units. The only sanctioned way to place anything.
    toWorld: (meters) => meters / metersPerUnit,

    // world units → metres, for readouts and hit-testing.
    toMeters: (units) => units * metersPerUnit,

    // Is something of this real size worth having in the scene right now?
    visible(meters) {
      const u = meters / metersPerUnit;
      return u >= minUnits && u <= maxUnits;
    },

    // Same test with hysteresis, so an object sitting exactly on the boundary
    // does not thrash mount/unmount when the user scrubs back and forth. Use
    // the wider band to decide whether to KEEP something already mounted.
    retain(meters, slack = 4) {
      const u = meters / metersPerUnit;
      return u >= minUnits / slack && u <= maxUnits * slack;
    },

    // Fade weight 0→1→0 across the band's edges, in log space. Objects should
    // multiply their opacity by this so they dissolve in and out instead of
    // popping — at these scale ratios a pop is extremely visible.
    weight(meters, fadeDecades = 0.75) {
      const u = meters / metersPerUnit;
      if (u <= 0) return 0;
      const lo = Math.log10(u / minUnits) / fadeDecades;
      const hi = Math.log10(maxUnits / u) / fadeDecades;
      return Math.max(0, Math.min(1, lo, hi));
    },
  };

  return api;
}
