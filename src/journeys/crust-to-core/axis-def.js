import { D0, R_EARTH, D_MOHO, D_CMB, D_ICB, D_KOLA, D_MPONENG, formatDepth } from './depth.js';

// THE AXIS. Depth below the surface, in metres — 0.3 m (topsoil; a log axis
// cannot reach zero) to 6.371e6 m (the centre). ONE SEGMENT PER BEAT, boundary
// at each beat's own depth — the same mechanical reason as every other
// journey here: vh(beat i) = weight_i / Σweight × length, so re-weighting one
// beat cannot move any other beat's DEPTH, and pacing stays a column of
// numbers rather than a feeling.
//
// `space` is log almost everywhere — this axis spans 7.3 decades, more than
// any journey here except big-bang — and `linear` only inside the three
// STRUCTURAL EVENTS (the Moho, the core–mantle boundary, the inner-core
// boundary), each staged as approach → crossing → aftermath, the same
// three-phase pattern big-bang's K–Pg impact and Moon-forming collision use:
// an instantaneous (geologically) event inside what would otherwise be one
// long segment needs its own tight window or the beat's own midpoint —
// where shots.mjs samples and reviews it — drifts off the event entirely.
export const axisDef = {
  kind: 'segments',
  unit: 'm',
  label: '',
  format: formatDepth,
  segments: [
    // --- the soil column ----------------------------------------------------
    { from: D0, to: 1.5, weight: 1.10 },                 // 1  Grass and topsoil
    { from: 1.5, to: 8, weight: 0.95 },                  // 2  The root zone and the soil horizons
    { from: 8, to: 30, weight: 0.95 },                   // 3  The water table
    { from: 30, to: 120, weight: 0.95 },                 // 4  The first solid bedrock
    { from: 120, to: D_MPONENG, weight: 0.90 },          // 5  Weathered rock, joints and fractures

    // --- the deepest humans have gone ---------------------------------------
    { from: D_MPONENG, to: 9.0e3, weight: 1.20 },        // 6  Mponeng: the deepest mine
    { from: 9.0e3, to: D_KOLA, weight: 0.90 },           // 7  Approaching the deepest hole ever drilled
    { from: D_KOLA, to: 2.0e4, weight: 1.25 },           // 8  The Kola Superdeep Borehole

    // --- the rest of the crust -----------------------------------------------
    { from: 2.0e4, to: 3.0e4, weight: 1.00 },            // 9  Sedimentary strata, time made visible
    { from: 3.0e4, to: 3.3e4, weight: 0.95 },            // 10 Deep crustal rock, metamorphosed
    { from: 3.3e4, to: D_MOHO, space: 'linear', weight: 0.90 },   // 11 Approaching the base of the crust

    // --- the Moho: approach → crossing → aftermath --------------------------
    { from: D_MOHO, to: 3.7e4, space: 'linear', weight: 1.25 },   // 12 The Mohorovičić discontinuity (event)
    { from: 3.7e4, to: 8.0e4, weight: 1.00 },            // 13 Into the mantle (aftermath)

    // --- the upper mantle ------------------------------------------------------
    { from: 8.0e4, to: 1.5e5, weight: 0.95 },            // 14 Upper mantle, peridotite
    { from: 1.5e5, to: 1.9e5, weight: 1.05 },            // 15 The asthenosphere
    { from: 1.9e5, to: 5.0e5, weight: 1.10 },            // 16 Where diamonds form
    { from: 5.0e5, to: 1.2e6, weight: 1.05 },            // 17 The transition zone

    // --- the lower mantle ------------------------------------------------------
    { from: 1.2e6, to: 2.85e6, weight: 0.95 },           // 18 The lower mantle
    { from: 2.85e6, to: 2.87e6, weight: 1.00 },          // 19 The D″ layer
    { from: 2.87e6, to: D_CMB, space: 'linear', weight: 0.90 },   // 20 Approaching the core–mantle boundary

    // --- the core–mantle boundary: approach → crossing → aftermath ----------
    { from: D_CMB, to: 2.92e6, space: 'linear', weight: 1.30 },   // 21 The core–mantle boundary (event)
    { from: 2.92e6, to: 4.0e6, weight: 1.05 },           // 22 Into the outer core (aftermath)

    // --- the outer core --------------------------------------------------------
    { from: 4.0e6, to: 5.10e6, weight: 1.10 },           // 23 The liquid outer core, and the magnetic field
    { from: 5.10e6, to: D_ICB, space: 'linear', weight: 0.90 },   // 24 Approaching the inner-core boundary

    // --- the inner-core boundary: approach → crossing → aftermath -----------
    { from: D_ICB, to: 5.8e6, space: 'linear', weight: 1.30 },    // 25 The inner-core boundary (event)
    { from: 5.8e6, to: R_EARTH - 200, weight: 1.10 },    // 26 The solid inner core (aftermath)
    { from: R_EARTH - 200, to: R_EARTH, space: 'linear', weight: 1.30 }, // 27 The centre of the Earth
  ],
};
