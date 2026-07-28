import * as THREE from 'three';

// A lit sky/water dome. Exists so that silhouettes have something to be
// silhouetted AGAINST — the two archetypes are a pair and neither works alone.
//
// A vertical gradient plus an optional sun disc, drawn on the inside of a
// sphere. Sized off the frame rather than in fixed metres, so it stays "the
// far distance" at every scale from a 0.5 m seafloor to a 10^6 m impact view.
//
// Underwater is the same object with different stops: dark above (the surface
// seen from below is bright), deepening blue-green below, sun a diffuse smear.

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

  uniform vec3  uTop;
  uniform vec3  uHorizon;
  uniform vec3  uBottom;
  uniform vec3  uSunColor;
  uniform vec3  uSunDir;
  uniform float uSunSize;   // angular radius, cosine threshold
  uniform float uSunSoft;
  uniform float uSunGain;   // overall strength of the sun/glare term
  uniform float uBandLift;  // brightness of the horizon band
  uniform float uOpacity;

  varying vec3 vDir;

  void main() {
    #include <logdepthbuf_fragment>

    vec3 d = normalize(vDir);
    float h = d.y;

    // two-sided gradient meeting at the horizon
    vec3 col = h >= 0.0
      ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55))
      : mix(uHorizon, uBottom, pow(clamp(-h, 0.0, 1.0), 0.5));

    // a bright band hugging the horizon — this is what actually backlights
    // anything standing on the ground
    col += uHorizon * uBandLift * exp(-abs(h) * 14.0);

    // Sun / surface glare.
    //
    // uSunGain is not a nicety. A wide soft source — the sea surface seen from
    // below is uSunSize 0.86 with uSunSoft 0.5, i.e. a pool tens of degrees
    // across — put a full-intensity white disc over a third of the frame and
    // blew out everything the scene was about. A broad source has to be DIM;
    // only a small hard one can be allowed to clip.
    float c = dot(d, normalize(uSunDir));
    float disc = smoothstep(uSunSize - uSunSoft, uSunSize, c);
    float glare = pow(max(0.0, c), 90.0) * 0.5 + pow(max(0.0, c), 8.0) * 0.12;
    col += uSunColor * (disc + glare) * uSunGain;

    gl_FragColor = vec4(col, uOpacity);
  }
`;

export function backdrop({
  radiusFrames = 8,           // multiples of the current frame width
  top = 0x0a1430,
  horizon = 0x2a3a5c,
  bottom = 0x05070f,
  sunColor = 0xffd9a0,
  sunDir = [0.7, 0.08, -0.6],
  sunSize = 0.9985,
  sunSoft = 0.0012,
  sunGain = 1,
  bandLift = 0.55,
  opacity = () => 1,
  drive = null,               // per-frame overrides, same shape as the options
} = {}) {
  const uniforms = {
    uTop: { value: new THREE.Color(top) },
    uHorizon: { value: new THREE.Color(horizon) },
    uBottom: { value: new THREE.Color(bottom) },
    uSunColor: { value: new THREE.Color(sunColor) },
    uSunDir: { value: new THREE.Vector3(...sunDir).normalize() },
    uSunSize: { value: sunSize },
    uSunSoft: { value: sunSoft },
    uSunGain: { value: sunGain },
    uBandLift: { value: bandLift },
    uOpacity: { value: 1 },
  };

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
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
  mesh.renderOrder = -10; // behind everything

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
        if (d.top !== undefined) uniforms.uTop.value.set(tmp.set(d.top));
        if (d.horizon !== undefined) uniforms.uHorizon.value.set(tmp.set(d.horizon));
        if (d.bottom !== undefined) uniforms.uBottom.value.set(tmp.set(d.bottom));
        if (d.sunColor !== undefined) uniforms.uSunColor.value.set(tmp.set(d.sunColor));
        if (d.bandLift !== undefined) uniforms.uBandLift.value = d.bandLift;
        if (d.sunGain !== undefined) uniforms.uSunGain.value = d.sunGain;
        // Size and softness are drivable for one reason: at night the source
        // is the MOON, which is a small hard disc of cold light where the sun
        // was a warm one. Swapping colour alone leaves a sun-sized moon.
        if (d.sunSize !== undefined) uniforms.uSunSize.value = d.sunSize;
        if (d.sunSoft !== undefined) uniforms.uSunSoft.value = d.sunSoft;
        if (d.sunDir !== undefined) uniforms.uSunDir.value.set(...d.sunDir).normalize();
      }

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
