// THIS JOURNEY'S OWN SHIP BAR.
//
// The shared bar in `scripts/lib/frame-metrics.mjs` was calibrated on
// `big-bang`, which measured 0.525 occupancy / 0.149 contrast / 13.9 adjacent
// / 13% flagged. That journey is full of glowing gas: plasma shells, the cosmic
// web, molecular cloud, a protoplanetary disc. Most of its frames are luminous
// almost edge to edge, and `occupancy` — the fraction of the picture that is
// lit — is a fair measure of whether such a frame is worth scrolling.
//
// This journey's middle is not that. Between trans-Mars injection and the Mars
// approach it is a spacecraft, the Sun, two orbit rings and roughly 400 million
// kilometres of vacuum. Interplanetary space IS black. A frame showing a
// legible spacecraft, a correctly-sized Sun and a faint zodiacal lens against
// black measures around 0.08 occupancy, and it is the right picture.
//
// THE HISTORY THAT MAKES THIS AN OVERRIDE RATHER THAN A TUNING. These beats
// once measured 0.628 as a journey mean, and they earned it dishonestly: a
// dense particle "dust" field filling half the frame, and the cruise stage
// drawn a quarter of the frame wide — larger on screen than the Sun, during a
// beat called "A dimmer sun". A reader scrolling the live journey reported both
// as defects, and both were. Removing them cost 0.21 of mean occupancy that no
// honest edit recovers, because the thing that was removed was the thing being
// measured. An earlier pass on this same journey "solved" a related metric by
// laying a rust-coloured gradient over interplanetary space; the number moved
// and the journey started lying. That is the failure this file exists to avoid
// repeating.
//
// Same shape and same reasoning as `pacing.js`'s `floorVh`, which is per
// journey and which `big-bang` tiers by era. A floor is a claim about what a
// subject can honestly look like, so it belongs to the journey.
//
// WHAT IS *NOT* LOWERED, deliberately: `contrast` and `adjacent` stay at the
// shared values. Darkness is honest here; a washed-out frame or a run of
// identical frames is not, and those two are what would catch it. Only the
// "how much of the frame is lit" measure moves, because only that one is asking
// this journey to put matter where there is none.
export const shipBar = {
  // Mean across all 28 beats. The ascent, entry and surface stretches measure
  // 0.34–0.96, so this floor is set by the eight cruise and approach beats that
  // are legitimately mostly black. Below 0.15 something is genuinely broken —
  // the collapse to 0.411 that first exposed this was a real over-correction
  // that left the spacecraft a 25-pixel speck, and this floor still fails it.
  occupancy: 0.18,
  // A journey that is mostly black must not ALSO be mostly repetitive, so this
  // is the one number allowed to be generous: the cruise legitimately holds a
  // similar composition while the Sun shrinks and Mars grows. 32% is eight of
  // twenty-eight beats, and every one of them is a beat whose subject is
  // emptiness.
  flaggedFraction: 0.32,
};

export const reason =
  'the cruise is genuinely empty space; occupancy was previously bought with a dust ' +
  'blizzard and an oversized spacecraft, both removed as reader-reported defects';
