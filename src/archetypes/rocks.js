import * as THREE from 'three';
import { rng } from './points-material.js';

// Scattered procedural boulders — foreground rock at a landing site, cobbles
// on a Hadean shore, rubble at a fracture face, mineral inclusions in a rock
// wall. General-purpose: the gap `earth-to-mars` hit when its final surface
// beat needed foreground rock and every existing archetype was the wrong
// shape for it (`panel`'s `bootprint` kind gave two upright textured slabs,
// because panel draws a flat MARKED surface, not a solid lump).
//
// Built from ONE low-poly icosahedron (42 verts after one subdivision),
// instanced, with each vertex displaced along its own radius by a hash of
// (vertex position, per-instance seed) — every instance is a differently
// irregular lump from a single shared geometry, no per-instance geometry
// variants to build or store. Flat, faceted shading is recovered in the
// fragment shader from screen-space derivatives of the displaced VIEW-SPACE
// position (dFdx/dFdy), which stays correct even though the per-vertex
// jitter breaks the base geometry's original face planarity — a true
// per-face analytic normal would have to be computed per instance on the
// CPU, which would defeat the point of doing the displacement on the GPU.
//
// Scatter-enclosure lesson (CLAUDE.md): a field photographed from OUTSIDE its
// own radius is a picture of a field taken from outside it, and what changes
// an instance's apparent size is landing on the camera's SIDE of the group
// (`offsetMeters`), never a wider `areaMeters`. `centreClear` keeps a hole at
// the scatter's own origin; the caller is responsible for placing the group
// (via `offsetMeters`) so the true camera position falls inside the disc,
// exactly like every other ground scatter in this project.

const vertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  uniform float uAngularity; // fraction of radius

  attribute float aSeed;

  varying vec3 vViewPos;

  float hash13(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    float jitter = hash13(position * 11.0 + aSeed * 91.7) - 0.5;
    vec3 p = position * (1.0 + jitter * uAngularity);

    vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform vec3  uLightDir; // VIEW space — converted from world space once per frame on the CPU
  uniform vec3  uRock;
  uniform vec3  uDry;
  uniform vec3  uAmbient;
  uniform float uOpacity;

  varying vec3 vViewPos;

  void main() {
    #include <logdepthbuf_fragment>

    vec3 fdx = dFdx(vViewPos);
    vec3 fdy = dFdy(vViewPos);
    vec3 nrm = normalize(cross(fdx, fdy));

    float nl = max(0.0, dot(nrm, normalize(uLightDir)));
    // A coarse per-face mottle — hashed off the face's own normal — tints
    // each facet toward one of two colours, so a scatter of these reads as
    // ROCK (many differently-lit, differently-toned facets) rather than one
    // moulded colour repeated across every instance.
    float mottle = fract(sin(dot(nrm, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
    vec3 base = mix(uRock, uDry, mottle * 0.6);
    vec3 lit = base * (uAmbient + nl * (1.0 - uAmbient));

    gl_FragColor = vec4(lit, uOpacity);
  }
`;

export function rocks({
  count = 40,
  seed = 1,
  sizeMeters = [0.2, 0.8],   // instance radius range, metres
  areaMeters = 6,            // scatter disc radius, metres
  centreClear = 0,
  offsetMeters = null,
  buryFraction = 0.3,        // fraction of each instance's own radius sunk below y=0
  // Vertical scatter, metres. Zero — the default, and what every ground use
  // wants — lays the instances on one plane, which is correct for rubble on a
  // surface and wrong for anything FLOATING: an asteroid belt or a Kuiper-belt
  // field seen from inside a single plane renders as a row of potatoes at one
  // apparent size, however many instances it has. This is the one parameter
  // that turns the scatter into a volume.
  spreadYMeters = 0,
  angularity = 0.32,
  rock = 0x2c2a28,
  dry = 0x565048,
  ambient = 0x2a2a2a,
  lightDir = [0.6, 0.5, 0.4], // WORLD space
  opacity = () => 1,
  respectBand = true,
} = {}) {
  const rand = rng(seed);

  const uniforms = {
    uAngularity: { value: angularity },
    uLightDir: { value: new THREE.Vector3(...lightDir).normalize() },
    uRock: { value: new THREE.Color(rock) },
    uDry: { value: new THREE.Color(dry) },
    uAmbient: { value: new THREE.Color(ambient) },
    uOpacity: { value: 1 },
  };

  const geo = new THREE.IcosahedronGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: fragment }),
    count,
  );
  mesh.frustumCulled = false;

  const seedAttr = new Float32Array(count);
  const unit = [];
  for (let i = 0; i < count; i++) {
    const r = centreClear + (areaMeters - centreClear) * Math.sqrt(rand());
    const th = rand() * Math.PI * 2;
    unit.push({
      x: Math.cos(th) * r,
      z: Math.sin(th) * r,
      y: spreadYMeters ? (rand() * 2 - 1) * spreadYMeters : 0,
      radius: sizeMeters[0] + rand() * (sizeMeters[1] - sizeMeters[0]),
      squash: 0.65 + rand() * 0.4,
      rx: (rand() - 0.5) * 0.6,
      ry: rand() * Math.PI * 2,
      rz: (rand() - 0.5) * 0.6,
    });
    seedAttr[i] = rand();
  }
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedAttr, 1));

  const group = new THREE.Group();
  group.add(mesh);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const lightView = new THREE.Vector3();
  const invQ = new THREE.Quaternion();

  return {
    group,
    mesh,
    uniforms,
    update({ u, local, rebase, t, camera }) {
      for (let i = 0; i < count; i++) {
        const it = unit[i];
        const rWorld = rebase.toWorld(it.radius);
        e.set(it.rx, it.ry, it.rz);
        q.setFromEuler(e);
        s.set(rWorld, rWorld * it.squash, rWorld);
        p.set(
          rebase.toWorld(it.x),
          rWorld * it.squash * (1 - buryFraction * 2) + rebase.toWorld(it.y),
          rebase.toWorld(it.z),
        );
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;

      if (offsetMeters !== null) {
        const raw = typeof offsetMeters === 'function'
          ? offsetMeters({ u, local, rebase, t })
          : offsetMeters;
        const [ox, oy, oz] = Array.isArray(raw) ? raw : [raw, 0, 0];
        group.position.set(rebase.toWorld(ox), rebase.toWorld(oy), rebase.toWorld(oz));
      }

      // Camera is never given a parent in this project (rule 8's "the camera
      // is handed no clock" sibling rule for orientation): its own quaternion
      // IS its world quaternion, so inverting it converts a world-space
      // lightDir into the view space the derivative-based normal lives in,
      // with no dependency on matrixWorldInverse's update timing.
      if (camera) {
        invQ.copy(camera.quaternion).invert();
        lightView.set(...lightDir).normalize().applyQuaternion(invQ);
        uniforms.uLightDir.value.copy(lightView);
      }

      const w = respectBand ? rebase.weight(sizeMeters[1]) : 1;
      const o = opacity({ u, local, rebase }) * w;
      uniforms.uOpacity.value = o;
      group.visible = o > 0.004;
    },
    dispose() {
      geo.dispose();
      mesh.material.dispose();
      mesh.dispose();
    },
  };
}
