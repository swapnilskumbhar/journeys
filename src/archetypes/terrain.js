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
  float height(vec2 xz) {
    float d = length(xz);
    // level plain at the centre, easing out to full relief
    float lift = smoothstep(uFlatR * 0.35, uFlatR, d);
    return (fbm(xz * uFreq + uSeed * 7.31) - 0.5) * 2.0 * uAmp * lift;
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

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform vec3  uLightDir;
  uniform vec3  uHaze;     // horizon / rim colour
  uniform float uRadiusM;  // metres, for pattern scales
  uniform float uFlatR;
  uniform float uSun;      // 0 night … 1 noon
  uniform float uCover;    // vegetation
  uniform float uFields;   // farmed patchwork
  uniform float uUrban;    // built ground at the centre
  uniform float uOpacity;

  varying vec3 vPos;
  varying vec3 vN;
  varying float vDist;

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

    // ground cover: dry gold grass mottled toward green by uCover
    // (NB "patch" is a GLSL reserved word)
    float mottle = vnoise(wm / 420.0);
    vec3 rock  = vec3(0.21, 0.18, 0.14);
    vec3 dry   = vec3(0.30, 0.255, 0.125);
    vec3 green = vec3(0.135, 0.19, 0.075);
    vec3 grass = mix(dry, green, uCover * (0.35 + 0.65 * mottle));
    vec3 col = mix(rock, grass, 0.45 + 0.55 * vnoise(wm / 90.0));

    // fields: a ring of ~130 m parcels around the settled centre. Only some
    // cells are farmed, so the patchwork has gaps like real land division.
    float fieldRing = smoothstep(0.125, 0.10, vDist) * smoothstep(uFlatR * 0.55, uFlatR * 0.95, vDist);
    vec2 cell = floor(wm / 130.0);
    float ch = hash(cell);
    float farmed = step(1.0 - uFields * 0.85, ch) * uFields * fieldRing;
    vec3 crop = mix(vec3(0.40, 0.30, 0.11), vec3(0.15, 0.215, 0.075), step(0.5, hash(cell + 7.0)));
    vec2 cf = fract(wm / 130.0);
    float border = smoothstep(0.0, 0.05, cf.x) * smoothstep(1.0, 0.95, cf.x)
                 * smoothstep(0.0, 0.05, cf.y) * smoothstep(1.0, 0.95, cf.y);
    col = mix(col, crop * (0.55 + 0.45 * border), farmed);

    // built ground under the town
    float urbanZone = smoothstep(uFlatR * 0.9, uFlatR * 0.45, vDist);
    col = mix(col, vec3(0.155, 0.14, 0.12), uUrban * urbanZone);

    // low warm sun + cool ambient
    float nl = max(0.0, dot(normalize(vN), normalize(uLightDir)));
    vec3 lit = col * (vec3(1.0, 0.85, 0.66) * nl * uSun * 1.9 + vec3(0.05, 0.06, 0.09) + 0.09 * uSun);

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
  lightDir = [0.7, 0.3, 0.5],
  surface = () => ({}),
  opacity = () => 1,
  segments = 240,
} = {}) {
  const uniforms = {
    uAmp: { value: ampMeters / radiusMeters },
    uFreq: { value: radiusMeters / featureMeters },
    uFlatR: { value: 600 / radiusMeters },
    uSeed: { value: seed },
    uLightDir: { value: new THREE.Vector3(...lightDir).normalize() },
    uHaze: { value: new THREE.Color(haze) },
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

  return {
    group,
    uniforms,
    update({ u, local, rebase, t }) {
      group.scale.setScalar(rebase.toWorld(radiusMeters));

      const s = surface({ u, local, t }) ?? {};
      if (s.sun !== undefined) uniforms.uSun.value = s.sun;
      if (s.cover !== undefined) uniforms.uCover.value = s.cover;
      if (s.fields !== undefined) uniforms.uFields.value = s.fields;
      if (s.urban !== undefined) uniforms.uUrban.value = s.urban;
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
