import * as THREE from 'three';

// A wave surface, seen from ABOVE and from BELOW.
//
// The second half is the whole point. "Life leaves the water" is a beat that
// has to start underwater and end on a shore, and the only honest way to do it
// is to let the camera pass through the surface — which means one object that
// looks right from both sides, not a sky plane swapped for a sea plane.
//
// Above: Fresnel between deep water and sky, plus specular glitter.
// Below: a mirror of the dark deep everywhere except Snell's window — the
// bright cone directly overhead, about 49° from vertical, through which the
// entire sky is compressed. That circle of light is the single most recognisable
// thing about being underwater, and it costs one smoothstep.
//
// Pairs with backdrop.js (sky/water dome) and terrain.js (the bottom).

const vertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  uniform float uTime;
  uniform float uAmp;     // normalized: waveMeters / radiusMeters
  uniform float uFreq;    // radians per normalized unit
  uniform float uChop;

  varying vec3  vPos;
  varying vec3  vN;
  varying vec3  vView;
  varying float vDist;

  // Four directional waves at incommensurate angles and speeds. Deterministic
  // in uTime, which the exporter replaces with a fixed-step clock (rule 8).
  float waves(vec2 p) {
    float h = 0.0;
    h += sin(dot(p, vec2( 1.00,  0.16)) * uFreq + uTime * 1.10) * 0.50;
    h += sin(dot(p, vec2(-0.42,  0.90)) * uFreq * 1.73 + uTime * 1.55) * 0.27;
    h += sin(dot(p, vec2( 0.68, -0.73)) * uFreq * 2.91 + uTime * 2.20) * 0.15;
    h += sin(dot(p, vec2(-0.87, -0.49)) * uFreq * 4.60 + uTime * 3.05) * 0.08;
    return h;
  }

  void main() {
    vec3 p = position;
    float h = waves(p.xz);
    p.y += h * uAmp;

    // finite differences, widened by uChop so steep chop reads at any scale
    float e = 0.004;
    float hx = waves(p.xz + vec2(e, 0.0));
    float hz = waves(p.xz + vec2(0.0, e));
    vN = normalize(vec3((h - hx) * uAmp * uChop, e, (h - hz) * uAmp * uChop));

    vPos = p;
    vDist = length(p.xz);

    vec4 world = modelMatrix * vec4(p, 1.0);
    vView = world.xyz - cameraPosition;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform vec3  uDeep;      // the water body, seen from above
  uniform vec3  uSky;       // what the surface reflects
  uniform vec3  uBelow;     // the underside away from the window: a dark mirror
  uniform vec3  uWindow;    // the sky, compressed into Snell's window
  uniform vec3  uSunColor;
  uniform vec3  uSunDir;
  uniform float uSunGain;
  uniform float uOpacity;

  varying vec3  vPos;
  varying vec3  vN;
  varying vec3  vView;
  varying float vDist;

  void main() {
    #include <logdepthbuf_fragment>

    vec3 n = normalize(vN);
    vec3 v = normalize(vView);        // camera → surface
    vec3 col;

    if (gl_FrontFacing) {
      // --- from above -------------------------------------------------------
      // Grazing angles reflect the sky, steep ones show the water. This is what
      // makes a sea read as wet rather than as a coloured floor.
      float fres = pow(1.0 - clamp(dot(n, -v), 0.0, 1.0), 4.0);
      col = mix(uDeep, uSky, 0.12 + 0.88 * fres);

      vec3 refl = reflect(v, n);
      float spec = pow(max(0.0, dot(refl, normalize(uSunDir))), 180.0);
      col += uSunColor * spec * uSunGain;
    } else {
      // --- from below -------------------------------------------------------
      // Everything outside about 49° from vertical is totally internally
      // reflected — a dark mirror. Inside it, the whole sky. The wave normal
      // perturbs the boundary, which is what makes the edge of the window
      // ripple instead of sitting there as a drawn circle.
      float up = clamp(v.y + (n.x + n.z) * 0.55, 0.0, 1.0);
      float snell = smoothstep(0.42, 0.82, up);
      col = mix(uBelow, uWindow, snell);

      float spec = pow(max(0.0, dot(reflect(v, -n), normalize(uSunDir))), 60.0);
      col += uSunColor * spec * snell * uSunGain * 0.5;
    }

    // Same lesson as terrain.js: the mesh is a SQUARE, and its corners read as
    // a sheet against the backdrop unless the alpha is cut to a circle.
    float edge = 1.0 - smoothstep(0.80, 0.99, vDist);

    gl_FragColor = vec4(col, uOpacity * edge);
  }
`;

export function water({
  radiusMeters,
  // Surface height in metres. Driving this THROUGH the camera is how a beat
  // crosses the waterline — see the Devonian shore in big-bang.
  levelMeters = 0,
  waveMeters = 0.09,      // amplitude
  wavelengthMeters = 2.4,
  chop = 1,
  deep = 0x0a2436,
  sky = 0x6f9dc4,
  below = 0x030a12,
  windowColor = 0x9fc8e4, // NB not `window` — it would shadow the global here
  sunColor = 0xffe6bd,
  sunDir = [0.55, 0.62, -0.55],
  sunGain = 1,
  drive = null,           // per-frame colour/level overrides
  opacity = () => 1,
  segments = 160,
  // Off by default, exactly as terrain.js is: a sea is SUPPOSED to run many
  // frame-widths to the horizon, and the band would read that as "left behind
  // by the scale law" and fade it out. Gate entry and exit on the frame width
  // in the layer's own opacity instead.
  respectBand = false,
} = {}) {
  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: waveMeters / radiusMeters },
    uFreq: { value: (Math.PI * 2 * radiusMeters) / wavelengthMeters },
    uChop: { value: chop },
    uDeep: { value: new THREE.Color(deep) },
    uSky: { value: new THREE.Color(sky) },
    uBelow: { value: new THREE.Color(below) },
    uWindow: { value: new THREE.Color(windowColor) },
    uSunColor: { value: new THREE.Color(sunColor) },
    uSunDir: { value: new THREE.Vector3(...sunDir).normalize() },
    uSunGain: { value: sunGain },
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
      side: THREE.DoubleSide,
      depthWrite: false, // so silhouettes below the surface are not clipped away
    }),
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = -1; // after the ground, before anything standing on it

  const group = new THREE.Group();
  group.add(mesh);

  const tmp = new THREE.Color();

  return {
    group,
    uniforms,
    update({ u, local, rebase, t }) {
      group.scale.setScalar(rebase.toWorld(radiusMeters));
      uniforms.uTime.value = t;

      const d = drive ? drive({ u, local, t }) ?? {} : {};
      const lvl = d.level ?? (typeof levelMeters === 'function'
        ? levelMeters({ u, local, rebase, t })
        : levelMeters);
      group.position.y = rebase.toWorld(lvl);

      if (d.deep !== undefined) uniforms.uDeep.value.set(tmp.set(d.deep));
      if (d.sky !== undefined) uniforms.uSky.value.set(tmp.set(d.sky));
      if (d.below !== undefined) uniforms.uBelow.value.set(tmp.set(d.below));
      if (d.windowColor !== undefined) uniforms.uWindow.value.set(tmp.set(d.windowColor));
      if (d.sunGain !== undefined) uniforms.uSunGain.value = d.sunGain;

      const w = respectBand ? rebase.weight(radiusMeters) : 1;
      const o = opacity({ u, local, rebase }) * w;
      uniforms.uOpacity.value = o;
      group.visible = o > 0.003;
    },
    dispose() {
      geo.dispose();
      mesh.material.dispose();
    },
  };
}
