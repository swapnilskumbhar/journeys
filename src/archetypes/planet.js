import * as THREE from 'three';

// A procedural world whose surface can be driven through geological time.
//
// Everything is a shader uniform rather than a texture swap, so one planet can
// travel from a molten post-accretion ball, through a global ocean, to
// continents, to chlorophyll green, to a night side lit by cities — with no
// assets and no popping between states. The Earth→Mars journey will want the
// same archetype with different uniforms.
//
// Elevation is 3D value-noise fbm evaluated on the sphere normal, so there is
// no UV seam and no pole pinching.

const vertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vNormalObj;
  varying vec3 vNormalW;
  void main() {
    vNormalObj = normalize(position);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform vec3  uLightDir;
  uniform vec3  uRock;     // dry-surface base colour (Earth crust, lunar grey, Mars red)
  uniform float uMagma;    // 1 = molten, 0 = cooled
  uniform float uSeaLevel; // higher = more ocean
  uniform float uGreen;    // land vegetation
  uniform float uIce;      // polar caps
  uniform float uNight;    // city lights on the dark side
  uniform float uBands;    // latitudinal cloud banding — a gas giant, not a rock
  uniform float uBandFreq;
  uniform vec3  uBandColor;
  uniform float uOpacity;

  varying vec3 vNormalObj;
  varying vec3 vNormalW;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }

  float fbm(vec3 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return s;
  }

  void main() {
    #include <logdepthbuf_fragment>

    vec3 n = normalize(vNormalObj);
    float h = fbm(n * 2.3);
    float detail = fbm(n * 9.0);

    float land = smoothstep(uSeaLevel, uSeaLevel + 0.05, h);
    float lat = abs(n.y);

    vec3 deep    = vec3(0.008, 0.030, 0.098);
    vec3 shallow = vec3(0.030, 0.115, 0.225);
    vec3 rock    = uRock * mix(0.72, 1.18, detail);
    vec3 veg     = mix(vec3(0.055, 0.145, 0.055), vec3(0.150, 0.235, 0.085), detail);

    vec3 ocean = mix(deep, shallow, smoothstep(uSeaLevel - 0.12, uSeaLevel, h));
    // Vegetation thins toward the poles AND toward continental interiors, so
    // land never reads as a single flat wash of green.
    float fertile = smoothstep(0.12, 0.55, 1.0 - lat) * (0.55 + 0.45 * detail);
    vec3 ground = mix(rock, veg, uGreen * fertile);
    vec3 albedo = mix(ocean, ground, land);

    // Ice caps grow from the poles. The band is deliberately tight: |n.y| of
    // 0.83 is about 56° latitude, which is roughly where permanent ice starts.
    // A looser threshold whitened everything above 49° and made the planet read
    // as a snowball at every epoch.
    float ice = smoothstep(0.90 - uIce * 0.09, 0.98 - uIce * 0.09, lat + detail * 0.04);
    albedo = mix(albedo, vec3(0.82, 0.87, 0.93), ice * uIce);

    // LATITUDINAL BANDING. A gas giant has no surface to put continents on;
    // what it has is zonal wind, and the belts and zones that wind organises
    // the cloud tops into are the ONE thing that makes a tan sphere read as
    // Jupiter rather than as a ball. fbm alone cannot produce them — it is
    // isotropic by construction — so the latitude is warped by noise and then
    // sliced, which gives belts that wander and pinch the way real ones do
    // instead of a barcode. Off by default (uBands = 0), so every rocky world
    // already in this project renders exactly as before.
    float latWarp = n.y + (fbm(n * 3.4) - 0.5) * 0.14;
    float belt = smoothstep(-0.22, 0.22, sin(latWarp * uBandFreq));
    // A second, much finer set inside the first: real cloud tops have ripples
    // along the belt edges, and without them the boundaries read as painted on.
    float fine = 0.5 + 0.5 * sin(latWarp * uBandFreq * 3.7 + detail * 5.0);
    vec3 banded = uBandColor * mix(0.74, 1.22, detail * 0.6 + fine * 0.4);
    albedo = mix(albedo, banded, uBands * belt);

    // Molten phase: glowing fissures in a dark crust. The band must be NARROW —
    // fbm mostly lives near 0.5, so a wide threshold makes "crack" true almost
    // everywhere and the planet renders as a flat orange ball with no crust
    // at all.
    float crack = smoothstep(0.075, 0.012, abs(h - 0.5)) * (0.45 + 0.55 * detail);
    vec3 lava = mix(vec3(0.075, 0.028, 0.020), vec3(1.0, 0.40, 0.07), crack);
    albedo = mix(albedo, lava, uMagma);

    float lambert = max(0.0, dot(normalize(vNormalW), normalize(uLightDir)));
    float day = pow(lambert, 0.85);
    vec3 lit = albedo * (0.045 + 0.955 * day);

    // molten worlds emit; they are not merely lit
    lit += lava * uMagma * crack * 0.85;

    // city lights: dark side only, on land, clustered near coasts
    float nightMask = smoothstep(0.24, 0.0, lambert);
    float coast = smoothstep(uSeaLevel + 0.13, uSeaLevel + 0.005, h) * land;
    float cities = step(0.58, fbm(n * 30.0)) * coast * nightMask * uNight;
    lit += vec3(1.0, 0.78, 0.44) * cities * 2.4;

    gl_FragColor = vec4(lit, uOpacity);
  }
