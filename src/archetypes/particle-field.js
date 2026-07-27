import * as THREE from 'three';
import { pointsMaterial, rng, gaussian } from './points-material.js';

// The workhorse archetype. Quark soup, primordial plasma, the first stars, a
// galaxy's disc, a halo of distant galaxies — all the same object with
// different parameters. If a journey wants "a lot of things distributed in
// space", it comes here.
//
// Positions are generated ONCE in normalized coordinates (unit radius) and the
// group is rescaled every frame to `radiusMeters` through the rebaser. That is
// the pattern rule 1 asks for: no world-space position is ever written, the
// field simply tracks whatever scale the journey is currently at, and a field
// authored for the first microsecond still works twelve decades later.

export function particleField({
  count = 12000,
  distribution = 'ball',
  radiusMeters,
  colorA = 0xffffff,
  colorB = 0x6ea8ff,
  colorMode = 'radius',
  size = 2.2,
  maxSize = 16,
  twinkle = 0,
  jitter = 0,
  seed = 1,
  // disk only
  thickness = 0.06,
  spiralArms = 0,
  spiralWinding = 3.2,
  armSpread = 0.16,
  // cloud only
  clumps = 24,
  clumpSpread = 0.16,
  // per-frame
  opacity = () => 1,
  scaleBias = 1,
  spin = 0,
  // Displacement from the journey origin, in METRES (number = +x, array =
  // full offset, function = per frame) — same contract as glow-sphere.js.
  // Lets sparks sit above a fire, smoke above a city.
  offsetMeters = null,
  // Fade out once the field falls outside the renderable band. On by default:
  // a layer sized in fixed metres (a protoplanetary disc, a galaxy) is left
  // behind by the scale law, and without this it does not vanish — it becomes
  // a flat wash of clamped sprites filling the frame, because the camera is
  // now deep inside something a million world units across.
  respectBand = true,
} = {}) {
  const rand = rng(seed);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const scales = new Float32Array(count);

  const cA = new THREE.Color(colorA);
  const cB = new THREE.Color(colorB);
  const tmp = new THREE.Color();

  const clumpCenters = [];
  if (distribution === 'cloud') {
    for (let i = 0; i < clumps; i++) {
      const v = onSphere(rand);
      const r = Math.cbrt(rand());
      clumpCenters.push([v[0] * r, v[1] * r, v[2] * r]);
    }
  }

  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, z = 0;

    if (distribution === 'ball') {
      const v = onSphere(rand);
      const r = Math.cbrt(rand()); // uniform by volume, not by radius
      [x, y, z] = [v[0] * r, v[1] * r, v[2] * r];
    } else if (distribution === 'shell') {
      const v = onSphere(rand);
      const r = 1 - Math.abs(gaussian(rand)) * 0.035; // thin, slightly fuzzy
      [x, y, z] = [v[0] * r, v[1] * r, v[2] * r];
    } else if (distribution === 'disk') {
      const r = Math.sqrt(rand());
      let th = rand() * Math.PI * 2;
      if (spiralArms > 0) {
        const arm = Math.floor(rand() * spiralArms);
        th = (arm / spiralArms) * Math.PI * 2 + gaussian(rand) * armSpread;
      }
      th += spiralWinding * r; // winding is what makes arms read as arms
      x = Math.cos(th) * r;
      z = Math.sin(th) * r;
      // thinner at the rim, puffed at the core — real discs flare inward
      y = gaussian(rand) * thickness * (1 - r * 0.55);
    } else if (distribution === 'cloud') {
      const c = clumpCenters[Math.floor(rand() * clumpCenters.length)];
      x = c[0] + gaussian(rand) * clumpSpread;
      y = c[1] + gaussian(rand) * clumpSpread;
      z = c[2] + gaussian(rand) * clumpSpread;
    }

    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;

    const radial = Math.min(1, Math.hypot(x, y, z));
    const mix = colorMode === 'random' ? rand() : radial;
    tmp.copy(cA).lerp(cB, mix);
    col[i * 3] = tmp.r;
    col[i * 3 + 1] = tmp.g;
    col[i * 3 + 2] = tmp.b;

    seeds[i] = rand();
    // a few points much brighter than the rest — uniform sizing is the single
    // biggest "this is a particle system" tell
    scales[i] = 0.55 + rand() ** 3 * 2.2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.6);

  const mat = pointsMaterial({ size, maxSize, twinkle, jitter });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; // the group is rescaled every frame

  const group = new THREE.Group();
  group.add(points);

  return {
    group,
    points,
    material: mat,
    update({ u, local, rebase, t }) {
      const meters = typeof radiusMeters === 'function'
        ? radiusMeters({ u, local, rebase })
        : radiusMeters ?? rebase.frameMeters();
      const s = rebase.toWorld(meters) * (typeof scaleBias === 'function' ? scaleBias({ u, local }) : scaleBias);
      group.scale.setScalar(s);
      if (offsetMeters !== null) {
        const raw = typeof offsetMeters === 'function'
          ? offsetMeters({ u, local, rebase, t })
          : offsetMeters;
        const [ox, oy, oz] = Array.isArray(raw) ? raw : [raw, 0, 0];
        group.position.set(rebase.toWorld(ox), rebase.toWorld(oy), rebase.toWorld(oz));
      }
      if (spin) group.rotation.y = t * spin;
      mat.uniforms.uTime.value = t;
      const w = respectBand ? rebase.weight(meters) : 1;
      const o = opacity({ u, local, rebase }) * w;
      mat.uniforms.uOpacity.value = o;
      group.visible = o > 0.002;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

// Marsaglia — uniform on the sphere. Naive (theta, phi) sampling bunches at the
// poles, which reads as a visible seam in any large field.
function onSphere(rand) {
  let a, b, s;
  do {
    a = rand() * 2 - 1;
    b = rand() * 2 - 1;
    s = a * a + b * b;
  } while (s >= 1 || s === 0);
  const f = 2 * Math.sqrt(1 - s);
  return [a * f, b * f, 1 - 2 * s];
}
