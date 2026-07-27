import meta from './meta.js';
import { defineJourney } from '../../engine/journey.js';
import { makeAxis } from '../../engine/axis.js';
import { beats } from './beats.js';
import { makeLayers } from './layers.js';
import { ago, after } from './time.js';
import { axisDef } from './axis-def.js';
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
  [uAt(ago(4.72e9)), 4.0e20], // closing on the disc
  [uAt(ago(4.63e9)), 5.0e17], // inside it, among star-forming clouds
  [uAt(ago(4.568e9)), 3.0e13], // the protoplanetary disc, ~200 AU
  // Held almost to the end of the disc's own beat. Plunging earlier meant that
  // beat spent its entire scroll travelling away from its subject — by the time
  // the copy was readable the disc was four decades behind and off-band.
  [uAt(ago(4.522e9)), 2.5e13],
  // Then six decades in a very short span: the collapse, as a single fall.
  // 2.6e7 m is the frame where the true Earth–Moon system of 4.5 Gyr ago fits
  // with both bodies at a readable size — Earth about a quarter of the frame
  // height, the Moon roughly four Earth radii out, which is where it was.
  [uAt(ago(4.512e9)), 2.6e7],
  // Widens slightly rather than closing in, so the Moon stays inside the frame
  // for the whole of its own beat. At its real distance it sits right at the
  // edge, and the copy panel's pan pushes it further out.
  [uAt(ago(4.45e9)), 3.2e7],
  [uAt(ago(4.4e9)), 1.7e7], // Earth fills the frame

  // The seafloor era — prototype for the fix to the whole life era. The frame
  // used to sit at 1.7e7 m from 4.4 Gyr ago all the way to 60 Myr ago: nine
  // beats, no scale change, nine near-identical globes. Copy about mitochondria
  // and trilobites over a static sphere is the "captions don't match" problem
  // in one line of table.
  //
  // The window must span both beats it serves END TO END, not just their `at`
  // marks — a beat occupies the scroll from its own position to the NEXT one,
  // so a window centred on 538 Mya is already gone by the time the Cambrian
  // copy is on screen. 6 m is the frame where a 0.8 m animal reads as an
  // animal; at 60 m it is twenty pixels of nothing.
  [uAt(ago(660e6)), 1.7e7],
  [uAt(ago(624e6)), 6],   // down to the seafloor for the Ediacaran
  [uAt(ago(484e6)), 6],   // …and held through the Cambrian
  [uAt(ago(474e6)), 1.7e7],

  // --- the descent -----------------------------------------------------------
  // The zoom does not stop at Earth. After the asteroid, the same dive that
  // went cosmic-web → galaxy → disc continues: orbit → aerial savanna → a
  // campfire at 300 m. Ground level holds through the whole human story, then
  // the final gap pulls back out to orbit so "Today" ends where "Oceans" was —
  // same planet, now with city lights.
  [uAt(ago(60e6)), 1.7e7],
  [uAt(ago(22e6)), 1.1e6],
  [uAt(ago(8.5e6)), 3.0e4],
  [uAt(ago(6.2e6)), 2.2e4],  // aerial hold: the split from chimpanzees
  [uAt(ago(5.5e6)), 2.0e4],
  [uAt(ago(2.0e6)), 280],    // the fall to the fire
  [uAt(ago(1.1e6)), 260],
  [uAt(ago(330e3)), 600],    // wider: three camps
  [uAt(ago(240e3)), 640],
  [uAt(ago(80e3)), 1.4e4],   // night aerial: firelight spreading
  [uAt(ago(50e3)), 1.5e4],
  [uAt(ago(13.5e3)), 3.2e3], // fields
  [uAt(ago(10e3)), 3.0e3],
  // Settlement frames are tight — a 4 m hut at a 1.5 km frame is sub-pixel,
  // so the village gets 750 m and the first city 900 m; the lamp layers do
  // the rest of the work of making them read.
  [uAt(ago(6.9e3)), 850],
  [uAt(ago(5.9e3)), 750],
  [uAt(ago(5.35e3)), 900],
  [uAt(ago(4.2e3)), 1.0e3],
  [uAt(ago(500)), 5.5e3],    // the industrial city
  [uAt(ago(270)), 7.0e3],
  [uAt(ago(120)), 7.5e3],
  // The pull-back transits the awkward middle distances fast: between the
  // city (10^4 m) and the globe (10^7 m) there is nothing to look at but the
  // dark flank of the planet, so those decades get the least scroll.
  [uAt(ago(45)), 4.0e5],
  [uAt(ago(12)), 6.0e6],
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
  [uAt(ago(660e6)), 0],
  [uAt(ago(624e6)), 0.85],
  [uAt(ago(484e6)), 0.85],
  [uAt(ago(474e6)), 0],
  [1, 0],
];

const PAN = [
  [0, 0],
  [uAt(ago(4.62e9)), 0],
  [uAt(ago(4.4e9)), 1.25],
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
  // Seafloor: low and level, looking along the bottom rather than down at it.
  [uAt(ago(660e6)), [0, 0.55, 6.0]],
  [uAt(ago(624e6)), [0, 0.34, 5.2]],
  [uAt(ago(484e6)), [0, 0.34, 5.2]],
  [uAt(ago(474e6)), [0, 0.55, 6.0]],
  // Surface work. Altitude is what changes: high and oblique for the aerials
  // (the hominin split, the firelight migration), low — a few dozen metres at
  // the current frame scale — for the campfire and the streets of the first
  // city, back up for the industrial skyline, then out to orbit.
  [uAt(ago(70e6)), [0, 0.5, 6.0]],
  [uAt(ago(20e6)), [0, 2.0, 6.3]],
  [uAt(ago(6.5e6)), [0, 2.4, 6.4]],
  [uAt(ago(2.0e6)), [0, 0.42, 6.2]],
  [uAt(ago(300e3)), [0, 0.55, 6.1]],
  [uAt(ago(70e3)), [0, 2.5, 6.3]],
  [uAt(ago(12e3)), [0, 1.5, 6.2]],
  [uAt(ago(6.5e3)), [0, 0.62, 6.1]],
  [uAt(ago(5.0e3)), [0, 0.5, 6.15]],
  [uAt(ago(300)), [0, 1.35, 6.6]],
  [1, [0, 0.5, 5.9]],
];

export default defineJourney({
  ...meta,
  axis: axisDef,
  // Viewport-heights of scroll. At 39 beats this averages ~1.6 each, which is
  // what keeps the tightest legitimate clusters (the wheel and writing are
  // genuinely 1,300 years apart) readable rather than a flicker.
  // scripts/smoke.mjs enforces the floor.
  length: 62,
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
