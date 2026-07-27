import { AGE, ago, after, formatTime } from './time.js';

// THE AXIS.
//
// 13.8 billion years is 4.35e17 seconds, and the interesting part starts at
// 1e-44. A single logarithmic axis over that range would be honest and
// unreadable: 44 of its 61 decades happen before the universe is one second
// old, and every human being who ever lived would share the final 0.00001 of
// the scroll.
//
// So the axis is segmented, and the weights are an editorial decision: the
// first second gets 24% of the scroll, and the 66 million years since the
// dinosaurs get 19% of it. The last two segments run in `lookback` space —
// logarithmic in time REMAINING — which is the only way the recent past gets
// any room at all. In lookback space the Cambrian and last Tuesday are eight
// decades apart, exactly as they should be for a reader.
//
// Kept in its own file so scripts/smoke.mjs can check beat placement in Node,
// without pulling in the browser-only journey registry.
export const axisDef = {
  kind: 'segments',
  unit: 's',
  label: '',
  format: formatTime,
  segments: [
    // Planck → the end of inflation. Twelve decades, densely narrated.
    { from: 1e-44, to: 1e-32, weight: 0.13 },
    // → one second. Thirty-two decades with fewer named events, so it is
    // deliberately given less scroll per decade than the segment above.
    { from: 1e-32, to: 1, weight: 0.11 },
    // → recombination at 380,000 years. Nucleosynthesis and the opaque era.
    { from: 1, to: 1.2e13, weight: 0.15 },
    // → one billion years. Dark ages, first stars, first galaxies.
    { from: 1.2e13, to: after(1e9), weight: 0.13 },
    // → 8.8 billion years. Cosmic noon, the web, dark energy taking over.
    { from: after(1e9), to: ago(5e9), weight: 0.09 },
    // The dive: cosmic scales down to a collapsing molecular cloud. Linear,
    // because it is a short span carrying a long camera move.
    { from: ago(5e9), to: ago(4.60e9), space: 'linear', weight: 0.07 },

    // --- the life era ---------------------------------------------------------
    // Everything from here to the K–Pg impact used to be four segments. That was
    // right when these beats were nine static globes needing no time, and became
    // wrong the moment they started carrying scenes: "A star is born" — the whole
    // formation of the solar system, with a six-decade zoom inside it — got 0.4
    // viewport-heights, and the Ediacaran seafloor got 0.28. Both passed every
    // check that measured the axis rather than the screen.
    //
    // So the era is cut finer, one segment per scene, and the weights are set
    // against scroll on screen. scripts/smoke.mjs gates it in viewport-heights;
    // tune by re-running that, not by eye.
    //
    // The Hadean stays LINEAR. In lookback space 4.568 and 4.4 Gyr ago differ by
    // four percent and collapse onto each other; the Sun, the Moon-forming impact
    // and the first oceans would land within a few hundred pixels of each other.
    { from: ago(4.60e9), to: ago(4.53e9), space: 'linear', weight: 0.055 }, // 20 A star is born
    { from: ago(4.53e9), to: ago(4.46e9), space: 'linear', weight: 0.06 },  // 21 The Moon — an impact sequence
    { from: ago(4.46e9), to: ago(4.0e9), space: 'linear', weight: 0.05 },   // 22 Oceans
    { from: ago(4.0e9), to: ago(2.6e9), space: 'lookback', pivot: AGE, weight: 0.05 },  // 23 Life
    { from: ago(2.6e9), to: ago(2.0e9), space: 'lookback', pivot: AGE, weight: 0.04 },  // 24 The oxygen catastrophe
    { from: ago(2.0e9), to: ago(640e6), space: 'lookback', pivot: AGE, weight: 0.05 },  // 25 Cells within cells
    { from: ago(640e6), to: ago(440e6), space: 'lookback', pivot: AGE, weight: 0.13 },  // 26 Bodies · 27 Cambrian · 28 Land
    { from: ago(440e6), to: ago(66e6), space: 'lookback', pivot: AGE, weight: 0.06 },   // 29 The Great Dying
    // → now. Stops one year short of the pivot: log space cannot reach zero,
    // and "1 year ago" is close enough to today to be called today. Carries the
    // K–Pg impact as well as the whole human story, hence the largest weight.
    { from: ago(66e6), to: ago(1), space: 'lookback', pivot: AGE, weight: 0.24 },
  ],
};
