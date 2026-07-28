import meta from './meta.js';
import { defineJourney } from '../../engine/journey.js';
import { makeAxis } from '../../engine/axis.js';
import { beats } from './beats.js';
import { makeLayers } from './layers.js';
import { ago, after } from './time.js';
import { axisDef } from './axis-def.js';
import { length } from './pacing.js';
import { plog, plin } from './curve.js';

// A local copy so layer bounds, the scale law and the camera can all be keyed
// on real times rather than hand-computed u values — which keeps them in sync
// automatically when a segment weight is re-tuned.
const A = makeAxis(axisDef);
const uAt = (seconds) => A.toU(seconds);
const tAt = (u) => A.toValue(u);

// THE SCALE LAW.
//
// Metres per world unit, i.e. how much universe the frame is looking at. This
// is the second narrative track, running underneath the axis: the frame opens
// smaller than a proton, inflates to the whole observable universe, then dives
// twelve decades back down into one galaxy, one star, one planet.
//
// The value at the end of inflation is not invented — a region that had been
// sub-nuclear really is about a tenth of a metre across by then.
const SCALE = [
  [uAt(1e-44), 1e-34],
  [uAt(1e-32), 1e-1], // post-inflation: the observable universe, grapefruit-sized
  [uAt(1), 1.2e17],
  [uAt(after(380e3)), 4.0e23], // last scattering
  [uAt(after(180e6)), 2.0e24],
  [uAt(after(1e9)), 8.0e24],
  [uAt(after(5e9)), 3.0e25], // widest — the cosmic web
  [uAt(ago(5e9)), 2.5e25],
  // The dive, staged so each subject gets a frame it actually fills: the
  // Milky Way's disc is ~9.5e20 m across, so 1.2e21 is where it fills the
  // view. Racing straight from 2.5e25 to the protoplanetary disc flew past
  // the galaxy in a fraction of a percent of scroll.
  [uAt(ago(4.85e9)), 1.2e21], // the galaxy fills the frame
  // Held to 4.64 Gyr — past the MIDPOINT of the beat it belongs to. The disc is
  // fixed at its real 9.5e20 m, so it leaves the rebase band as soon as the
  // frame passes ~1e19; leaving at 4.72 meant "Our galaxy" rendered as a black
  // screen with a caption about a barred spiral on it.
  [uAt(ago(4.64e9)), 9.0e20],
  [uAt(ago(4.60e9)), 4.0e18], // into a star-forming cloud
  [uAt(ago(4.58e9)), 8.0e14],
  [uAt(ago(4.568e9)), 3.0e13], // the protoplanetary disc, ~200 AU
  // Held across the disc's own beat. Plunging earlier meant that beat spent its
  // entire scroll travelling away from its subject — by the time the copy was
  // readable the disc was four decades behind and off-band.
  [uAt(ago(4.548e9)), 2.8e13],
  // Then six decades of collapse, as a single fall. This used to happen between
  // 4.522 and 4.512 Gyr ago, and the segment retune shows why that read as a
  // blink: 10 Myr in this part of the axis is half a viewport-height, so the
  // whole formation of the solar system went past in about 400 pixels. Widened
  // to 35 Myr, it gets roughly a screen and a half — a fall you can watch.
  //
  // 4.2e7 m is the frame where the true Earth–Moon system of 4.5 Gyr ago fits
  // with both bodies at a readable size: Earth ~460 px across at 1440 wide, the
  // Moon ~125 px at its real distance of four Earth radii, which is where it was.
  [uAt(ago(4.513e9)), 4.2e7],
  // Held dead still through the approach and the strike. An event beat cannot
  // also be a travelling beat — those two phases have to happen in one steady
  // frame or neither registers.
  [uAt(ago(4.500e9)), 4.2e7],
  // Then close in for the coalescence. At 4.2e7 the finished Moon is 45 px
  // across, which is not a body, it is a dot; at 2.6e7 it is ~75 px with a
  // readable terminator and still sits at its true early distance of four Earth
  // radii. Those two constraints fight — putting the Moon at a comfortable 120
  // px would mean moving it to a distance it never had, and the copy is
  // explicitly about how close it was, so the distance wins.
  [uAt(ago(4.470e9)), 2.6e7],
  [uAt(ago(4.45e9)), 2.6e7],
  [uAt(ago(4.4e9)), 1.7e7], // Earth fills the frame — "Oceans" opens on the globe

  // --- down to the water -----------------------------------------------------
  // The frame used to sit at 1.7e7 m from here all the way to 60 Myr ago: nine
  // beats, no scale change, nine near-identical globes. Copy about stromatolites
  // and mitochondria over a static sphere is the whole "captions don't match"
  // problem in one line of table.
  // Held to 4.20 Gyr, which is most of the "Oceans" beat. The zircon evidence
  // the copy cites is planetary, so the beat should open on the planet — and
  // then fall to the water it is actually about.
  [uAt(ago(4.20e9)), 1.7e7],
  [uAt(ago(3.95e9)), 260],   // fall to the surface of a young sea
  [uAt(ago(3.75e9)), 200],   // held: rain, steam, a hot sky
  [uAt(ago(3.62e9)), 3.2],   // down among the stromatolites for "Life"
  [uAt(ago(2.55e9)), 3.2],   // held across the whole of that beat
  [uAt(ago(2.30e9)), 9],     // "Oxygen catastrophe" opens on bubble columns
  [uAt(ago(2.10e9)), 40],    // held in the shallows for most of the beat
  [uAt(ago(1.95e9)), 2.6e3], // …then pulls out as the sky changes colour
  [uAt(ago(1.75e9)), 2.0e3],
  // The showcase: eight decades down, into a single cell. Nothing else in the
  // journey asks the rebaser for this much in one move.
  [uAt(ago(1.35e9)), 2.0e-5],
  [uAt(ago(680e6)), 2.0e-5], // held across "Cells within cells"
  [uAt(ago(620e6)), 6],      // back out to the Ediacaran seafloor

  // A scale window must span both beats it serves END TO END, not just their
  // `at` marks — a beat occupies the scroll from its own position to the NEXT
  // one, so a window centred on 538 Mya is already gone by the time the
  // Cambrian copy is on screen. 6 m is the frame where a 0.8 m animal reads as
  // an animal; at 60 m it is twenty pixels of nothing.
  [uAt(ago(484e6)), 6],   // …and held through the Cambrian

  // --- out of the water, and never back to orbit -----------------------------
  // This used to jump straight back to 1.7e7 — an orbital globe — and hold it
  // from 474 Mya to 60 Mya. Nine beats about life on Earth, told from the
  // International Space Station. "Life leaves the water", "The Great Dying" and
  // "Ten kilometres of rock" all rendered as the same distant sphere.
  //
  // Now the frame stays on the ground. The widening from 6 m to 150 m IS the
  // camera rising out of the sea: the camera sits at a fixed 0.34 world units,
  // so as metres-per-unit grows it climbs from 1.3 m below the surface to
  // 13 m above it, and the waterline crosses the frame on the way. Travel by
  // scale law, exactly as the cosmological half does it.
  [uAt(ago(472e6)), 15],     // shallow water, the bottom still in reach
  [uAt(ago(452e6)), 30],     // rising; the surface is about to cross
  [uAt(ago(420e6)), 70],     // a shore
  [uAt(ago(380e6)), 150],    // the first forests
  [uAt(ago(300e6)), 1.2e3],  // coal swamps to the horizon
  [uAt(ago(256e6)), 1.8e4],  // the Siberian traps, from altitude
  [uAt(ago(200e6)), 2.2e4],
  [uAt(ago(80e6)), 3.0e4],
  // Dead still for the approach AND the strike. The impact now owns its own
  // linear segment, so these three rows are roughly four viewport-heights of
  // scroll in one unmoving frame — which is what an event beat needs and what
  // the previous version, travelling the whole time, could not give it.
  // 1.2e4, not 3.0e4. The camera sits six units out, so at a 30 km frame it is
  // 180 km from the impact and the whole event is a glow on a distant plain.
  // At 12 km the fireball straddles the horizon and the ejecta crosses the
  // frame — still inside the ground disc's radius/6 rule with room to spare.
  [uAt(ago(66.2e6)), 1.2e4],
  [uAt(ago(65.96e6)), 1.2e4],
  // Then the pull-back watches the wave spread. Capped near 3.3e4: the ground
  // disc is 2.0e5 m and the camera sits six units out, so anything past
  // radius/6 puts the camera beyond the terrain's own edge and the world
  // becomes a saucer floating in the frame.
  [uAt(ago(65.9e6)), 3.0e4],
  // …then settle back down and STAY down. The old table climbed to 1.1e6 here
  // because it was arriving from orbit.
  [uAt(ago(56e6)), 2.6e4],
  // Down to 5 km for the recovery. The ground is a 30 km disc, and a frame
  // wider than about a fifth of that puts its EDGE inside the view — which
  // renders as a hilltop dome with the sky wrapping under it, not as a
  // landscape. Roughly: keep the frame under a sixth of the terrain radius.
  [uAt(ago(46e6)), 7.0e3],

  // --- the descent -----------------------------------------------------------
  // Ground level holds through the whole human story, then the final gap pulls
  // back out to orbit so "Today" ends where "Oceans" was — same planet, now
  // with city lights.
  [uAt(ago(22e6)), 5.0e3],
  [uAt(ago(8.5e6)), 6.0e3],
  // Down to EYE LEVEL for the hominin beats. These used to be aerials at 2e4 m,
  // where a tree is sub-pixel and a person is a fifth of one — which is why
  // "A branch splits", a beat about upright apes, was an empty field at night.
  //
  // The visible width is ~2.6× frameMeters (the camera sits 6 units out with a
  // 55° FOV on a 16:9 frame), so 60 m here means about 160 m across: a 1.7 m
  // figure is 15 px and a 10 m tree is 90. That is the scale at which a
  // silhouette reads as a body rather than as a speck.
  [uAt(ago(6.4e6)), 62],     // woodland: the split from chimpanzees
  [uAt(ago(2.6e6)), 55],     // held across the beat
  [uAt(ago(1.9e6)), 70],     // the fire
  [uAt(ago(700e3)), 66],
  // "Us" is a beat about PEOPLE — several kinds of human alive at once — so it
  // stays at the scale a person reads at. At 220 m it sat in the dead zone
  // between the two terrains, past the trees and past the figures, and rendered
  // as three dots of firelight on a black plain.
  [uAt(ago(330e3)), 78],     // wider: three camps
  [uAt(ago(120e3)), 88],
  // "Out of Africa" was a 14 km NIGHT AERIAL, which is two defects at once: the
  // ground disc is 30 km, so the camera sat at 84 km — twice outside its own
  // world — and at that width a person is a third of a pixel, so the only thing
  // that could be drawn was fires. It rendered as what it was: a scatter of dots
  // on black. The migration is now told at the scale of the people doing it, and
  // the spread is carried by a chain of camps running back to the horizon.
  // 60 m, not 105: at 105 a 1.7 m walker is nine pixels, which is a speck with
  // a rim light on it. The chain of camps carries the distance instead.
  [uAt(ago(80e3)), 38],
  [uAt(ago(24e3)), 34],
  // Farming opens from the air, on the patchwork — the shape of the change —
  // and then goes down INTO the crop, which is where the beat's own midpoint
  // (8.8 kyr) now sits. One reading is the pattern on the land, the other is
  // people bent over a field; the beat is about both and had neither.
  [uAt(ago(13e3)), 1.6e3],
  [uAt(ago(11e3)), 1.5e3],
  [uAt(ago(9.6e3)), 46],
  [uAt(ago(7.2e3)), 42],
  // "The wheel" was a 430 m village at dusk: true, and it showed no wheel. A
  // cart at 40 m is a rimmed circle eighty pixels across, which is the one
  // shape this beat has to deliver.
  [uAt(ago(6.2e3)), 24],
  [uAt(ago(5.4e3)), 27],
  // "Writing" is the smallest subject in the journey after the cell, and it was
  // being told at 700 m — a city, with the marks that are the entire point of
  // the beat some four decades below the pixel grid. So the journey does what it
  // already did for a living cell and dives: at a 1.5 m frame a clay tablet is a
  // third of the screen and the wedges are legible. Held across the midpoint
  // (1.16 kyr), which is what makes it the beat rather than a moment in it.
  [uAt(ago(4.2e3)), 0.85],
  [uAt(ago(900)), 0.85],
  // Machines. Also four decades too far out before — a 7 km frame makes a 40 m
  // chimney six pixels, so the industrial revolution was a grey smudge with
  // lights in it. At 280 m the mills have walls and the chimneys have plumes.
  [uAt(ago(400)), 280],
  [uAt(ago(30)), 300],
  // The pull-back transits the awkward middle distances fast: between the city
  // and the globe there is nothing to look at but the dark flank of the planet,
  // so those years get the least scroll.
  [uAt(ago(16)), 9.0e3],
  [uAt(ago(9)), 6.0e6],
  [1, 1.9e7],                // in orbit for Today
];

