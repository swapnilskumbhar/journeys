import meta from './meta.js';
import { defineJourney } from '../../engine/journey.js';
import { makeAxis } from '../../engine/axis.js';
import { beats } from './beats.js';
import { makeLayers } from './layers.js';
import { axisDef } from './axis-def.js';
import { length } from './pacing.js';
import { frameAt, lookXAt, lookYAt, azimuthAt, panAt, LIGHT_DIR } from './plan.js';
import { aimCamera } from '../../kit/camrig.js';

const A = makeAxis(axisDef);
const uAt = (m) => A.toU(m);
const dAt = (u) => A.toValue(u);

// Everything about where the frame is and which way it faces lives in plan.js,
// which layers.js also reads. That is the whole point of that module: the Sun's
// bearing, the light direction and the aim point are computed ONCE and used by
// both the camera and the world, so they cannot be two numbers that are
// supposed to agree.
//
// The camera itself is four table lookups and nothing else — no clock, no
// accumulated state, no nearest-body search whose answer flips mid-beat.
export default defineJourney({
  ...meta,
  axis: axisDef,
  length,
  stageOptions: {
    background: 0x020306,
    bloom: { strength: 0.5, radius: 0.5, threshold: 0.44 },
    fov: 55,
    // A real directional sun, required rather than optional: `vehicle` and
    // `tower` use MeshStandardMaterial, and PBR with no light in the scene
    // renders almost black. Its direction is the SAME vector every planet,
    // moon and boulder is lit with — see plan.js's LIGHT_DIR — because two
    // bodies with different terminator angles read as a collage.
    sun: { dir: LIGHT_DIR, intensity: 3.2, ambient: 0.34, shadow: false },
  },

  scaleAt: (u) => frameAt(dAt(u)) / 4,

  camera(u, cam) {
    const d = dAt(u);
    aimCamera(cam, {
      pos: [0, 0, 6.2],
      azimuthDeg: azimuthAt(d),
      lookAt: [lookXAt(d), lookYAt(d), 0],
      pan: panAt(d),
    });
  },

  beats,
  layers: makeLayers(uAt, dAt),
});
