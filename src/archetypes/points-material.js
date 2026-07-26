import * as THREE from 'three';

// Shared point shader for every particle-based archetype (fields, filaments,
// star clouds, disks). One material, one code path — an archetype that wanted
// its own point shader would be the first crack in rule 2.
//
// Notes that cost time to rediscover:
//  · The stage runs a logarithmic depth buffer, so any custom ShaderMaterial
//    MUST include the logdepthbuf chunks or its depth is computed on a
//    different curve from everything else and sorts wrongly.
//  · Additive + depthWrite:false is what makes overlapping particles bloom
//    into light instead of punching holes in each other. depthTest stays ON so
//    solid bodies (a planet, a star) still occlude the field behind them.
//  · Point size is attenuated manually (300/-mv.z) rather than with
//    sizeAttenuation, because the scale rebaser is already changing world size
//    every frame and the two would fight.

const vertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  uniform float uSize;
  uniform float uMaxSize;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uTwinkle;
  uniform float uJitter;

  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aScale;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 p = position;

    // Thermal agitation — the hot early universe should never look posed.
    // Driven by the player's accumulated clock so the exporter reproduces it.
    if (uJitter > 0.0) {
      float s = aSeed * 6.2831853;
      p += uJitter * vec3(
        sin(uTime * 1.7 + s),
        sin(uTime * 2.3 + s * 1.7),
        sin(uTime * 1.3 + s * 2.6)
      );
    }

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float tw = 1.0 + uTwinkle * sin(uTime * 2.0 + aSeed * 6.2831853);
    // The clamp is load-bearing, not defensive. 1/z attenuation means a point
    // that drifts near the camera grows without bound; in a dense additive
    // field a handful of those cover the frame and the whole screen saturates
    // to white. Capping the sprite size is what keeps a 24,000-point plasma
    // reading as plasma instead of as an overexposure.
    gl_PointSize = clamp(uSize * aScale * tw * (300.0 / max(0.0001, -mv.z)), 0.5, uMaxSize);

    vColor = aColor;
    vAlpha = uOpacity * clamp(tw, 0.0, 2.0);

    #include <logdepthbuf_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    #include <logdepthbuf_fragment>

    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;

    // pow() tightens the core and lengthens the falloff — a soft gaussian-ish
    // dot that bloom turns into a star rather than a flat disc
    float a = pow(smoothstep(0.5, 0.0, d), 2.2);
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

export function pointsMaterial({ size = 2.2, maxSize = 16, opacity = 1, twinkle = 0, jitter = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: size },
      uMaxSize: { value: maxSize },
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uTwinkle: { value: twinkle },
      uJitter: { value: jitter },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  });
}

// Deterministic PRNG. Every archetype seeds from an explicit number so a
// journey renders identically on every machine and every export run —
// Math.random() would make rule 8 unachievable.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller, for distributions that should cluster rather than fill.
export function gaussian(rand) {
  const u = Math.max(1e-9, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}