// Horizontal framing. The copy panel owns the lower left of every frame, so
// object-centric beats push their subject right of centre; field beats fill the
// frame and stay centred. Applied as a camera pan (translate after aiming), not
// as a change of target, so the subject does not rotate as it slides.
// Vertical framing. The camera aims at the origin by default, which for a
// ground-level scene puts the horizon dead centre and fills the lower half of
// the frame with bare floor. Raising the look target tips the view up, trading
// empty ground for the water (or sky) where the subject actually is.
const LOOK_Y = [
  [0, 0],
  [uAt(ago(4.0e9)), 0],
  [uAt(ago(3.90e9)), 0.55],  // on the sea: the hot sky is half the subject
  [uAt(ago(3.62e9)), 0.8],   // shallow water, looking up past the stromatolites
  [uAt(ago(2.50e9)), 0.8],
  [uAt(ago(2.15e9)), 0.45],
  [uAt(ago(1.90e9)), 0],     // the pull-out and the dive into a cell: centred
  [uAt(ago(660e6)), 0],
  [uAt(ago(624e6)), 0.85],
  [uAt(ago(484e6)), 0.85],
  // Still tipped up through the shallow-water opening — the bright surface is
  // what the beat is about. Levels off as the camera comes out of the sea, then
  // keeps a slight lift for the forest canopy.
  [uAt(ago(462e6)), 0.9],
  [uAt(ago(430e6)), 0.4],
  [uAt(ago(380e6)), 0.3],
  [uAt(ago(300e6)), 0.05],
  [uAt(ago(1e6)), 0.05],
  // Ground-level beats need sky. Aimed at the origin the horizon sits dead
  // centre and half the frame is bare floor — which is survivable when the
  // floor is a lit savanna and fatal when the subject (a plume of smoke, a
  // moon, a chimney) is above the skyline.
  [uAt(ago(70e3)), 0.4],     // Out of Africa: the moon is half the scene
  [uAt(ago(11e3)), 0.1],     // the aerial over the fields wants ground
  [uAt(ago(9e3)), 0.35],     // …and the crop close-up wants the sky back
  [uAt(ago(4e3)), 0.15],
  [uAt(ago(900)), -0.05],    // aim below the origin: the bench, not the sky
  [uAt(ago(300)), 0.45],     // chimneys and smoke live above the roofline
  [uAt(ago(20)), 0.2],
  [1, 0],
];

