import meta from './meta.js';
import { defineJourney } from '../../engine/journey.js';
import { makeAxis } from '../../engine/axis.js';
import { beats } from './beats.js';
import { makeLayers } from './layers.js';
import { axisDef } from './axis-def.js';
import { length } from './pacing.js';
import { MOON_D, CROSSOVER, R_EARTH, TOTAL, overMoon, walked } from './distance.js';
import { plog, plin } from './curve.js';
import { aimCamera } from '../../kit/camrig.js';

// A local copy of the axis so layer bounds, the scale law and the camera can be
// keyed on real DISTANCES rather than hand-computed u values — which keeps them
// in sync automatically when a segment weight is re-tuned.
const A = makeAxis(axisDef);
const uAt = (m) => A.toU(m);
const dAt = (u) => A.toValue(u);

// Interpolate between two beats' u positions. The axis carries one segment per
// beat, so a scale key placed at a beat's own distance is already MOVING by the
// time that beat is on screen — and shots.mjs samples 45% in. `mid(a, b, f)`
// puts a hold key part-way through a beat, which is how "hold the frame across
// the beat, then move in the gap" is expressed when the gap and the beat are
// the same interval.
const mid = (a, b, f) => uAt(a) + f * (uAt(b) - uAt(a));

// THE SCALE LAW.
//
// Frame width in metres (divided by 4 at the bottom of this file to give metres
// per world unit). For the whole free-flight phase it is not invented — it is
//
//     frame = 0.571 × min(R_EARTH + d, TOTAL - R_EARTH - d)
//
// i.e. "frame the nearer body at about seven world units". Because the camera
// sits six units out, a body seven units away renders at very close to its true
// angular size, and because the ratio radius/distance is fixed by the real
// geometry, Earth SHRINKS at exactly the rate it should. The law peaks at the
// geometric midpoint (1.858e8 m, frame 1.097e8) and is continuous through it,
// which is why the mid-coast beats look like what they are: two small worlds
// and a ship.
//
// The two ends leave the law: on the pad the frame is a hundred metres wide and
// Earth's centre is six thousand kilometres away (so the ground is a terrain,
// not a planet), and at the Moon the same thing happens in reverse.
const SCALE = [
  // --- the pad and the ascent ---------------------------------------------
  // 130 m puts the 110 m stack at about half the frame height, ~470 px tall.
  // 172 m, not 130: the stack is 110 m and the service tower beside it is 106 m
  // plus a crane head, so a 130 m frame cropped both. Wide enough that the pad
  // reads as a place with a vehicle on it rather than as a close-up of a tube.
  [uAt(1), 172],
  [mid(1, 4, 0.6), 172],
  [uAt(4), 185],            // a little wider: the plume needs room under it
  [mid(4, 110, 0.5), 210],
  [uAt(110), 420],
  [uAt(2.0e3), 7.0e3],
  // Through the ascent the frame runs at roughly 3.6 × altitude, which is what
  // holds the ground about one world unit below the ship: the horizon stays put
  // while the detail on it gets coarser, and that reads as climbing rather than
  // as zooming out.
  [uAt(1.37e4), 5.0e4],
  [uAt(3.5e4), 1.4e5],
  [uAt(6.7e4), 2.6e5],
  // Held across staging. An event beat cannot also be a travelling beat — the
  // separation and the retro flash have to happen in one steady frame.
  [mid(6.7e4, 9.5e4, 0.65), 2.9e5],
  [uAt(9.5e4), 5.0e5],
  [uAt(1.40e5), 1.6e6],

  // --- orbit ---------------------------------------------------------------
  // 0.571 × (R_EARTH + d) from here. At 185 km that is 3.74e6 m: Earth's centre
  // sits 7.0 units below with a radius of 6.8, so the limb subtends about 95°
  // and fills the lower frame. (True from that altitude is 137°; the camera's
  // six-unit standoff is the entire difference, and it is the same compromise
  // big-bang makes for every close body.)
  [uAt(1.855e5), 3.74e6],
  [mid(1.855e5, 1.88e5, 0.7), 3.76e6],
  [uAt(1.905e5), 3.78e6],
  [uAt(1.95e5), 3.80e6],

  // --- the coast -----------------------------------------------------------
  // Earth is BELOW the ship and the Moon is ABOVE it, which means they are 180°
  // apart and no frame can ever hold both at a useful size. So every coast beat
  // picks one, and the frame is set for THAT body at the beat's own midpoint:
  //
  //   k = body distance in world units.  Angular size comes out at
  //   k / sqrt(k² + 6.3²) of the true value, because the camera stands six
  //   units off the ship rather than sitting in it. k = 3 gives 44% of truth
  //   and keeps the SHIP in frame beside the body; k = 7 gives 74% and fills
  //   the frame with the body alone.
  //
  // Beats 14 and 16 are about the ship (a docking, and a coast with nothing in
  // it) so they run at k ≈ 3. Beats 15, 17, 18, 19 are about a world, so they
  // run at k ≈ 7 with the aim swung onto it.
  //
  // Each value is held to 75% of its beat and then moves, because with one
  // segment per beat there is no gap between beats to travel in — a key placed
  // at a beat's mark is already sliding by the time the beat is on screen, and
  // shots.mjs samples 45% in.
  // THE COAST IS A FORMULA, NOT AN ANCHOR TABLE — and that is the whole fix.
  //
  // The law at the top of this file was right and the table did not implement
  // it. Each coast beat got ONE frame value, anchored at that beat's starting
  // distance and held while the distance grew, so k = 4d/frame drifted from 7
  // down to 2 inside a single beat. The consequence, measured: Earth rendered
  // at roughly the same 20° disc at 25,000 km and at 260,000 km — the frame
  // widened at exactly the rate that cancelled the shrinking. Four consecutive
  // beats scored 0.025–0.052 occupancy and adjacent distances of 0.4–1.7, i.e.
  // four captions over one picture, and the single most dramatic thing the
  // coast has to show — a world receding until it is a marble — was being
  // actively normalised away by its own scale law.
  //
  // Sampling the real formula densely fixes it, and the numbers are physics
  // rather than taste. Apparent diameter is 2·atan(R/d) reduced by the camera's
  // six-unit standoff (k/sqrt(k²+6.3²) = 0.74 at k = 7):
  //
  //     d = 6.0e6 m   Earth 93° true → 69° on screen, filling the frame
  //     d = 2.5e7 m   Earth 29° → 21°
  //     d = 8.0e7 m   Earth  9° →  6.7°
  //     d = 2.6e8 m   Earth 2.8° → 2.1°, a marble
  //
  // and past the crossover the same law runs on the Moon's distance instead, so
  // it grows on exactly the same curve it shrank on.
  ...[1.95e5, 4.0e5, 1.0e6, 2.5e6, 6.0e6, 1.2e7, 2.5e7, 5.0e7, 8.0e7,
      1.4e8, 2.0e8, 2.6e8, 3.0e8, 3.25e8, CROSSOVER, 3.52e8, 3.62e8, 3.70e8]
    .map((d) => [uAt(d), 0.571 * Math.min(R_EARTH + d, TOTAL - R_EARTH - d)]),
  [mid(3.70e8, overMoon(3.14e5), 0.75), 0.571 * (TOTAL - R_EARTH - 3.70e8)],

  // --- lunar orbit ---------------------------------------------------------
  [uAt(overMoon(3.14e5)), 1.17e6],
  [uAt(overMoon(1.11e5)), 1.06e6],
  [mid(overMoon(1.00e5), overMoon(1.5e4), 0.6), 1.02e6],

  // --- the descent ---------------------------------------------------------
  // Five decades in five beats. Each one holds past its own midpoint and then
  // falls, so every review frame is a composed picture rather than a blur.
  [uAt(overMoon(1.5e4)), 6.0e4],
  [mid(overMoon(1.5e4), overMoon(2.3e3), 0.6), 5.2e4],
  [uAt(overMoon(2.3e3)), 9.0e3],
  [mid(overMoon(2.3e3), overMoon(1.5e2), 0.6), 7.0e3],
  [uAt(overMoon(1.5e2)), 90],
  [mid(overMoon(1.5e2), MOON_D, 0.6), 78],
  // 45 m is where a real 7 m lander is 17% of the visible width — about 250 px
  // — with the dust sheet and the footpads both in frame.
  [uAt(MOON_D), 45],
  [mid(MOON_D, walked(9), 0.6), 42],
  // …and then the dive. A print is a few millimetres of relief: at a 0.85 m
  // frame the visible ground is 2.2 m across and a 0.3 m print is ~200 px with
  // legible ridges, which is the only framing in which this beat means anything.
  [uAt(walked(9)), 0.85],
  [mid(walked(9), walked(55), 0.65), 0.85],
  // Back out to a person standing on the ground, with Earth in the sky. At 16 m
  // a 1.8 m figure is ~75 px and Earth is drawn at its true two degrees.
  [uAt(walked(55)), 16],
  [1, 17],
];

