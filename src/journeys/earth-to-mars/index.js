import meta from './meta.js';
import { defineJourney } from '../../engine/journey.js';
import { makeAxis } from '../../engine/axis.js';
import { beats } from './beats.js';
import { makeLayers } from './layers.js';
import { axisDef } from './axis-def.js';
import { length } from './pacing.js';
import { MARS_D, walked } from './distance.js';
import { plog, plin } from './curve.js';
import { aimCamera } from '../../kit/camrig.js';

const A = makeAxis(axisDef);
const uAt = (m) => A.toU(m);
const dAt = (u) => A.toValue(u);
const mid = (a, b, f) => uAt(a) + f * (uAt(b) - uAt(a));

// THE SCALE LAW. Same law earth-to-moon derives, verbatim — it is a property
// of "origin at the spacecraft, camera six units out", not of the Earth–Moon
// pair specifically:
//
//     frame = 0.571 × min(R_EARTH + d, MARS_D - R_MARS - d)
//
// peaking at the geometric midpoint. The two ends leave the law exactly as
// they do there: the pad is a terrain-scale frame, and Mars' surface is too.
const SCALE = [
  [uAt(1), 140],
  [mid(1, 4, 0.6), 140],
  [uAt(4), 160],
  [mid(4, 130, 0.5), 230],
  [uAt(130), 460],
  [uAt(1.4e4), 5.2e4],
  [uAt(6.5e4), 2.6e5],
  [mid(6.5e4, 9.5e4, 0.65), 2.9e5],
  [uAt(9.5e4), 5.0e5],
  [uAt(2.0e5), 3.8e6],
  [mid(2.0e5, 2.05e5, 0.7), 3.85e6],
  [uAt(2.2e5), 3.9e6],

  // --- the cruise --------------------------------------------------------
  [uAt(1.0e7), 1.9e7],
  [mid(1.0e7, 1.0e9, 0.75), 3.0e8],
  [uAt(1.0e9), 5.8e8],
  [mid(1.0e9, 3.0e10, 0.75), 1.4e8],
  [uAt(3.0e10), 1.5e8],
  [mid(3.0e10, 1.5e11, 0.75), 8.6e10],
  [uAt(1.5e11), 8.6e10],
  [mid(1.5e11, 2.2e11, 0.75), 1.6e11],
  [uAt(2.2e11), 1.6e11],
  [mid(2.2e11, 3.6e11, 0.75), 1.4e11],
  [uAt(3.6e11), 1.4e11],
  [mid(3.6e11, 5.0e11, 0.75), 6.0e10],
  [uAt(5.0e11), 6.0e10],

  // --- Mars approach -------------------------------------------------------
  [uAt(5.30e11), 6.4e9],
  [mid(5.30e11, 5.55e11, 0.6), 8.0e8],
  [uAt(5.55e11), 2.5e8],
  [uAt(5.590e11), 1.9e6],
  [uAt(5.598e11), 4.2e5],

  // --- entry, descent, landing --------------------------------------------
  [uAt(MARS_D - 1.25e5), 3.0e5],
  [uAt(MARS_D - 6.0e4), 6.0e4],
  [uAt(MARS_D - 1.1e4), 9.0e3],
  [uAt(MARS_D - 2.0e3), 3.0e3],
  [uAt(MARS_D - 1.4e3), 7.0e2],
  [uAt(MARS_D), 45],
  [mid(MARS_D, walked(9), 0.6), 42],
  [uAt(walked(9)), 1.4],
  [mid(walked(9), walked(55), 0.65), 1.4],
  [uAt(walked(55)), 16],
  [1, 17],
];

// Vertical aim. Same convention as earth-to-moon: negative looks back toward
// Earth, positive looks ahead toward Mars.
const LOOK_Y = [
  [uAt(1), 0.28],
  [uAt(130), 0.15],
  [uAt(1.4e4), 0.10],
  [uAt(6.5e4), 0.05],
  [uAt(2.0e5), 0.35],
  [uAt(2.2e5), 0.30],
  [uAt(1.0e7), -0.9],
  [mid(1.0e7, 1.0e9, 0.75), -1.0],
  [uAt(1.0e9), -1.1],
  [mid(1.0e9, 3.0e10, 0.75), 0],
  [uAt(3.0e10), 0],           // the Sun beat looks mostly along LOOK_X (z-forward, x-offset)
  [uAt(1.5e11), 0],
  [uAt(2.2e11), 0],
  [uAt(3.6e11), 0],
  [uAt(5.0e11), 4.0],
  [uAt(5.30e11), 4.6],
  [uAt(5.55e11), 4.6],
  [uAt(5.590e11), 4.4],
  [uAt(5.598e11), 4.2],
  [uAt(MARS_D - 1.25e5), -0.20],
  [uAt(MARS_D - 6.0e4), -0.22],
  [uAt(MARS_D - 1.1e4), -0.20],
  [uAt(MARS_D - 2.0e3), -0.15],
  [uAt(MARS_D - 1.4e3), -0.12],
  [uAt(MARS_D), -0.10],
  [uAt(walked(9)), -1.6],
  [uAt(walked(55)), 0.30],
  [1, 0.30],
];

