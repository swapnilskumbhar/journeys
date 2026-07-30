import meta from './meta.js';
import { defineJourney } from '../../engine/journey.js';
import { makeAxis } from '../../engine/axis.js';
import { beats } from './beats.js';
import { makeLayers } from './layers.js';
import { axisDef } from './axis-def.js';
import { length } from './pacing.js';
import {
  auTo, R_SUN, R_EARTH, R_JUPITER, R_SATURN, R_URANUS, R_NEPTUNE,
  R_JUPITER_AU, R_SATURN_AU, R_URANUS_AU, R_NEPTUNE_AU,
} from './distance.js';
import { plin } from './curve.js';
import { aimCamera } from '../../kit/camrig.js';

const A = makeAxis(axisDef);
const uAt = (m) => A.toU(m);
const dAt = (u) => A.toValue(u);

// THE SCALE LAW AND CAMERA. First pass used anchor TABLES for frame width and
// vertical look, interpolated between each beat's own mark — which works
// only AT the anchors. shots.mjs samples mid-beat, and mid-beat the true
// offset of a moving subject has already drifted from the value the table
// was built for, so the anchor-table approach pointed the camera at empty
// space for several beats (see DESIGN.md's honest report). The fix is to
// compute frame width and vertical aim as a literal FORMULA of `u` — exactly
// like earth-to-mars' `frame = 0.571 × min(...)` — so alignment holds at
// EVERY point along a beat, not only at its start.
//
// The rule: at any u, find whichever of the six bodies (Earth, the Sun,
// Jupiter, Saturn, Uranus, Neptune) is currently closest to the ship in
// heliocentric range — that is the beat's dominant subject, chosen by the
// axis position itself rather than authored per-beat. Frame to it with the
// same "formation camera" convention both earlier journeys use
// (frame = 1.3 × |offset| keeps the ship in frame beside a distant point,
// ~3 world units ahead/behind), floored at a few times the subject's own
// radius so the frame never collapses to zero exactly at a flyby.
const BODIES = [
  { name: 'earth', rAU: 1.0, radius: R_EARTH },
  { name: 'jupiter', rAU: R_JUPITER_AU, radius: R_JUPITER },
  { name: 'saturn', rAU: R_SATURN_AU, radius: R_SATURN },
  { name: 'uranus', rAU: R_URANUS_AU, radius: R_URANUS },
  { name: 'neptune', rAU: R_NEPTUNE_AU, radius: R_NEPTUNE },
  { name: 'sun', rAU: 0, radius: R_SUN },
];

function nearest(d) {
  let best = null;
  for (const b of BODIES) {
    const off = auTo(b.rAU) - d;
    if (best === null || Math.abs(off) < Math.abs(best.off)) best = { ...b, off };
  }
  return best;
}

const frameAt = (u) => {
  const n = nearest(dAt(u));
  return Math.max(4 * n.radius, 1.3 * Math.abs(n.off));
};
const lookYAt = (u, frame) => nearest(dAt(u)).off / (frame / 4);

// Three beats are deliberately COMPOSITED rather than framed on a true body:
// Pluto's marker point, the Pale Blue Dot, and the Golden Record disc on the
// bus. All three hold a fixed (frame, lookY, lookX) across their own span —
// safe to hold constant because nothing physically large is being tracked,
// only a fixed-composition accent (see layers.js).
const OVERRIDES = [
  { from: auTo(39.3), to: auTo(40.15), frame: 8.98e9, lookY: 0, lookX: 0 },
  { from: auTo(40.15), to: auTo(41.6), frame: 7.48e9, lookY: 0.3, lookX: -0.2 },
  { from: auTo(166.02), to: auTo(167), frame: 3.0e11, lookY: -1.0, lookX: 0 },
];
const overrideAt = (d) => OVERRIDES.find((o) => d >= o.from && d < o.to) ?? null;

// LOOK_X — 0 almost everywhere (every subject above sits ON the shared y
// axis). Nonzero only for the Great Red Spot, an authored off-axis feature
// on Jupiter's own limb.
const LOOK_X = [
  [uAt(auTo(5.195)), 0],
  [uAt(auTo(5.199)), 0.9],
  [uAt(auTo(5.204)), 0],
  [1, 0],
];

const PAN = [
  [uAt(auTo(1.0)), 0.6],
  [uAt(auTo(1.5)), 1.0],
  [uAt(auTo(5.20)), 0.8],
  [uAt(auTo(9.0)), 0.8],
  [uAt(auTo(60)), 1.0],
  [1, 0.9],
];

const AZIMUTH = [
  [uAt(auTo(1.0)), -14],
  [uAt(auTo(4.5)), -6],
  [uAt(auTo(5.20)), 4],
  [uAt(auTo(9.0)), 6],
  [uAt(auTo(19.20)), 3],
  [uAt(auTo(30.10)), -3],
  [uAt(auTo(60)), 8],
  [uAt(auTo(268000)), 10],
  [1, 10],
];

function frameAndLook(u) {
  const d = dAt(u);
  const ov = overrideAt(d);
  if (ov) return { frame: ov.frame, lookY: ov.lookY, lookX: ov.lookX };
  const frame = frameAt(u);
  return { frame, lookY: lookYAt(u, frame), lookX: plin(LOOK_X, u) };
}

export default defineJourney({
  ...meta,
  axis: axisDef,
  length,
  stageOptions: {
    background: 0x020306,
    bloom: { strength: 0.5, radius: 0.5, threshold: 0.44 },
    fov: 55,
    // A real sun, required rather than optional now that `vehicle` uses a PBR
    // material: MeshStandardMaterial with no light in the scene renders almost
    // black. Measured when the rig was added to earth-to-moon and not here —
    // this journey's occupancy fell from 0.026 to 0.019 because its probe lost
    // the analytic lambert term it used to shade itself with.
    sun: { dir: [0.62, 0.30, 0.72], intensity: 3.0, ambient: 0.42, shadow: false },
  },

  scaleAt: (u) => frameAndLook(u).frame / 4,

  camera(u, cam) {
    const { lookY, lookX } = frameAndLook(u);
    aimCamera(cam, {
      pos: [0, 0, 6.2],
      azimuthDeg: plin(AZIMUTH, u),
      lookAt: [lookX, lookY, 0],
      pan: plin(PAN, u),
    });
  },

  beats,
  layers: makeLayers(uAt, dAt),
});
