import { MARS_D, walked, formatDistance } from './distance.js';

// THE AXIS. Distance travelled along the flight path, in metres, 1 m →
// MARS_D + 55 m. Monotonic by construction, same contract as earth-to-moon:
// the vehicle never reverses, and the axis continues past touchdown as
// distance walked from the ladder so the last two beats do not collide at
// zero altitude.
//
// ONE SEGMENT PER BEAT, boundary at each beat's own distance — the mechanical
// reason is unchanged from earth-to-moon and big-bang: vh(beat i) =
// weight_i / Σweight × length, so pacing is a column of numbers and
// re-weighting one beat cannot move any other beat's DISTANCE.
//
// `space` is log where a segment crosses a decade or more, linear where it is
// a narrow band (parking orbit, the descent, the walk).
export const axisDef = {
  kind: 'segments',
  unit: 'm',
  label: '',
  format: formatDistance,
  segments: [
    // --- the pad and the ascent ------------------------------------------
    { from: 1, to: 4, weight: 1.00 },              // 1  The pad
    { from: 4, to: 130, weight: 1.25 },            // 2  Ignition
    { from: 130, to: 1.4e4, weight: 1.00 },        // 3  The tower clears
    { from: 1.4e4, to: 6.5e4, weight: 1.10 },      // 4  Max Q
    { from: 6.5e4, to: 9.5e4, weight: 1.25 },      // 5  Staging
    { from: 9.5e4, to: 2.0e5, weight: 0.90 },      // 6  The sky goes black

    // --- the parking orbit and TMI ---------------------------------------
    { from: 2.0e5, to: 2.05e5, space: 'linear', weight: 0.95 }, // 7  Parking orbit
    { from: 2.05e5, to: 2.2e5, space: 'linear', weight: 0.90 }, // 8  One quiet orbit
    { from: 2.2e5, to: 1.0e7, weight: 1.20 },      // 9  Trans-Mars injection

    // --- the cruise --------------------------------------------------------
    // The biggest risk in this journey: ~4.6 decades of genuinely empty
    // space. Six beats, not one, and each carries a concrete device (see
    // DESIGN.md §3) rather than "small ship, stars" repeated six times.
    { from: 1.0e7, to: 1.0e9, weight: 1.00 },      // 10 Earth shrinking behind
    { from: 1.0e9, to: 3.0e10, weight: 0.85 },     // 11 Nothing close to anything
    { from: 3.0e10, to: 1.5e11, weight: 0.90 },    // 12 A dimmer sun
    { from: 1.5e11, to: 2.2e11, weight: 0.85 },    // 13 Crossing Earth's orbit
    { from: 2.2e11, to: 3.6e11, weight: 0.95 },    // 14 The cruise stage unfolds
    { from: 3.6e11, to: 5.0e11, weight: 1.05 },    // 15 A course correction

    // --- Mars approach -----------------------------------------------------
    // THE APPROACH MARKS ARE ALTITUDES, and they are chosen so that each beat's
    // own MIDPOINT — 45% along, which is where every review samples — lands on
    // the apparent size the beat's heading promises. Under the journey's scale
    // law (`plan.js`: frame = 0.6 × the distance to Mars' centre) the drawn
    // diameter of Mars is 1370 · R / c, so the four midpoint altitudes
    // 3.53e8 → 3.46e7 → 8.2e6 → 3.24e6 m give 15 px → 133 px → 404 px → 738 px.
    //
    // The previous marks (5.30e11 … 5.598e11) put those midpoints at altitudes
    // of 30 million to 200 thousand kilometres, where Mars is a fraction of a
    // pixel — which is why "a point of light", "a disc", "ochre and a white cap"
    // and "Olympus Mons" rendered as four identical black rectangles at 0.005
    // occupancy. Honest dates and honest distances constrain where a beat SITS;
    // the weights below still decide how much scroll it gets, so pacing is
    // unchanged.
    { from: 5.0e11, to: MARS_D - 5.97e8, weight: 0.90 },        // 16 Crossing Mars' orbit
    { from: MARS_D - 5.97e8, to: MARS_D - 5.46e7, weight: 1.00 },  // 17 A point of light
    { from: MARS_D - 5.46e7, to: MARS_D - 1.016e7, weight: 1.00 }, // 18 A disc
    { from: MARS_D - 1.016e7, to: MARS_D - 5.79e6, weight: 1.05 }, // 19 Ochre, and a white cap
    { from: MARS_D - 5.79e6, to: MARS_D - 1.25e5, weight: 1.05 },  // 20 Olympus Mons, Valles Marineris

    // --- entry, descent and landing ----------------------------------------
    // All linear — the last 125 km of a 5.6e11 m journey is 0.00002% of the
    // axis, the same problem earth-to-moon's lunar-orbit tail solves the same
    // way.
    { from: MARS_D - 1.25e5, to: MARS_D - 6.0e4, space: 'linear', weight: 1.30 }, // 21 Entry interface
    { from: MARS_D - 6.0e4, to: MARS_D - 1.1e4, space: 'linear', weight: 1.20 },  // 22 Peak heating
    { from: MARS_D - 1.1e4, to: MARS_D - 2.0e3, space: 'linear', weight: 1.20 },  // 23 Parachute
    { from: MARS_D - 2.0e3, to: MARS_D - 1.4e3, space: 'linear', weight: 1.00 },  // 24 Heat shield away
    { from: MARS_D - 1.4e3, to: MARS_D, space: 'linear', weight: 1.20 },          // 25 Powered descent

    // --- the surface ---------------------------------------------------------
    { from: MARS_D, to: walked(9), space: 'linear', weight: 1.30 },   // 26 Touchdown
    { from: walked(9), to: walked(55), space: 'linear', weight: 1.10 }, // 27 The first frame
    { from: walked(55), to: walked(95), space: 'linear', weight: 1.15 }, // 28 An evening star
  ],
};
