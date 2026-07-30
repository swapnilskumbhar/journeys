import * as THREE from 'three';

// A material wall enclosing the camera — the general answer to "the reader is
// INSIDE a substance", which no existing archetype covered: `backdrop` is a
// sky/water dome meant to be looked THROUGH; this is the opposite case, a
// surface meant to be looked AT from every direction because it is close
// enough to occupy the whole frame. Built for `crust-to-core` (rock at every
// depth from soil to solid iron) but general — any future journey that is
// "inside" fog, ice, flesh, or a nebula's own core reuses this rather than
// getting a bespoke shell.
//
// A sphere around the camera, BackSide, sized in frame-widths like `backdrop`
// (so it always fills the view regardless of scale). Colour is driven by
// vertical direction (`vDir.y`) into horizontal BANDS — sedimentary layers
// read directly, and it is also just "close things overhead, close things
// underfoot" for a homogeneous material. Layered on top: an fbm grain/mottle
// (rock is never one flat colour), thin bright VEINS (a mineral seam, a
// kimberlite pipe scar), and a GLOW term that goes from 0 (lit only by an
// authored lamp direction — rule: below a few kilometres the only honest
// light is the material's own heat) to 1 (fully self-luminous, additive-safe
// white-hot), so the journey can cross from "rock you could hold" to "rock
// that glows" as one continuous `glow` uniform rather than a scene swap.
const vertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform vec3  uBandA;     // colour at vDir.y = -1 (below/ahead)
  uniform vec3  uBandB;     // colour at vDir.y = +1 (above/behind)
  uniform float uBandFreq;  // extra horizontal bands layered over the base gradient (0 = off)
  uniform vec3  uVein;
  uniform float uVeinDensity;  // 0 = no veins
  uniform float uVeinWidth;
  uniform vec3  uGlowColor;
  uniform float uGlow;      // 0 lit-only .. 1 fully self-luminous
  uniform vec3  uLampDir;
  uniform float uLamp;      // lamp strength — an authored, admittedly-artificial light, not sunlight
  uniform float uGrain;     // fbm mottle strength
  uniform float uOpacity;

  varying vec3 vDir;

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
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.11; a *= 0.5; }
    return s;
  }

  void main() {
    #include <logdepthbuf_fragment>

    vec3 d = normalize(vDir);
    // Spherical UV for the grain/vein fields — seams at the poles are hidden
    // by the fact this wall is never viewed edge-on to them (the camera looks
    // roughly along -z, never straight up/down for long).
    vec2 uv = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0)));

    float base = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uBandA, uBandB, base);
    if (uBandFreq > 0.0) {
      float band = fbm(vec2(d.y * uBandFreq, uv.x * 0.6));
      col = mix(col, mix(uBandA, uBandB, band), 0.6);
    }

    float grain = fbm(uv * 10.0 + 31.0);
    col *= 1.0 - uGrain * 0.5 + uGrain * grain;

    if (uVeinDensity > 0.0) {
      float v = fbm(uv * uVeinDensity + 7.0);
      float seam = smoothstep(uVeinWidth, 0.0, abs(v - 0.5));
      col = mix(col, uVein, seam);
    }

    // The lamp is an authored convention, not a real sun — it has to read as
    // illumination from every direction the camera happens to be facing, not
    // just the one hemisphere a literal fixed world-space direction would
    // light. A strong ambient floor plus a modest directional accent is what
    // keeps the "rock you could hold" stretch of the journey actually VISIBLE
    // rather than lit-facing-away and reading as a black rectangle — the
    // exact failure this project's own big-bang lessons warn against.
    float nl = max(0.0, dot(d, normalize(uLampDir)));
    vec3 litCol = col * (0.55 + nl * uLamp * 0.55);
    // Past the glow threshold the material is its OWN light source, and it
    // emits the SAME depth-driven colour (col) rather than a separate flat
    // tint — this is what keeps the outer core, the core-mantle boundary and
    // the inner core visually distinct from each other while all three are
    // self-luminous, instead of converging on one identical glow.
    vec3 glowCol = min(vec3(0.92), mix(col, uGlowColor, 0.25) * (0.8 + 0.25 * grain));
    vec3 lit = mix(litCol, glowCol, uGlow);

    gl_FragColor = vec4(lit, uOpacity);
  }
`;

export function strata({
  radiusFrames = 3,
  bandA = 0x241a12,
  bandB = 0x362615,
  bandFreq = 0,
  vein = 0xd8b878,
  veinDensity = 0,
  veinWidth = 0.05,
  glowColor = 0xff6a2a,
  glow = () => 0,
  lampDir = [0.3, 0.6, 0.5],
  lamp = () => 1,
  grain = 0.4,
  opacity = () => 1,
  drive = null,
} = {}) {
  const uniforms = {
    uBandA: { value: new THREE.Color(bandA) },
    uBandB: { value: new THREE.Color(bandB) },
    uBandFreq: { value: bandFreq },
    uVein: { value: new THREE.Color(vein) },
    uVeinDensity: { value: veinDensity },
    uVeinWidth: { value: veinWidth },
    uGlowColor: { value: new THREE.Color(glowColor) },
    uGlow: { value: 0 },
    uLampDir: { value: new THREE.Vector3(...lampDir).normalize() },
    uLamp: { value: 1 },
    uGrain: { value: grain },
    uOpacity: { value: 1 },
  };

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 28),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    }),
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;

  const group = new THREE.Group();
  group.add(mesh);
  const tmp = new THREE.Color();

  return {
    group,
    uniforms,
    update({ u, local, rebase, t }) {
      group.scale.setScalar(rebase.toWorld(rebase.frameMeters() * radiusFrames));

      if (drive) {
        const d = drive({ u, local, t }) ?? {};
        if (d.bandA !== undefined) uniforms.uBandA.value.set(tmp.set(d.bandA));
        if (d.bandB !== undefined) uniforms.uBandB.value.set(tmp.set(d.bandB));
        if (d.bandFreq !== undefined) uniforms.uBandFreq.value = d.bandFreq;
        if (d.vein !== undefined) uniforms.uVein.value.set(tmp.set(d.vein));
        if (d.veinDensity !== undefined) uniforms.uVeinDensity.value = d.veinDensity;
        if (d.grain !== undefined) uniforms.uGrain.value = d.grain;
        if (d.glowColor !== undefined) uniforms.uGlowColor.value.set(tmp.set(d.glowColor));
      }
      uniforms.uGlow.value = glow({ u, local, t });
      uniforms.uLamp.value = lamp({ u, local, t });

      const o = opacity({ u, local, rebase });
      uniforms.uOpacity.value = o;
      group.visible = o > 0.003;
    },
    dispose() {
      mesh.geometry.dispose();
      mesh.material.dispose();
    },
  };
}
