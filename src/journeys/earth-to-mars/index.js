import meta from './meta.js';
import { defineJourney } from '../../engine/journey.js';
import { beats } from './beats.js';
import { makeLayers } from './layers.js';
import { axisDef } from './axis-def.js';
import { length } from './pacing.js';
import { aimCamera } from '../../kit/camrig.js';
import {
  uAt, dAt, frameAt, camAt, azimuthAt, rollAt, panAt, lookAtUnits,
} from './plan.js';

// Everything this file used to own — the scale law, four camera tables and the
// aim point — now lives in `plan.js`, because `layers.js` needs the same
// numbers and the two files disagreeing is the single defect that produced
// eleven consecutive black cruise frames. The camera is still a pure function
// of `u` and is still handed no clock (rule 8).

export default defineJourney({
  ...meta,
  axis: axisDef,
  length,
  stageOptions: {
    background: 0x050302,
    // Threshold up and strength down. `clip` reads 0.003 against a 0.06 gate, so
    // no number in this repo could see the overexposure a blind reviewer kept
    // naming — the sun on the pad, the specular hot spot on the cruise stage's
    // solar disc, the city lights on the terminator. Bloom below 0.45 was
    // picking up lit hardware and lit ground, not just the light sources, and
    // then adding to them.
    // Threshold up, strength down a little. `clip` reads 0.003 against a 0.06
    // gate, so no number in this repo could see the overexposure a blind
    // reviewer kept naming — the sun on the pad, the specular hot spot on the
    // cruise stage's solar disc, the city lights on the terminator. Below 0.45
    // the bloom was picking up lit hardware and lit ground rather than the
    // light sources, and then adding to them. 0.55 was too far the other way:
    // measured, it cost 0.02 of journey contrast and took beats 6–8 from ~0.18
    // to ~0.09, which is the highlights being deleted rather than recovered.
    // Most of the overexposure fix is at SOURCE — the sun discs are a ninth of
    // the angular size they were, the cruise stage's deck and ribs are no
    // longer near-white, the Martian sky is a mid tone — so the bloom itself
    // only needed a nudge. 0.55 was too far: measured, it cost 0.02 of journey
    // contrast and took beats 6–8 from ~0.18 to ~0.09, which is deleting the
    // highlights rather than recovering them.
    bloom: { strength: 0.52, radius: 0.5, threshold: 0.46 },
    fov: 55,
    // A real sun, required rather than optional now that `vehicle` uses a PBR
    // material: MeshStandardMaterial with no light in the scene renders almost
    // black.
    sun: { dir: [0.68, 0.24, 0.62], intensity: 3.2, ambient: 0.5, radius: 3.4 },
  },

  scaleAt: (u) => frameAt(u) / 4,

  camera(u, cam) {
    aimCamera(cam, {
      pos: camAt(u),
      azimuthDeg: azimuthAt(u),
      lookAt: lookAtUnits(u),
      pan: panAt(u),
      rollDeg: rollAt(u),
    });
  },

  beats,
  layers: makeLayers(uAt, dAt),
});
