import { auTo, D0, formatDistance } from './distance.js';

// THE AXIS. Heliocentric range — distance from the Sun, in metres — 1 AU at
// launch to Proxima Centauri's distance at the far end. Monotonic by
// construction: Voyager 1 and 2's real heliocentric range never decreases
// after launch, even though their actual flight path bends hard at every
// gravity assist (see distance.js for why range, not path length, is the
// right quantity here — the inverse of earth-to-mars' choice, and for the
// same underlying reason: pick the quantity that is both true and
// monotonic).
//
// ONE SEGMENT PER BEAT, boundary at each beat's own mark — same mechanical
// reason as every other journey in this project: vh(beat i) =
// weight_i / Σweight × length, so re-weighting one beat cannot move any
// other beat's DISTANCE, and pacing is a column of numbers, not a feeling.
//
// `space` is log almost everywhere — this axis spans 5.4 decades, more than
// any journey here except big-bang — and linear only inside four tight
// clusters where consecutive beats sit within a fraction of a percent of
// each other (Jupiter's four sub-beats, Saturn's four, Neptune/Triton, and
// Voyager-today/Golden-Record): log space still WORKS at those separations,
// but linear makes the intended near-equal spacing explicit rather than
// relying on a log curve to look flat over a tiny span.
const END = auTo(280000); // padding past the final beat, for the closing hold