// Vertical framing. The camera aims at the origin — the spacecraft — by
// default; raising or lowering the target tips the view toward whichever body
// the beat is about. Earth is BELOW and the Moon is ABOVE, so LOOK_Y is
// negative to look back and positive to look ahead.
const LOOK_Y = [
  [uAt(1), 0.25],
  [uAt(110), 0.15],
  // Look DOWN through the cloud beat. The deck sits at a real 2 km and the ship
  // passes above it, so aimed at the horizon the whole layer compresses into a
  // band at the skyline and reads as haze — measured: the deck was mounted,
  // visible and at 0.86 opacity while being effectively invisible on screen.
  // A cloud deck is a FLOOR at this point in the flight, and the beat's own
  // copy says the tops fall away underneath, so the camera has to be looking at
  // them.
  [uAt(2.0e3), -0.40],
  [uAt(9.0e3), -0.30],
  [uAt(1.37e4), 0.10],
  // Staging wants SKY behind it, not ground: the separation flash and the
  // debris ring have to sit against black to read as an event in vacuum.
  [uAt(6.7e4), 0.42],
  [uAt(1.40e5), 0.20],
  // Off the limb: aimed at the origin the ship sits ON the planet and the two
  // read as one silhouette. Tipping up puts sky behind it.
  [uAt(1.855e5), 0.35],
  [uAt(1.95e5), 0.30],
  // The coast. The aim swings between the two bodies beat by beat, because they
  // are in opposite directions and each beat is about one of them. A body k
  // units away sits atan(k / 6.3) off the axis, so with k ≈ 7 the aim has to go
  // to about ±5 to bring it to the centre of the frame — which does push the
  // ship out, and that is the right trade on a beat whose subject is a world.
  // Beat 14 is the one coast beat whose subject is the SHIP — the turnaround
  // and docking — so it aims near the origin and lets a still-huge Earth fill
  // the bottom of the frame behind it. Three planes in one shot: ship, planet,
  // stars.
  [uAt(6.0e6), -0.9],
  [mid(6.0e6, 2.5e7, 0.75), -1.2],
  // From here the subject is a WORLD, and with k now genuinely pinned at 7 the
  // aim has to stay on it. The old table alternated back toward the origin for
  // beats 16 and 17 because those beats were framed at k ≈ 3, where the ship
  // and the planet could share a shot. At k = 7 the ship sits ~48° off the aim
  // axis, outside a 55° frame — so aiming at the origin now buys nothing and
  // costs the planet. Held steady instead: the beats differ by the SIZE of
  // Earth, which is the actual story, not by where the camera points.
  [uAt(2.5e7), -4.8],
  // Beat 15 is the long empty coast, and by here Earth is ~2° — small enough
  // that aiming hard at it costs the ship for nothing. Easing the aim back
  // toward the origin puts the marble low in frame AND the spacecraft in it,
  // which is the composition that beat wanted all along.
  [uAt(8.0e7), -2.1],
  [uAt(2.6e8), -4.8],
  [mid(2.6e8, CROSSOVER, 0.6), -4.8],
  // The swing to the Moon happens at the crossover, which is also where the
  // scale law hands over — one gesture, not two.
  [uAt(CROSSOVER), 4.8],
  [uAt(3.70e8), 5.0],
  [mid(3.70e8, overMoon(3.14e5), 0.75), 4.6],
  // In lunar orbit the Moon is 7 units up with a radius of ~6, so its limb
  // already reaches down to within a unit of the ship: a small aim puts the
  // surface across most of the frame with black sky above it.
  [uAt(overMoon(3.14e5)), 1.5],
  [uAt(overMoon(1.11e5)), 1.2],
  [uAt(overMoon(1.00e5)), 0.6],
  // The descent looks DOWN. This is the only stretch of the journey where the
  // subject is under the ship rather than beside it.
  [uAt(overMoon(1.5e4)), -0.30],
  [uAt(overMoon(2.3e3)), -0.25],
  [uAt(overMoon(1.5e2)), -0.15],
  [uAt(MOON_D), -0.10],
  // Over the boot, looking STEEPLY down. A print lies flat on the ground, and
  // a flat surface seen at a grazing 15° is foreshortened to a sliver — the
  // first version put the camera 0.4 m up and the ridges were three pixels of
  // stripe. This is a 38° look-down, which is where a print reads as a print.
  [uAt(walked(9)), -1.6],
  [uAt(walked(55)), 0.30],   // eye level, sky above the horizon
  [1, 0.30],
];

