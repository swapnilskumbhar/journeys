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
    { from: ago(440e6), to: ago(66.2e6), space: 'lookback', pivot: AGE, weight: 0.06 }, // 29 The Great Dying

    // 30 Ten kilometres of rock. The impact gets 300,000 years of its own, in
    // LINEAR space, and that is the whole trick.
    //
    // The problem it solves: this beat runs from the impact to the hominin split
    // — 66 to 7 million years — and an instantaneous event inside a span that
    // long is invisible. Sampled anywhere but the first one percent of the beat,
    // the reader has copy about an asteroid strike over a picture of a recovered
    // world. Lookback space does not help; log of a ratio still puts 65 Myr of
    // aftermath either side of the moment that matters.
    //
    // With this segment carrying 0.05 of the axis against the 0.19 that covers
    // 65.9 Myr → now, the beat's own midpoint lands at 73.7% of this window —
    // which is 66.0 Ma, the accepted Chicxulub date. So the middle of the beat
    // is the fireball, and the recovery is its tail rather than its subject.
    { from: ago(66.2e6), to: ago(65.9e6), space: 'linear', weight: 0.05 },
    // The recovery, which is the rest of beat 30. Kept SEPARATE from the beats
    // that follow, and deliberately light: this segment is the only thing that
    // decides where the beat's midpoint falls inside the window above. At 0.3
    // of the impact's weight the midpoint lands at 65% of it — the fireball.
    // Fold it back into the segment below and the midpoint slides to the
    // window's far edge, which is dust and no strike.
    { from: ago(65.9e6), to: ago(7e6), space: 'lookback', pivot: AGE, weight: 0.015 },

    // --- the human era --------------------------------------------------------
    // One segment per beat, for the same reason the life era got them, and it
    // took the same defect to find out. On a log-lookback axis "The wheel"
    // (6.5 → 5.2 kyr) is 0.097 decades out of the 7.8 that segment spanned, so
    // it was allotted 0.13 viewport-heights — about 120 pixels for the whole
    // invention of wheeled transport. Farming had 0.36. No amount of work on
    // what those beats SHOW survives a reader scrolling past them in a flick,
    // and nothing keyed to the axis can see it: as a fraction of 13.8 billion
    // years, 1,300 years is exactly as small as it deserves to be.
    //
    // These are editorial weights, in the unit the reader actually experiences.
    // Tune them by re-running scripts/smoke.mjs, which prints and gates on vh.
    { from: ago(7e6), to: ago(65e3), space: 'lookback', pivot: AGE, weight: 0.1086 },  // 31 · 32 · 33
    { from: ago(65e3), to: ago(12e3), space: 'lookback', pivot: AGE, weight: 0.0312 }, // 34 Out of Africa
    { from: ago(12e3), to: ago(6.5e3), space: 'lookback', pivot: AGE, weight: 0.039 }, // 35 Farming
    { from: ago(6.5e3), to: ago(5.2e3), space: 'lookback', pivot: AGE, weight: 0.0273 }, // 36 The wheel
    { from: ago(5.2e3), to: ago(260), space: 'lookback', pivot: AGE, weight: 0.039 },  // 37 Writing
    { from: ago(260), to: ago(8), space: 'lookback', pivot: AGE, weight: 0.0351 },     // 38 Machines
    // → now. Stops one year short of the pivot: log space cannot reach zero,
    // and "1 year ago" is close enough to today to be called today.
    { from: ago(8), to: ago(1), space: 'lookback', pivot: AGE, weight: 0.0273 },       // 39 Today
  ],
};
