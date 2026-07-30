import * as THREE from 'three';

// The ground. A procedural heightfield disc whose surface is driven through
// human history by uniforms — savanna, then a patchwork of fields, then urban
// ground — exactly the pattern planet.js uses for geological time, one scale
// down. One terrain instance serves a whole surface era: the fbm carries
// detail across several decades of frame width, and `flatten` grows a level
// plain at the centre for settlements to stand on (floodplains are where the
// cities were, so the flattening is not even a cheat).
//
// The disc's rim never shows as an edge: the fragment shader melts the last
// 40% of the radius into the background colour, which reads as horizon haze.
//
// NOTE respectBand does not apply here and must not: a terrain is SUPPOSED to
// extend dozens of frame-widths to the horizon. It fades only on its own
// u-range envelope, and simply shrinks out of relevance during the pull-back
// to orbit.

const vertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  uniform float uAmp;    // normalized: ampMeters / radiusMeters
  uniform float uFreq;   // radius / featureMeters
  uniform float uFlatR;  // normalized flatten radius
  uniform float uSeed;

  varying vec3 vPos;
  varying vec3 vN;
  varying float vDist;
  varying float vH;    // height renormalised to 0..1, for the fissure band

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 x) {
    vec2 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.07; a *= 0.5; }
    return s;
  }
  float relief(vec2 xz) {
    return fbm(xz * uFreq + uSeed * 7.31);
  }
  float height(vec2 xz) {
    float d = length(xz);
    // level plain at the centre, easing out to full relief
    float lift = smoothstep(uFlatR * 0.35, uFlatR, d);
    return (relief(xz) - 0.5) * 2.0 * uAmp * lift;
  }

  void main() {
    vec3 p = position;
    float h = height(p.xz);
    p.y += h;

    float e = 0.006;
    float hx = height(p.xz + vec2(e, 0.0));
    float hz = height(p.xz + vec2(0.0, e));
    vN = normalize(vec3(h - hx, e, h - hz));

    vPos = p;
    vDist = length(p.xz);
    vH = relief(p.xz);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform vec3  uLightDir;
  uniform vec3  uLightCol; // sunlight tint — warm on land, blue-green below water
  uniform vec3  uHaze;     // horizon / rim colour
  uniform float uRadiusM;  // metres, for pattern scales
  uniform float uFlatR;
  uniform float uSun;      // 0 night … 1 noon
  uniform float uCover;    // vegetation
  uniform float uFields;   // farmed patchwork
  uniform float uUrban;    // built ground at the centre
  uniform vec3  uRock;     // bare substrate
  uniform vec3  uDry;      // uncovered ground (savanna gold, seabed grey…)
  uniform float uLava;     // glowing fissures — flood basalt
  uniform vec3  uLavaHot;
  uniform float uCoarse;   // metres: broad mottling wavelength
  uniform float uFine;     // metres: close-up grain wavelength
  uniform float uOpacity;

  varying vec3 vPos;
  varying vec3 vN;
  varying float vDist;
  varying float vH;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 x) {
    vec2 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  void main() {
    #include <logdepthbuf_fragment>

    vec2 wm = vPos.xz * uRadiusM; // metres — pattern scales stay physical

    // Ground cover: dry gold grass mottled toward green by uCover.
    // (NB "patch" is a GLSL reserved word)
    //
    // The two wavelengths used to be hardcoded at 420 m and 90 m, which is
    // right for a 30 km savanna and catastrophically wrong for anything small:
    // across a 60 m seafloor those noise fields vary by a fifth of one cell, so
    // the whole ground rendered as a single flat colour. Deriving them from
    // featureMeters keeps every existing surface identical and makes the
    // archetype work at 60 m as well as at 30 km.
    float mottle = vnoise(wm / uCoarse);
    vec3 rock  = uRock;
    vec3 dry   = uDry;
    vec3 green = vec3(0.135, 0.19, 0.075);
    vec3 grass = mix(dry, green, uCover * (0.35 + 0.65 * mottle));
    vec3 col = mix(rock, grass, 0.45 + 0.55 * vnoise(wm / uFine));

    // Fields: a ring of ~130 m parcels around the settled centre. Only some
    // cells are farmed, so the patchwork has gaps like real land division.
    //
    // The grid is WARPED before it is cut into cells. Straight axis-aligned
    // squares with a hard step between them rendered as a literal chessboard
    // stretching to the horizon — the single most artificial thing in the
    // journey. Real field boundaries follow contours and old paths, so a
    // low-frequency warp plus softened edges is both truer and cheaper than
    // any amount of colour tuning.
    float fieldRing = smoothstep(0.125, 0.10, vDist) * smoothstep(uFlatR * 0.55, uFlatR * 0.95, vDist);
    vec2 warp = vec2(vnoise(wm / 870.0), vnoise(wm / 640.0 + 13.0)) - 0.5;
    vec2 fw = wm / 130.0 + warp * 1.7;
    vec2 cell = floor(fw);
    float ch = hash(cell);
    float farmed = smoothstep(1.0 - uFields * 0.9, 1.03 - uFields * 0.9, ch) * uFields * fieldRing;
    vec3 crop = mix(vec3(0.34, 0.27, 0.12), vec3(0.16, 0.20, 0.09), step(0.5, hash(cell + 7.0)));
    // …and each parcel carries its own tone, so neighbours never repeat exactly
    crop *= 0.75 + 0.5 * hash(cell + 31.0);
    vec2 cf = fract(fw);
    float border = smoothstep(0.0, 0.10, cf.x) * smoothstep(1.0, 0.90, cf.x)
                 * smoothstep(0.0, 0.10, cf.y) * smoothstep(1.0, 0.90, cf.y);
    col = mix(col, crop * (0.62 + 0.38 * border), farmed);

    // built ground under the town
    float urbanZone = smoothstep(uFlatR * 0.9, uFlatR * 0.45, vDist);
    col = mix(col, vec3(0.155, 0.14, 0.12), uUrban * urbanZone);

    // Flood basalt: glowing fissures following the contours. Same narrow-band
    // trick as planet.js — fbm mostly lives near 0.5, so a wide threshold makes
    // "crack" true nearly everywhere and the ground becomes a flat orange sheet
    // with no crust at all.
    float crack = smoothstep(0.085, 0.014, abs(vH - 0.5)) * (0.45 + 0.55 * vnoise(wm / uFine));
    vec3 lavaCol = mix(vec3(0.075, 0.028, 0.020), uLavaHot, crack);
    col = mix(col, lavaCol, uLava);

    // low sun + cool ambient. The tint was hardcoded warm, which is right for
    // a savanna and wrong for a seabed: water absorbs red within a few metres,
    // so warm light thirty metres down made the Ediacaran read as a prairie at
    // dusk. Any scene that is not lit by open sunlight needs this.
    float nl = max(0.0, dot(normalize(vN), normalize(uLightDir)));
    vec3 lit = col * (uLightCol * nl * uSun * 1.9 + vec3(0.05, 0.06, 0.09) + 0.09 * uSun);

    // molten rock emits; it is not merely lit
    lit += lavaCol * uLava * crack * 1.15;

    // Rim melts into haze, then into nothing. The colour fade alone is not
    // enough: the mesh is a SQUARE plane, and during the pull-back to orbit
    // its corners read as a dark sheet against space. The alpha fade cuts the
    // ground to a soft-edged circle, so from altitude it is an island of haze.
    lit = mix(lit, uHaze, smoothstep(0.5, 0.88, vDist));
    float edge = 1.0 - smoothstep(0.86, 0.99, vDist);

    gl_FragColor = vec4(lit, uOpacity * edge);
  }
`;

export function terrain({
  radiusMeters,
  ampMeters = 26,
  featureMeters = 1300,
  seed = 1,
  haze = 0x10121e,
  rock = 0x362e24,
  dry = 0x4d4120,
  lavaHot = 0xff6b12,
  // Colour-pattern wavelengths in metres. Default to fractions of featureMeters
  // so they follow the relief at any size; override only to decouple the two.
  coarseMeters = null,
  fineMeters = null,
  flattenMeters = 600,
  lightDir = [0.7, 0.3, 0.5],
  lightColor = 0xffd9a8,
  // Displacement from the journey origin, in METRES — the same contract
  // particleField, silhouette, blocks, blob and glowSphere already carry. Its
  // absence here was an inconsistency, not a decision: a journey whose origin
  // is the SPACECRAFT (earth-to-moon) needs the ground `altitude` metres below
  // the origin, and there was no sanctioned way to say so.
  offsetMeters = null,
  surface = () => ({}),
  opacity = () => 1,
  segments = 240,
} = {}) {
  const uniforms = {
    uAmp: { value: ampMeters / radiusMeters },
    uFreq: { value: radiusMeters / featureMeters },
    uFlatR: { value: flattenMeters / radiusMeters },
    uSeed: { value: seed },
    uLightDir: { value: new THREE.Vector3(...lightDir).normalize() },
    uLightCol: { value: new THREE.Color(lightColor) },
    uHaze: { value: new THREE.Color(haze) },
    uRock: { value: new THREE.Color(rock) },
    uDry: { value: new THREE.Color(dry) },
    uLavaHot: { value: new THREE.Color(lavaHot) },
    uLava: { value: 0 },
    uCoarse: { value: coarseMeters ?? featureMeters * 0.32 },
    uFine: { value: fineMeters ?? featureMeters * 0.07 },
    uRadiusM: { value: radiusMeters },
    uSun: { value: 0.7 },
    uCover: { value: 0.5 },
    uFields: { value: 0 },
    uUrban: { value: 0 },
    uOpacity: { value: 1 },
  };

  const geo = new THREE.PlaneGeometry(2, 2, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const mesh = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
    }),
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = -2; // ground first, buildings next, particles last

  const group = new THREE.Group();
  group.add(mesh);

  const tmp = new THREE.Color();

  return {
    group,
    uniforms,
    update({ u, local, rebase, t }) {
      group.scale.setScalar(rebase.toWorld(radiusMeters));

      if (offsetMeters !== null) {
        const raw = typeof offsetMeters === 'function'
          ? offsetMeters({ u, local, rebase, t })
          : offsetMeters;
        const [ox, oy, oz] = Array.isArray(raw) ? raw : [raw, 0, 0];
        group.position.set(rebase.toWorld(ox), rebase.toWorld(oy), rebase.toWorld(oz));
      }

      const s = surface({ u, local, t }) ?? {};
      // Colour drives, not just scalars: a shore that comes out of the water
      // has to change both its light tint and its haze, and neither can be a
      // build-time constant when one terrain spans the crossing.
      if (s.haze !== undefined) uniforms.uHaze.value.set(tmp.set(s.haze));
      if (s.lightColor !== undefined) uniforms.uLightCol.value.set(tmp.set(s.lightColor));
      if (s.dry !== undefined) uniforms.uDry.value.set(tmp.set(s.dry));
      if (s.sun !== undefined) uniforms.uSun.value = s.sun;
      if (s.cover !== undefined) uniforms.uCover.value = s.cover;
      if (s.fields !== undefined) uniforms.uFields.value = s.fields;
      if (s.urban !== undefined) uniforms.uUrban.value = s.urban;
      if (s.lava !== undefined) uniforms.uLava.value = s.lava;
      if (s.flatten !== undefined) uniforms.uFlatR.value = s.flatten / radiusMeters;

      const o = opacity({ u, local, rebase });
      uniforms.uOpacity.value = o;
      group.visible = o > 0.003;
    },
    dispose() {
      geo.dispose();
      mesh.material.dispose();
    },
  };
}