// LOOK_X — new here. Zero everywhere the subject is on-axis (which is most of
// the journey); non-zero only where the subject genuinely is not: the Sun
// during "a dimmer sun" (beat 12) and Earth during "an evening star" (beat
// 28). This is the general capability src/kit/camrig.js exists to carry —
// earth-to-moon's beat 21 defect was exactly this gap.
const LOOK_X = [
  [uAt(1), 0],
  [uAt(2.2e11), 0],
  // The Sun, off to one side — HELD across the whole of beat 12 (3.0e10 →
  // 1.5e11), not just at its opening mark. shots.mjs samples 45% into a
  // beat; a swing that decayed back to 0 before that point is invisible in
  // every review frame, which is exactly the defect this table exists to
  // avoid repeating (see earth-to-moon beat 21).
  [mid(1.0e9, 3.0e10, 0.9), 0],
  [uAt(3.0e10), 2.6],
  [mid(3.0e10, 1.5e11, 0.85), 2.6],
  [uAt(1.5e11), 0],
  // Olympus Mons on the limb, not dead ahead — held across its own beat.
  [mid(5.590e11, 5.598e11, 0.7), 0],
  [uAt(5.598e11), -1.4],
  [mid(5.598e11, MARS_D - 1.25e5, 0.6), -1.4],
  [uAt(MARS_D - 1.25e5), 0],
  [uAt(MARS_D), 0],
  [uAt(walked(55) - 20), 0],
  [uAt(walked(55)), -2.1], // Earth, low and to one side in the evening sky
  [1, -2.1],
];

const PAN = [
  [uAt(1), 0.6],
  [uAt(130), 0.9],
  [uAt(1.4e4), 1.0],
  [uAt(2.0e5), 0.9],
  [uAt(1.0e9), 1.0],
  [uAt(3.0e10), 0.9],
  [uAt(2.2e11), 0.7],
  [uAt(5.598e11), 0.9],
  [uAt(MARS_D - 1.25e5), 0.9],
  [uAt(MARS_D), 0.7],
  [uAt(walked(9)), 0.4],
  [1, 0.9],
];

// Camera height, in units (units scale with the frame — see DESIGN.md §4).
const CAM = [
  [uAt(1), [0, 0.95, 6.2]],
  [uAt(130), [0, 0.50, 6.0]],
  [uAt(1.4e4), [0, 0.25, 6.0]],
  [uAt(6.5e4), [0, 0.30, 6.1]],
  [uAt(2.0e5), [0, 0.40, 6.2]],
  [uAt(1.0e7), [0, 0.15, 6.3]],
  [uAt(1.0e9), [0, 0.0, 6.4]],
  [uAt(3.0e10), [0, 0.0, 6.4]],
  [uAt(1.5e11), [0, 0.0, 6.4]],
  [uAt(2.2e11), [0, 0.0, 6.3]],
  [uAt(5.30e11), [0, 0.1, 6.2]],
  [uAt(5.598e11), [0, 0.2, 6.0]],
  [uAt(MARS_D - 1.25e5), [0, 0.3, 6.0]],
  [uAt(MARS_D), [0, 1.3, 6.0]],
  [uAt(walked(9)), [0, 1.2, 5.4]],
  [uAt(walked(55)), [0, 0.11, 6.0]],
  [1, [0, 0.11, 6.0]],
];

const AZIMUTH = [
  [uAt(1), -22],
  [uAt(130), -14],
  [uAt(1.4e4), -8],
  [uAt(6.5e4), -4],
  [uAt(2.0e5), 0],
  [uAt(1.0e9), 8],
  [uAt(1.5e11), 10],
  [uAt(3.6e11), 6],
  [uAt(5.598e11), 0],
  [uAt(MARS_D - 1.25e5), 0],
  [1, 0],
];

export default defineJourney({
  ...meta,
  axis: axisDef,
  length,
  stageOptions: {
    background: 0x050302,
    bloom: { strength: 0.55, radius: 0.5, threshold: 0.45 },
    fov: 55,
    // A real sun, required rather than optional now that `vehicle` uses a PBR
    // material: MeshStandardMaterial with no light in the scene renders almost
    // black. Measured when the rig was added to earth-to-moon and not here —
    // this journey's occupancy fell from 0.026 to 0.019 because its probe lost
    // the analytic lambert term it used to shade itself with.
    sun: { dir: [0.68, 0.24, 0.62], intensity: 3.2, ambient: 0.5, radius: 3.4 },
  },

  scaleAt: (u) => plog(SCALE, u) / 4,

  // Uses the shared rig (src/kit/camrig.js), with a real lookAt VECTOR rather
  // than a bare Y scalar — the general capability this journey required and
  // earth-to-moon's beat 21 was quietly missing.
  camera(u, cam) {
    aimCamera(cam, {
      pos: plin(CAM, u),
      azimuthDeg: plin(AZIMUTH, u),
      lookAt: [plin(LOOK_X, u), plin(LOOK_Y, u), 0],
      pan: plin(PAN, u),
    });
  },

  beats,
  layers: makeLayers(uAt, dAt),
});