// Horizontal framing. The copy panel owns the lower left of every frame, so the
// ship is pushed right of centre. Applied as a pan (translate after aiming), so
// the subject slides without rotating.
const PAN = [
  [uAt(1), 0.6],
  [uAt(110), 0.9],
  [uAt(1.37e4), 1.0],
  [uAt(1.855e5), 0.9],
  // Once the roll lays the travel axis across the frame, the DEPARTED world
  // sits on the left — which is where the copy panel is. That collision is
  // structural, not incidental: origin-left is what makes the journey read in
  // the same direction as the ribbon, so the panel and the planet want the same
  // corner. Panning the whole composition right resolves it without giving up
  // the reading direction, and the destination side loses nothing because what
  // is off the right edge is empty space the ship has not reached yet.
  [uAt(6.0e6), 2.6],
  [uAt(2.5e7), 2.8],
  [uAt(8.0e7), 2.8],
  [uAt(3.70e8), 1.6],
  [uAt(overMoon(1.11e5)), 0.8],
  [uAt(overMoon(1.5e4)), 0.9],
  [uAt(MOON_D), 0.7],
  [uAt(walked(9)), 0.4],
  [1, 0.9],
];

// THE CAMERA.
//
// Almost all travel is done by the scale law, so the camera sits five to six
// units out for the whole journey and lets the world change size around it.
//
// Height is in UNITS, and units scale with the frame: the height in metres is
// y × frameMeters / 4. That number is the reason for the two extremes here —
// 0.92 units on the pad is 30 m up, a third of the way along a 110 m stack,
// and 0.11 units on the lunar surface is 1.5 m, which is eye level. Getting
// this wrong is how big-bang spent its entire human era shooting from a
// first-floor window.
const CAM = [
  [uAt(1), [0, 0.92, 6.2]],
  [uAt(110), [0, 0.50, 6.0]],
  [uAt(2.0e3), [0, 0.35, 6.0]],
  [uAt(1.37e4), [0, 0.25, 6.0]],
  [uAt(6.7e4), [0, 0.30, 6.1]],   // staging: two objects need the width
  [uAt(1.40e5), [0, 0.35, 6.1]],
  [uAt(1.855e5), [0, 0.40, 6.2]],
  [uAt(2.5e7), [0, 0.20, 6.3]],
  [uAt(1.858e8), [0, 0.00, 6.4]],
  [uAt(3.70e8), [0, 0.15, 6.2]],
  [uAt(overMoon(1.11e5)), [0, 0.25, 6.0]],
  [uAt(overMoon(1.5e4)), [0, 0.60, 6.0]],
  [uAt(overMoon(1.5e2)), [0, 0.90, 5.8]],
  // 1.33 units at a 45 m frame is 15 m above the ground — a camera standing
  // back from a lander that is 7 m tall.
  [uAt(MOON_D), [0, 1.33, 6.0]],
  [uAt(walked(9)), [0, 2.60, 5.4]],
  // 0.38 units at a 16 m frame is 1.5 m. Anything higher and a figure sits
  // below the horizon, against grey ground instead of against black sky —
  // and on the Moon the sky is the only contrast there is.
  [uAt(walked(55)), [0, 0.38, 6.0]],
  [1, [0, 0.38, 6.0]],
];

