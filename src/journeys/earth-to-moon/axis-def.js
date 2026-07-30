import { MOON_D, CROSSOVER, overMoon, walked, formatDistance } from './distance.js';

// THE AXIS.
//
// Distance from Earth's surface, in metres, 1 m → MOON_D + 95 m. Monotonic by
// construction: the vehicle never comes back down, and the two orbital phases
// spend their scroll in the real altitude bands they occupied — a 185.5 × 190.6
// km parking orbit, and a lunar orbit that steps down 314 → 111 → 100 → 15 km.
// The axis never has to lie about a distance in order to stay ordered.
//
// WHY IT IS SEGMENTED. A pure log axis over 8.6 decades gives the ascent to
// orbit (5.3 decades, eleven minutes of flight) 62% of the scroll, and gives the
// entire lunar arrival — everything from "behind the Moon" to a boot on the
// ground — about one pixel, because those beats live inside the last 0.0001
// decades. A pure linear axis is the same defect mirrored: the pad, ignition,
// the tower and max-Q all land inside the first 0.004% of the page.
//
// WHY ONE SEGMENT PER BEAT. big-bang converged on this after two separate
// pacing defects, and the reason it is right is mechanical: a beat holds the
// scroll from its own mark to the next one, so with a boundary at every beat,
//
//     vh(beat i) = weight_i / Σweight × length
//
// exactly. Pacing becomes a column of numbers you can read off, re-weighting one
// beat cannot move any other beat's DISTANCE, and scripts/smoke.mjs gates the
// result in viewport-heights. Every beat here stages a scene — there is no era
// of abstract fields to coast through — so the floor is a flat 1.5 vh, not the
// two-tier arrangement big-bang needs.
//
// `space` is log where a segment crosses a decade or more and linear where it
// is a narrow band. The tail of the journey is almost entirely linear: from
// lunar orbit down, everything happens inside 0.08% of the axis value and log
// interpolation there is numerically pointless as well as editorially wrong.
export const axisDef = {
  kind: 'segments',
  unit: 'm',
  label: '',
  format: formatDistance,
  segments: [
    // --- the pad and the ascent ------------------------------------------
    // The floor is 1 m, not 0: log space cannot reach zero, and one metre is
    // about what the stack rises before the hold-down arms are clear. Ignition
    // sits at 4 m, which is where it is actually moving.
    { from: 1, to: 4, weight: 1.00 },              // 1  The pad
    { from: 4, to: 110, weight: 1.25 },            // 2  Ignition — an event, +25%
    { from: 110, to: 2.0e3, weight: 1.00 },        // 3  The tower clears
    { from: 2.0e3, to: 1.37e4, weight: 0.90 },     // 4  Through the cloud deck
    { from: 1.37e4, to: 3.5e4, weight: 1.10 },     // 5  Max Q
    { from: 3.5e4, to: 6.7e4, weight: 0.90 },      // 6  The sky goes out
    { from: 6.7e4, to: 9.5e4, weight: 1.25 },      // 7  Staging — an event
    { from: 9.5e4, to: 1.40e5, weight: 0.85 },     // 8  The escape tower goes
    { from: 1.40e5, to: 1.855e5, weight: 0.95 },   // 9  The second stage

    // --- the parking orbit -------------------------------------------------
    // 185.5 × 190.6 km is Apollo 11's actual parking orbit, and three beats have
    // to live inside those five kilometres. On a log axis they are 0.012 decades
    // apart and would share a few hundred pixels; LINEAR segments with ordinary
    // weights give each of them two viewport-heights without moving an altitude.
    // Same trick as big-bang's dedicated Chicxulub window, applied to a band
    // rather than to an instant.
    // 10 Cut-off — now carries the orbital-mechanics copy that used to have its
    // own beat three kilometres higher up the same orbit. Its weight is the sum
    // of the two, so the explanation still gets the scroll it needs to be read.
    { from: 1.855e5, to: 1.905e5, space: 'linear', weight: 2.05 }, // 10 Cut-off
    { from: 1.905e5, to: 1.95e5, space: 'linear', weight: 0.95 },  // 12 Sixteen sunrises

    // --- translunar coast --------------------------------------------------
    { from: 1.95e5, to: 6.0e6, weight: 1.20 },     // 13 Translunar injection
    { from: 6.0e6, to: 2.5e7, weight: 1.00 },      // 14 Turnaround
    { from: 2.5e7, to: 8.0e7, weight: 1.05 },      // 15 The whole Earth
    // One segment for what used to be three beats — see the note in beats.js.
    // The weight is the sum of the three it replaces minus a little, because a
    // stretch with one small subject in it should not also be the longest scroll
    // in the journey: it now reads as a genuine gap between two worlds rather
    // than as three separate stops at the same view.
    { from: 8.0e7, to: 3.70e8, weight: 2.20 },     // 16 Nothing to push against
    { from: 3.70e8, to: overMoon(3.14e5), weight: 1.10 }, // 19 The Moon becomes a place

    // --- lunar orbit and the descent ---------------------------------------
    // All linear. Between arrival and touchdown the axis value changes by 0.08%,
    // so these segments are carrying the whole arrival on their weights alone —
    // which is exactly the control the impact beat in big-bang needed.
    { from: overMoon(3.14e5), to: overMoon(1.11e5), space: 'linear', weight: 1.05 }, // 20 Behind the Moon
    { from: overMoon(1.11e5), to: overMoon(1.00e5), space: 'linear', weight: 1.15 }, // 21 Earthrise
    { from: overMoon(1.00e5), to: overMoon(1.5e4), space: 'linear', weight: 0.95 },  // 22 The terminator
    { from: overMoon(1.5e4), to: overMoon(2.3e3), space: 'linear', weight: 1.10 },   // 23 Powered descent
    { from: overMoon(2.3e3), to: overMoon(1.5e2), space: 'linear', weight: 1.00 },   // 24 Pitchover
    { from: overMoon(1.5e2), to: MOON_D, space: 'linear', weight: 1.10 },            // 25 Sixty seconds

    // --- the surface -------------------------------------------------------
    // The axis continues PAST the Moon's surface as distance walked from the
    // ladder. Without that, the last three beats are all at zero altitude and
    // collide on the axis end — and "contact", "a bootprint" and "the Earth does
    // not rise here" are three different pictures, not one.
    { from: MOON_D, to: walked(9), space: 'linear', weight: 1.20 },   // 26 Contact
    { from: walked(9), to: walked(55), space: 'linear', weight: 1.00 }, // 27 One boot
    { from: walked(55), to: walked(95), space: 'linear', weight: 1.15 }, // 28 The Earth does not rise here
  ],
};
