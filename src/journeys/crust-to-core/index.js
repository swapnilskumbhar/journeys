import meta from './meta.js';
import { defineJourney } from '../../engine/journey.js';
import { makeAxis } from '../../engine/axis.js';
import { beats } from './beats.js';
import { makeLayers } from './layers.js';
import { axisDef } from './axis-def.js';
import { length } from './pacing.js';
import { R_EARTH, D_MOHO, D_CMB, D_ICB, D_KOLA, D_MPONENG } from './depth.js';
import { plog, plin } from './curve.js';
import { aimCamera } from '../../kit/camrig.js';

const A = makeAxis(axisDef);
const uAt = (m) => A.toU(m);
const dAt = (u) => A.toValue(u);

// THE SCALE LAW. Almost everything in this journey is sized as a FRACTION OF
// THE FRAME rather than in fixed metres (the `strata` wall always fills the
// view by construction; `rocks` and the borehole shaft size themselves off
// `rebase.frameMeters()` too) — so this table's real job is choosing, at each
// landmark, roughly how wide a slice of rock the reader is looking at: a
// couple of metres for a blade of grass, a few kilometres for the borehole
// shaft, hundreds of kilometres through the mantle, millions at the core.
const SCALE = [
  [uAt(0.3), 2],
  [uAt(1.5), 3],
  [uAt(8), 10],
  [uAt(30), 40],
  [uAt(120), 150],
  [uAt(D_MPONENG), 3.0e3],
  [uAt(9.0e3), 6.0e3],
  [uAt(D_KOLA), 9.0e3],
  [uAt(2.0e4), 1.4e4],
  [uAt(3.0e4), 2.0e4],
  [uAt(3.3e4), 2.2e4],
  [uAt(D_MOHO), 2.3e4],
  [uAt(3.7e4), 2.4e4],
  [uAt(8.0e4), 5.0e4],
  [uAt(1.5e5), 9.0e4],
  [uAt(1.9e5), 1.1e5],
  [uAt(5.0e5), 2.8e5],
  [uAt(1.2e6), 6.5e5],
  [uAt(2.85e6), 1.5e6],
  [uAt(2.87e6), 1.5e6],
  [uAt(D_CMB), 1.6e6],
  [uAt(2.92e6), 1.6e6],
  [uAt(4.0e6), 2.1e6],
  [uAt(5.10e6), 2.6e6],
  [uAt(D_ICB), 2.7e6],
  [uAt(5.8e6), 3.0e6],
  [1, 3.2e6],
];

// Vertical aim: a shallow, steady look-down, the honest posture for a
// straight-down descent — never so steep the copy panel's own subject (the
// wall ahead) tips out of frame.
const LOOK_Y = [
  [uAt(0.3), 0.1],
  [uAt(30), -0.15],
  [uAt(D_MPONENG), -0.25],
  [uAt(D_MOHO), -0.3],
  [uAt(D_CMB), -0.2],
  [uAt(D_ICB), -0.15],
  [1, -0.1],
];

const PAN = [
  [uAt(0.3), 0.5],
  [uAt(30), 0.8],
  [uAt(D_MPONENG), 0.9],
  [1, 0.9],
];

const CAM = [
  [uAt(0.3), [0, 0.08, 6.2]],
  [uAt(30), [0, 0.05, 6.2]],
  [1, [0, 0.05, 6.2]],
];

// A slow, steady rotation — free parallax against a wall that is otherwise
// close to featureless for long stretches, the same device big-bang's deep
// field and voyager's cruise use — HELD at 0 through the three structural
// events (the Moho, the core–mantle boundary, the inner-core boundary) so
// nothing about the one moment that matters is also spinning.
const AZIMUTH = [
  [uAt(0.3), 0],
  [uAt(120), 10],
  [uAt(3.3e4), 16],
  [uAt(D_MOHO), 0],
  [uAt(3.7e4), 0],
  [uAt(8.0e4), 14],
  [uAt(2.87e6), 14],
  [uAt(D_CMB), 0],
  [uAt(2.92e6), 0],
  [uAt(4.0e6), 12],
  [uAt(5.10e6), 12],
  [uAt(D_ICB), 0],
  [uAt(5.8e6), 0],
  [1, 6],
];

export default defineJourney({
  ...meta,
  axis: axisDef,
  length,
  stageOptions: {
    background: 0x140c08,
    bloom: { strength: 0.5, radius: 0.45, threshold: 0.42 },
    fov: 55,
  },

  scaleAt: (u) => plog(SCALE, u) / 4,

  camera(u, cam) {
    aimCamera(cam, {
      pos: plin(CAM, u),
      azimuthDeg: plin(AZIMUTH, u),
      lookAt: [0, plin(LOOK_Y, u), 0],
      pan: plin(PAN, u),
    });
  },

  beats,
  layers: makeLayers(uAt, dAt),
});