`;

const atmoVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vView = normalize(cameraPosition - world.xyz);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const atmoFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uColor;
  uniform vec3 uLightDir;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    #include <logdepthbuf_fragment>
    // A tight rim exponent draws a hard outline that reads as a sticker pasted
    // on the planet. Widening the falloff and dropping the overall strength
    // turns it back into atmosphere — thickest on the lit limb, fading into
    // nothing across the terminator.
    float rim = pow(1.0 - max(0.0, dot(normalize(vN), normalize(vView))), 3.4);
    float lit = max(0.0, dot(normalize(vN), normalize(uLightDir)));
    gl_FragColor = vec4(uColor, rim * (0.05 + 0.95 * pow(lit, 0.7)) * uOpacity * 0.55);
  }
`;

export function planet({
  radiusMeters,
  offsetMeters = null, // metres from the journey origin — see glow-sphere.js
  respectBand = true,
  lightDir = [1, 0.25, 0.4],
  rock = 0x574836,
  atmosphere = 0x5fa8ff,
  atmosphereScale = 1.022,
  segments = 96,
  spin = 0.05,
  // Gas-giant banding. `bands` is the strength (0 = a rocky world, unchanged),
  // `bandColor` the belt tint and `bandFreq` roughly twice the number of belts
  // pole to pole. Driveable per frame through `surface()` like every other
  // uniform here.
  bands = 0,
  bandColor = 0x8a6a48,
  bandFreq = 22,
  surface = () => ({}),
  opacity = () => 1,
} = {}) {
  const uniforms = {
    uLightDir: { value: new THREE.Vector3(...lightDir).normalize() },
    uRock: { value: new THREE.Color(rock) },
    uMagma: { value: 0 },
    uSeaLevel: { value: 0.52 },
    uGreen: { value: 0 },
    uIce: { value: 0 },
    uNight: { value: 0 },
    uBands: { value: bands },
    uBandFreq: { value: bandFreq },
    uBandColor: { value: new THREE.Color(bandColor) },
    uOpacity: { value: 1 },
  };

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, segments, segments / 2),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
    }),
  );

  const atmoUniforms = {
    uColor: { value: new THREE.Color(atmosphere) },
    uLightDir: uniforms.uLightDir,
    uOpacity: { value: 1 },
  };
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(atmosphereScale, segments / 2, segments / 4),
    new THREE.ShaderMaterial({
      uniforms: atmoUniforms,
      vertexShader: atmoVertex,
      fragmentShader: atmoFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    }),
  );

  const group = new THREE.Group();
  group.add(mesh, atmo);

  return {
    group,
    mesh,
    uniforms,
    update({ u, local, rebase, t }) {
      const meters = typeof radiusMeters === 'function'
        ? radiusMeters({ u, local, rebase })
        : radiusMeters;
      group.scale.setScalar(rebase.toWorld(meters));
      group.rotation.y = t * spin;

      if (offsetMeters !== null) {
        const raw = typeof offsetMeters === 'function'
          ? offsetMeters({ u, local, rebase, t })
          : offsetMeters;
        const [ox, oy, oz] = Array.isArray(raw) ? raw : [raw, 0, 0];
        group.position.set(rebase.toWorld(ox), rebase.toWorld(oy), rebase.toWorld(oz));
      }

      const s = surface({ u, local, t }) ?? {};
      if (s.magma !== undefined) uniforms.uMagma.value = s.magma;
      if (s.seaLevel !== undefined) uniforms.uSeaLevel.value = s.seaLevel;
      if (s.green !== undefined) uniforms.uGreen.value = s.green;
      if (s.ice !== undefined) uniforms.uIce.value = s.ice;
      if (s.night !== undefined) uniforms.uNight.value = s.night;
      if (s.bands !== undefined) uniforms.uBands.value = s.bands;

      const o = opacity({ u, local, rebase }) * (respectBand ? rebase.weight(meters) : 1);
      uniforms.uOpacity.value = o;
      atmoUniforms.uOpacity.value = o * (s.atmosphere ?? 1);
      group.visible = o > 0.003;
    },
    dispose() {
      mesh.geometry.dispose();
      mesh.material.dispose();
      atmo.geometry.dispose();
      atmo.material.dispose();
    },
  };
}