// THE BEARING — degrees about the world Y axis.
//
// Unusually for this project, it is nearly free here. Everything in the journey
// is placed ON the Y axis (Earth below, the Moon above, the ship at the origin),
// so rotating about Y does not slide a single composition — it only changes
// which side of the ship the sun is on and how the starfield parallaxes.
// big-bang had to pin this at 0 from the protoplanetary disc onward precisely
// because its compositions were off-axis; this one can use it.
//
// It is still AUTHORED and not clocked. The frame a reader gets for a beat must
// not depend on how long the tab has been open (rule 8), and two review shots
// of the same u must be the same picture (rule 9).
const AZIMUTH = [
  [uAt(1), -22],       // three-quarter view of the stack — a tower needs depth
  [uAt(110), -14],
  [uAt(1.37e4), -8],
  [uAt(6.7e4), -4],
  [uAt(1.855e5), 0],
  [uAt(2.5e7), 6],
  [uAt(1.858e8), 12],  // free parallax across the empty middle
  [uAt(3.70e8), 4],
  [uAt(overMoon(1.11e5)), 0],
  [1, 0],
];

// THE ROLL — where the travel axis lands on screen, in degrees about the view
// axis. This is the composition decision the journey originally made by
// accident and got wrong.
//
// Earth sits at -y and the Moon at +y, so the flight path is a line along the
// world Y axis. With no roll that line runs straight UP the frame: the
// trajectory is a vertical stripe, the ship never crosses anything, the two
// worlds are 180° apart at the top and bottom of the view, and every coast beat
// has to pick one and lose the other. It also puts the departed planet directly
// underneath the copy panel.
//
// Rolling to 90° lays that same line ACROSS the frame — Earth off to the left,
// the Moon off to the right, the ship travelling between them, reading in the
// same direction as the ribbon and as rule 5's "horizontal journey out". No
// object moves; only the camera turns.
//
// The ROLL IS ALSO THE STORY at the point it happens. On the pad and through
// the atmosphere, down is not arbitrary — the ground is at -y, gravity points
// that way, and a rolled horizon would simply look broken. So the roll stays at
// 0 for the whole ascent and comes in as the ship leaves the atmosphere and
// enters orbit, which is exactly the moment a crew stops having a floor. The
// world tipping over is the transition from being ON a planet to travelling
// BETWEEN two of them.
const ROLL = [
  [uAt(1), 0],
  [uAt(6.7e4), 0],        // still an atmosphere, still a horizon
  [uAt(1.855e5), 62],     // orbit: the floor goes
  [uAt(6.0e6), 90],       // the coast reads left to right
  [uAt(3.70e8), 90],
  // …and back, because the descent has a floor again. The lunar surface is a
  // ground plane at -y like any other, and the last beats are a person standing
  // on it.
  [uAt(overMoon(1.11e5)), 40],
  [uAt(overMoon(1.5e4)), 0],
  [1, 0],
];

