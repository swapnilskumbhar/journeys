import * as THREE from 'three';

// CLOUD DECK — stacked horizontal planes carrying multi-octave noise, meant to
// be flown THROUGH.
//
// Cloud was previously 3,000 normal-blended point sprites. Sprites are round,
// hard-edged and all the same shape, so a field of them reads as a heap of
// cotton balls rather than as weather — one of the clearest name-the-object
// failures in the project. It is not fixable by tuning count or size: the
// shape of a sprite is the problem.
//
// What actually says "cloud" is structure at several scales at once (a broad
// mass, billows on it, wisps off the edges), a SOFT alpha boundary, and the
// fact that a deck is a LAYER — flat, thin, extending past the horizon. All
// three come naturally from noise on a plane and from none of them from points.
//
// Several planes rather than one, because a single plane has no thickness: the
// parallax between two or three layers as the camera descends through them is
// what makes the deck feel like it has a top and a bottom, and it is what turns
// "passing the cloud layer" into a moment rather than a cut.
//
//   cloudDeck({
//     radiusMeters, altitudeMeters,   // altitude may be a per-frame function
//     layers, thicknessMeters,        // vertical spread of the stack
//     coverage,                       // 0..1 — how much sky is filled
//     scale,                          // noise frequency; bigger = smaller puffs
//     color, shadowColor, sunDir,
//     opacity, offsetMeters, respectBand,
//   })
export function cloudDeck({
  radiusMeters,
  altitudeMeters = 0,
  layers = 3,
  thicknessMeters = 600,
  coverage = 0.5,
  scale = 3.2,
  color = 0xf4f7fb,
  shadowColor = 0x8f9cad,
  sunDir = [0.8, 0.3, 0.5],
  seed = 1,
  opacity = () => 1,
  offsetMeters = null,
  respectBand = false,
} = {}) {
  const group = new THREE.Group();
  const geometries = [];
  const materials = [];

  const sun = new THREE.Vector3(...sunDir).normalize();

  // One shared geometry: a unit plane laid flat. Each layer is the same plane
  // at a different height with a different noise offset.
  const geo = new THREE.PlaneGeometry(2, 2, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geometries.push(geo);

  const vertex = /* glsl */`
    varying vec2 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  // Value noise + fbm. Cheap, and the only thing that matters here is that the
  // result has detail at several frequencies.
  const fragment = /* glsl */`
    precision highp float;
    varying vec2 vUv;
    varying vec3 vWorld;
    uniform vec3 uColor;
    uniform vec3 uShadow;
    uniform vec3 uSun;
    uniform float uOpacity;
    uniform float uCoverage;
    uniform float uScale;
    uniform float uSeed;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float a = 0.5, s = 0.0;
      for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
      return s;
    }

    void main() {
      vec2 p = (vUv - 0.5) * uScale + uSeed;
      float n = fbm(p);
      // Coverage is a THRESHOLD on the noise, not a multiplier on alpha. That is
      // the difference between broken cloud with real gaps and a uniform haze:
      // raising coverage grows the masses outward from where they already are.
      float a = smoothstep(1.0 - uCoverage - 0.22, 1.0 - uCoverage + 0.16, n);
      if (a <= 0.002) discard;

      // Fade the rim of the plane to nothing so its square edge never shows —
      // the same lesson terrain.js records about its own corners.
      float r = length(vUv - 0.5) * 2.0;
      a *= smoothstep(1.0, 0.62, r);

      // Shading from the noise gradient: sample the field slightly toward the
      // sun and darken where the cloud is thicker on that side. It is not a
      // volumetric solution and does not need to be — it gives the billows a
      // lit face and a shaded underside, which is all the eye is asking for.
      float d = 0.06;
      float ns = fbm(p + uSun.xz * d);
      float lit = clamp(0.5 + (n - ns) * 3.4, 0.0, 1.0);
      vec3 col = mix(uShadow, uColor, lit);

      gl_FragColor = vec4(col, a * uOpacity);
    }
  `;

  for (let i = 0; i < layers; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uShadow: { value: new THREE.Color(shadowColor) },
        uSun: { value: sun },
        uOpacity: { value: 0 },
        uCoverage: { value: coverage },
        uScale: { value: scale * (1 + i * 0.35) },
        uSeed: { value: seed * 7.3 + i * 19.7 },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    materials.push(mat);
    const m = new THREE.Mesh(geo, mat);
    // RENDER ORDER, explicitly. Both this deck and the terrain under it are
    // transparent, and Three sorts transparent objects by distance to the
    // camera — which for two near-coplanar sheets seen almost edge-on is a
    // coin toss that the ground kept winning. The deck was mounted, visible
    // and at 0.86 opacity while being drawn underneath the ground it floats
    // above. Sorting is not a reliable way to express "this is on top"; saying
    // so is.
    m.renderOrder = 6 + i;
    // Spread the stack about the deck's own altitude, so the camera enters the
    // top of it and leaves the bottom.
    m.userData.dy = (i / Math.max(1, layers - 1) - 0.5) * thicknessMeters;
    group.add(m);
  }

  return {
    group,
    materials,
    update({ u, local, rebase, t }) {
      const r = typeof radiusMeters === 'function' ? radiusMeters({ u, local, rebase, t }) : radiusMeters;
      const alt = typeof altitudeMeters === 'function' ? altitudeMeters({ u, local, rebase, t }) : altitudeMeters;

      let base = [0, 0, 0];
      if (offsetMeters !== null) {
        const raw = typeof offsetMeters === 'function' ? offsetMeters({ u, local, rebase, t }) : offsetMeters;
        base = Array.isArray(raw) ? raw : [raw, 0, 0];
      }
      group.position.set(rebase.toWorld(base[0]), rebase.toWorld(base[1]), rebase.toWorld(base[2]));

      const rw = rebase.toWorld(r);
      for (const m of group.children) {
        m.scale.set(rw, 1, rw);
        m.position.y = rebase.toWorld(alt + m.userData.dy);
      }

      const w = respectBand ? rebase.weight(r) : 1;
      const o = opacity({ u, local, rebase }) * w;
      for (const mat of materials) mat.uniforms.uOpacity.value = o;
      group.visible = o > 0.003;
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