export const axisDef = {
  kind: 'segments',
  unit: 'm',
  label: '',
  format: formatDistance,
  segments: [
    // --- launch and departure ---------------------------------------------
    { from: D0, to: auTo(1.02), weight: 1.15 },              // 1  The Grand Tour alignment
    { from: auTo(1.02), to: auTo(1.03), weight: 1.00 },       // 2  Leaving Earth
    { from: auTo(1.03), to: auTo(1.5), weight: 0.90 },        // 3  The Moon, in passing
    { from: auTo(1.5), to: auTo(2.7), weight: 0.95 },         // 4  Into deep cruise
    { from: auTo(2.7), to: auTo(4.5), weight: 1.05 },         // 5  The asteroid belt

    // --- Jupiter (a tight cluster — linear) --------------------------------
    { from: auTo(4.5), to: auTo(5.20), weight: 1.00 },           // 6  Approaching the giant
    { from: auTo(5.20), to: auTo(5.203), space: 'linear', weight: 1.20 },  // 7  Jupiter: the Great Red Spot
    { from: auTo(5.203), to: auTo(5.205), space: 'linear', weight: 1.00 }, // 8  Banded cloud tops
    { from: auTo(5.205), to: auTo(5.207), space: 'linear', weight: 1.10 }, // 9  Io's volcanoes
    { from: auTo(5.207), to: auTo(5.25), space: 'linear', weight: 1.05 },  // 10 Europa's cracked ice
    { from: auTo(5.25), to: auTo(7.5), weight: 1.15 },           // 11 The gravity assist

    // --- Saturn (a tight cluster — linear) ---------------------------------
    // Beats 13/14/18/20/21 were originally marked at distances well short of
    // (Saturn, Uranus) or well past (Neptune/Triton) each body's own real
    // heliocentric radius (R_*_AU), unlike the Jupiter cluster above, whose
    // beats already sit on R_JUPITER_AU with ~0.003 AU steps between them.
    // The fix has two parts, and the first pass here only did the second:
    // (1) put each encounter beat's own mark ON the body's true R_*_AU, the
    // way Jupiter's already are, and (2) split the segment that follows into
    // a TIGHT encounter sub-segment (a few times the body's own radius, same
    // ~0.003 AU order the Jupiter cluster uses — a 0.05 AU "tight" window
    // that first pass tried is still ~100 planet-radii, i.e. still a point at
    // `frame = max(4×radius, 1.3×|offset|)`) plus a separately-weighted
    // departure segment, so shots.mjs's mid-beat sample (45% into the beat's
    // own u-range) lands inside the close approach rather than in departure.
    { from: auTo(7.5), to: auTo(9.58), weight: 1.00 },             // 12 Cruise to Saturn
    { from: auTo(9.58), to: auTo(9.583), space: 'linear', weight: 0.90 },  // 13 Saturn: the rings edge-on (encounter)
    { from: auTo(9.583), to: auTo(9.586), space: 'linear', weight: 0.20 }, // 13 …departure
    { from: auTo(9.586), to: auTo(9.589), space: 'linear', weight: 0.85 }, // 14 The rings, lit (encounter)
    { from: auTo(9.589), to: auTo(9.60), space: 'linear', weight: 0.20 },  // 14 …departure
    { from: auTo(9.60), to: auTo(9.70), space: 'linear', weight: 1.00 },   // 15 Titan's haze
    { from: auTo(9.70), to: auTo(14), weight: 1.10 },            // 16 Voyager 1 and 2 diverge

    // --- Uranus --------------------------------------------------------------
    { from: auTo(14), to: auTo(19.20), weight: 1.00 },           // 17 Cruise to Uranus
    // R_URANUS_AU (19.20) was already the mark; the segment width was the
    // remaining problem. The FIRST cleanup pass tightened it to Jupiter's
    // literal 0.003 AU, and that was still not tight enough: Jupiter's own
    // beats look full-frame not because 0.003 AU is a universal "tight"
    // constant but because Jupiter is big enough that `4 × radius` (2.8e8 m)
    // already exceeds `1.3 × |offset|` at that separation, so the RADIUS
    // FLOOR dominates the frame formula. Uranus and Neptune are roughly a
    // third of Jupiter's radius, so the same 0.003 AU window left
    // `1.3 × |offset|` still bigger than `4 × radius` — a real, resolved, but
    // visibly smaller disc than Saturn's. Tightened further here (0.0019 AU)
    // so the offset term drops close to the radius floor at the sample
    // point, checked against `frame = max(4×radius, 1.3×|offset|)` directly
    // rather than by eye: at the beat's own mid-sample this puts Uranus at
    // ≈55% of frame height, up from ≈32%.
    { from: auTo(19.20), to: auTo(19.2019), weight: 0.95 },      // 18 Uranus: tipped on its side (encounter)
    { from: auTo(19.2019), to: auTo(25), weight: 0.20 },         // 18 …departure

    // --- Neptune (Triton close behind — linear) -----------------------------
    { from: auTo(25), to: auTo(30.10), weight: 1.00 },           // 19 Cruise to Neptune
    // R_NEPTUNE_AU (30.10) was already the mark here too; same tightening
    // as Uranus, same reasoning (Neptune's radius is similar to Uranus's).
    { from: auTo(30.10), to: auTo(30.1019), space: 'linear', weight: 1.00 }, // 20 Neptune: the deepest blue (encounter)
    { from: auTo(30.1019), to: auTo(30.1024), space: 'linear', weight: 0.20 }, // 20 …departure
    // Triton's own mark used to sit 0.05 AU PAST Neptune's, then run all the
    // way to 39.5 AU (Pluto's own mark) — the widest overrun of the five.
    // Triton orbits Neptune, so its true heliocentric range is Neptune's own
    // ± a negligible fraction of an AU; marked immediately after Neptune's
    // own departure segment, same tightened scale — the visible body at this
    // beat is still Neptune's disc (Triton itself has no separate `planet`
    // layer), so the same radius-floor-vs-offset arithmetic applies.
    { from: auTo(30.1024), to: auTo(30.1043), weight: 0.90 },    // 21 Triton's nitrogen geysers (encounter)
    { from: auTo(30.1043), to: auTo(39.50), weight: 0.15 },      // 21 …departure

    // --- Pluto's distance, Pale Blue Dot -------------------------------------
    { from: auTo(39.50), to: auTo(40.50), weight: 1.05 },        // 22 Pluto's distance, and the Kuiper belt
    { from: auTo(40.50), to: auTo(60), weight: 1.35 },           // 23 The Pale Blue Dot

    // --- the heliosphere boundary --------------------------------------------
    { from: auTo(60), to: auTo(94), weight: 1.00 },              // 24 Sunlight fading toward starlight
    { from: auTo(94), to: auTo(121), weight: 1.15 },             // 25 The termination shock
    { from: auTo(121), to: auTo(130), weight: 1.20 },            // 26 The heliopause
    { from: auTo(130), to: auTo(166), weight: 1.05 },            // 27 Interstellar space

    // --- Voyager today, and the Golden Record (tight — linear) --------------
    { from: auTo(166), to: auTo(166.1), space: 'linear', weight: 1.10 },  // 28 Voyager 1, today
    { from: auTo(166.1), to: auTo(1000), weight: 1.10 },         // 29 The Golden Record

    // --- the Oort cloud and the closing frame --------------------------------
    { from: auTo(1000), to: auTo(20000), weight: 0.95 },         // 30 Deeper into the dark
    { from: auTo(20000), to: auTo(268000), weight: 1.05 },       // 31 The Oort cloud
    { from: auTo(268000), to: END, weight: 1.20 },               // 32 The Sun as just another star
  ],
};