export default defineJourney({
  ...meta,
  axis: axisDef,
  length,
  stageOptions: {
    background: 0x010206,
    // Same reasoning as big-bang: a zero threshold blooms the dim points too,
    // and a field of thousands of additive sprites turns the frame white. The
    // things that should glare here are the exhaust, the sun and the Earth.
    bloom: { strength: 0.55, radius: 0.5, threshold: 0.45 },
    fov: 55,
    // A real sun, and real shadows. This journey's subject is HARDWARE — a
    // launch vehicle on a tower, a lander on legs — and hardware is the one
    // thing the emissive-and-bloom stage could not draw convincingly. Matched
    // to `SUN` in layers.js so the rocket is lit from the same direction as
    // the sky and the ground it stands on.
    sun: { dir: [0.72, 0.12, 0.62], intensity: 3.4, ambient: 0.55, radius: 3.4 },
  },

  scaleAt: (u) => plog(SCALE, u) / 4,

  // Delegates to the shared rig (src/kit/camrig.js). Same math as before —
  // position, azimuth about Y, lookAt(0, LOOK_Y, 0), pan after aiming — just
  // factored out so Earth→Mars (which needs an off-axis look-target: the Sun,
  // an evening-star Earth) does not reinvent it. Passing `lookAt: [0, y, 0]`
  // reproduces this journey's original behaviour exactly.
  camera(u, cam) {
    aimCamera(cam, {
      pos: plin(CAM, u),
      azimuthDeg: plin(AZIMUTH, u),
      lookAt: [0, plin(LOOK_Y, u), 0],
      pan: plin(PAN, u),
      rollDeg: plin(ROLL, u),
    });
  },

  beats,
  layers: makeLayers(uAt, dAt),
});