const PAN = [
  [0, 0],
  [uAt(ago(4.62e9)), 0],
  // Held back through the Moon-forming impact. The pan exists to push a single
  // subject clear of the copy panel, but here the subject is a PAIR spanning
  // four Earth radii — pan it and the Moon leaves the frame on the right.
  [uAt(ago(4.45e9)), 0.1],
  [uAt(ago(4.35e9)), 1.25],
  [1, 1.5],
];

// THE CAMERA.
//
// Almost all travel is done by the scale law, so the camera barely moves — it
// sits five to seven units out for the whole journey and lets the world change
// size around it. Whether we are "inside" something is decided by that layer's
// own radius relative to this distance, not by flying the camera into it: the
// plasma layers sit at ~0.7 of the frame and read as a body seen from outside,
// while the last-scattering shell sits at 1.7 and wraps around us.
//
// The earlier version dived the camera to 0.22 units during the opaque era.
// Physically that is where an observer would have been, and it rendered as a
// featureless white rectangle — a good reminder that being accurate about the
// viewpoint is not the same as being legible about the subject.
const CAM = [
  [uAt(1e-44), [0, 0, 5.4]],
  [uAt(1e-20), [0, 0, 5.0]],
  [uAt(1), [0, 0, 4.8]],
  [uAt(1e10), [0, 0.05, 4.6]],
  [uAt(3e13), [0, 0.1, 4.4]], // inside the CMB shell by virtue of its radius
  [uAt(3e14), [0, 0.3, 5.6]],
  [uAt(after(180e6)), [0, 0.8, 6.2]],
  [uAt(after(1e9)), [0, 1.3, 7.0]],
  [uAt(after(5e9)), [0, 1.8, 7.6]],
  [uAt(ago(5e9)), [0, 1.9, 6.9]],
  [uAt(ago(4.75e9)), [0, 2.6, 5.4]], // the galaxy, tilted
  [uAt(ago(4.568e9)), [0, 1.9, 6.2]],
  [uAt(ago(4.51e9)), [0, 0.9, 6.4]],
  [uAt(ago(4.2e9)), [0, 0.55, 6.0]],
  // Water work — Hadean sea, stromatolite shallows, the cell. The camera height
  // barely moves: at ground level the RISE comes from the scale law, since a
  // camera held at a fixed 0.34 units climbs in metres as metres-per-unit grows.
  [uAt(ago(3.9e9)), [0, 0.40, 5.8]],
  [uAt(ago(3.62e9)), [0, 0.34, 5.2]],
  [uAt(ago(2.5e9)), [0, 0.34, 5.2]],
  [uAt(ago(2.0e9)), [0, 0.5, 6.0]],
  [uAt(ago(1.3e9)), [0, 0, 5.6]],   // the cell: dead centre, close
  [uAt(ago(680e6)), [0, 0, 5.6]],
  // Seafloor: low and level, looking along the bottom rather than down at it.
  [uAt(ago(624e6)), [0, 0.34, 5.2]],
  [uAt(ago(484e6)), [0, 0.34, 5.2]],
  // Out of the water. Held at 0.34 through the crossing for the same reason as
  // above — the frame widening from 15 m to 150 m is what lifts the camera from
  // 1.3 m under the surface to 13 m over it.
  [uAt(ago(452e6)), [0, 0.34, 5.4]],
  [uAt(ago(420e6)), [0, 0.40, 5.8]],
  [uAt(ago(380e6)), [0, 0.45, 6.0]],
  [uAt(ago(300e6)), [0, 0.50, 6.1]],
  // Surface work. Altitude is what changes: high and oblique for the aerials
  // (the hominin split, the firelight migration), low — a few dozen metres at
  // the current frame scale — for the campfire and the streets of the first
  // city, back up for the industrial skyline, then out to orbit.
  [uAt(ago(70e6)), [0, 0.5, 6.0]],
  // Held low THROUGH the impact. Without these two rows the camera is already
  // interpolating toward the 2.0-unit aerial by 66 Ma — ten kilometres up at
  // this frame — and the fireball, which is at 1.4 units, ends up near the top
  // of the sky reading as a sun over a distant plain.
  [uAt(ago(66.2e6)), [0, 0.42, 6.0]],
  [uAt(ago(65.5e6)), [0, 0.5, 6.05]],
  [uAt(ago(20e6)), [0, 2.0, 6.3]],
  [uAt(ago(6.5e6)), [0, 2.4, 6.4]],
  // EYE LEVEL, and that means a very small number. Camera height in metres is
  // y × frameMeters / 4, so a "low" 0.45 units is nine metres up at a 80 m
  // frame — a rooftop. Anything shorter than the camera projects BELOW the
  // horizon and is read against dark ground instead of against the sky, which
  // is where every silhouette in this era gets its contrast. Every figure in
  // the human beats was being shot from a first-floor window.
  [uAt(ago(2.0e6)), [0, 0.20, 6.2]],
  [uAt(ago(300e3)), [0, 0.18, 6.1]],
  [uAt(ago(70e3)), [0, 0.11, 6.1]],
  [uAt(ago(24e3)), [0, 0.10, 6.1]],
  [uAt(ago(12e3)), [0, 1.6, 6.3]],   // the one aerial: fields from above
  [uAt(ago(9.2e3)), [0, 0.12, 6.0]], // …then down INTO the crop
  [uAt(ago(5.6e3)), [0, 0.11, 6.05]],
  // Above the bench, looking down at it. A camera at eye height sees a leaned
  // tablet edge-on, which is a rectangle with nothing written on it.
  [uAt(ago(2e3)), [0, 1.5, 5.6]],
  // A hillside over the mill town, not a helicopter over it: at 300 m a camera
  // 1.35 units up is 400 m in the air, which turns an industrial city into a
  // map of one.
  [uAt(ago(300)), [0, 0.42, 6.3]],
  [uAt(ago(24)), [0, 0.5, 6.3]],
  [1, [0, 0.5, 5.9]],
];

