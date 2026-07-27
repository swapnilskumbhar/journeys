import * as THREE from 'three';
import { rng } from './points-material.js';

// Settlements. An instanced field of boxes on a jittered grid — a hamlet of
// huts, a mudbrick city, an industrial skyline are all this archetype with
// different counts, heights and night levels. Buildings are authored in
// METRES (the group is scaled by toWorld(1) each frame), sit on y=0, and
// belong on a terrain's flattened centre.
//
// Night windows are procedural per-fragment: a metre-scale grid on the wall
// faces, each cell lit or dark by a hash of the cell and the instance seed,
// gated by uNight. No textures, deterministic, and the lit ratio can be
// driven from 0 (firelight era) to 1 (the electrified century) as the journey
// scrolls.

const vertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  attribute float aSeed;

  varying vec3 vN;
  varying vec3 vSL;   // local position scaled to metres
  varying float vSeed;

  void main() {
    vec3 transformed = position;

    #ifdef USE_INSTANCING
      vec3 sc = vec3(
        length(instanceMatrix[0].xyz),
        length(instanceMatrix[1].xyz),
        length(instanceMatrix[2].xyz)
      );
      vSL = transformed * sc;
      vec4 mv = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
    #else
      vSL = transformed;
      vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
    #endif

    vN = normal; // axis-aligned boxes, no per-instance rotation
    vSeed = aSeed;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform vec3  uColor;
  uniform vec3  uLightDir;
  uniform float uSun;
  uniform float uNight;
  uniform float uOpacity;

  varying vec3 vN;
  varying vec3 vSL;
  varying float vSeed;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    #include <logdepthbuf_fragment>

    // per-instance tonal variation so a thousand boxes don't read as one
    vec3 base = uColor * (0.75 + 0.5 * fract(vSeed * 37.7));

    float nl = max(0.0, dot(normalize(vN), normalize(uLightDir)));
    vec3 col = base * (vec3(1.0, 0.85, 0.66) * nl * uSun * 1.7 + vec3(0.05, 0.06, 0.09) + 0.08 * uSun);

    // windows: wall faces only, ~1.8 x 3.0 m cells, some fraction lit
    if (abs(vN.y) < 0.5 && uNight > 0.002) {
      vec2 wc = abs(vN.x) > 0.5 ? vSL.zy : vSL.xy;
      vec2 grid = wc / vec2(1.8, 3.0);
      vec2 cellId = floor(grid);
      vec2 f = fract(grid);
      float win = step(0.28, f.x) * step(f.x, 0.72) * step(0.25, f.y) * step(f.y, 0.7);
      float lit = step(hash(cellId + vSeed * 17.0), uNight * 0.45);
      col += vec3(1.0, 0.78, 0.45) * win * lit * 1.5;
    }

    gl_FragColor = vec4(col, uOpacity);
  }
`;

export function blocks({
  count = 200,
  areaMeters = 800,        // town radius
  spacingMeters = 34,      // grid pitch
  heightMeters = [3, 10],  // power-law between the two
  footprint = 0.62,        // building width as a fraction of the pitch
  seed = 1,
  color = 0x6e5d45,
  lightDir = [0.7, 0.3, 0.5],
  sun = () => 0.6,
  night = () => 0,
  opacity = () => 1,
  respectBand = true,
} = {}) {
  const rand = rng(seed);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0); // base on the ground

  const uniforms = {
    uColor: { value: new THREE.Color(color) },
    uLightDir: { value: new THREE.Vector3(...lightDir).normalize() },
    uSun: { value: 0.6 },
    uNight: { value: 0 },
    uOpacity: { value: 1 },
  };

  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
    }),
    count,
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;

  // jittered grid, densest at the centre, thinning toward the edge — towns
  // have cores, not uniform sprawl
  const seeds = new Float32Array(count);
  const m = new THREE.Matrix4();
  const cells = Math.ceil((areaMeters * 2) / spacingMeters);
  let placed = 0;
  outer: for (let pass = 0; pass < 40 && placed < count; pass++) {
    for (let gx = 0; gx < cells && placed < count; gx++) {
      for (let gz = 0; gz < cells && placed < count; gz++) {
        const x = (gx + 0.5) * spacingMeters - areaMeters + (rand() - 0.5) * spacingMeters * 0.5;
        const z = (gz + 0.5) * spacingMeters - areaMeters + (rand() - 0.5) * spacingMeters * 0.5;
        const r = Math.hypot(x, z) / areaMeters;
        if (r > 1) continue;
        // keep-probability falls off from the core; later passes fill in
        if (rand() > (1.05 - r * 0.8) * (pass ? 0.5 : 1)) continue;
        const h = heightMeters[0] + rand() ** 2.6 * (heightMeters[1] - heightMeters[0]) * (1.1 - r * 0.55);
        const w = spacingMeters * footprint * (0.7 + rand() * 0.6);
        const d = spacingMeters * footprint * (0.7 + rand() * 0.6);
        m.makeScale(w, h, d);
        m.setPosition(x, 0, z);
        mesh.setMatrixAt(placed, m);
        seeds[placed] = rand();
        placed++;
        if (placed >= count) break outer;
      }
    }
  }
  // any never-filled instances collapse to zero scale at the origin
  m.makeScale(0, 0, 0);
  for (let i = placed; i < count; i++) mesh.setMatrixAt(i, m);
  mesh.instanceMatrix.needsUpdate = true;
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));

  const group = new THREE.Group();
  group.add(mesh);

  return {
    group,
    uniforms,
    update({ u, local, rebase, t }) {
      // instances are authored in metres, so the group carries metre→world
      group.scale.setScalar(rebase.toWorld(1));
      uniforms.uSun.value = sun({ u, local, t });
      uniforms.uNight.value = night({ u, local, t });
      const w = respectBand ? rebase.weight(areaMeters) : 1;
      const o = opacity({ u, local, rebase }) * w;
      uniforms.uOpacity.value = o;
      group.visible = o > 0.003;
    },
    dispose() {
      geo.dispose();
      mesh.material.dispose();
      mesh.dispose();
    },
  };
}