export default defineJourney({
  ...meta,
  axis: axisDef,
  // Viewport-heights of scroll — see pacing.js. scripts/smoke.mjs enforces
  // the per-beat floor in vh, which is the unit the defect actually lives in.
  length,
  stageOptions: {
    background: 0x010206,
    // A zero threshold blooms everything including the dim points, which is
    // how a field of 24,000 additive sprites turns the frame white. Blooming
    // only what is genuinely bright keeps the glare on the stars and the
    // fireball, where it belongs.
    bloom: { strength: 0.6, radius: 0.55, threshold: 0.42 },
    fov: 55,
  },

  scaleAt: (u) => plog(SCALE, u) / 4,

  camera(u, cam, { t }) {
    const [x, y, z] = plin(CAM, u);
    // A slow orbit so a stationary reader is never looking at a frozen frame.
    // Driven by the player's accumulated clock, which the exporter replaces
    // with a fixed-step virtual one, so renders stay reproducible.
    const a = t * 0.035;
    cam.position.set(x * Math.cos(a) + z * Math.sin(a), y, z * Math.cos(a) - x * Math.sin(a));
    cam.lookAt(0, plin(LOOK_Y, u), 0);
    // Pan AFTER aiming: sliding the camera left without re-aiming pushes the
    // subject right in frame, clear of the copy panel.
    const pan = plin(PAN, u);
    if (pan) cam.translateX(-pan);
  },

  beats,
  layers: makeLayers(uAt, tAt),
});
