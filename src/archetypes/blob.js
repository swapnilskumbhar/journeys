import * as THREE from 'three';
import { rng } from './points-material.js';

// Membrane-bounded bodies: cells, vesicles, bubbles, droplets.
//
// A soft wobbling sphere that is mostly transparent in the middle and bright at
// the edge, because that is exactly what a lipid membrane does under a
// microscope — you see the rim, not the body. Rendered with the far side
// showing through the near side, which is what makes it read as a bag of fluid
// rather than a ball.
//
// Nothing here is topic-specific: "one microbe engulfs another" is two of these
// with a driven offset, and the same archetype is a rising bubble column, a
// droplet, or a spawning egg mass.

const vertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  uniform float uTime;
  uniform float uWobble;

  attribute float aSeed;

  varying vec3 vN;
  varying vec3 vView;
  varying float vSeed;

  void main() {
    vec3 n = normalize(position);
    float s = aSeed * 37.0;

    // Three incommensurate lobes, so the outline never settles into a rhythm.
    float w =
        sin(n.x * 3.1 + uTime * 0.9 + s) * 0.5
      + sin(n.y * 4.3 - uTime * 1.2 + s * 1.7) * 0.32
      + sin(n.z * 5.7 + uTime * 0.7 + s * 2.9) * 0.20;

    vec3 p = position * (1.0 + w * uWobble);

    vN = normalize(mat3(instanceMatrix) * n);
    vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vView = normalize(cameraPosition - world.xyz);
    vSeed = aSeed;

    vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform vec3  uFill;
  uniform vec3  uRim;
  uniform float uRimPower;
  uniform float uFillAlpha;
  uniform float uOpacity;

  varying vec3 vN;
  varying vec3 vView;
  varying float vSeed;

  void main() {
    #include <logdepthbuf_fragment>

    // Grazing angles look through more membrane, so the rim is where the
    // brightness is. abs() because both faces are drawn — the far wall of the
    // cell has to glow too or the body reads as a solid dome.
    float facing = abs(dot(normalize(vN), normalize(vView)));
    float rim = pow(1.0 - facing, uRimPower);

    vec3 col = mix(uFill, uRim, rim);
    float a = (uFillAlpha + rim * (1.0 - uFillAlpha)) * uOpacity;

    gl_FragColor = vec4(col, a);
  }
`;

export function blob({
  count = 1,
  radiusMeters,             // number, [min,max], or fn — the body's own size
  areaMeters = 0,           // scatter radius for count > 1
  seed = 1,
  offsetMeters = null,      // metres from the journey origin — see glow-sphere.js
  wobble = 0.06,
  fill = 0x123044,
  rim = 0x9fe0ff,
  rimPower = 2.6,
  fillAlpha = 0.10,
  opacity = () => 1,
  segments = 48,
  respectBand = true,
} = {}) {
  const rand = rng(seed);
  const range = Array.isArray(radiusMeters) ? radiusMeters : null;
  const baseMeters = range ? range[1] : (typeof radiusMeters === 'function' ? null : radiusMeters);

  const uniforms = {
    uTime: { value: 0 },
    uWobble: { value: wobble },
    uFill: { value: new THREE.Color(fill) },
    uRim: { value: new THREE.Color(rim) },
    uRimPower: { value: rimPower },
    uFillAlpha: { value: fillAlpha },
    uOpacity: { value: 1 },
  };

  const geo = new THREE.SphereGeometry(1, segments, segments / 2);
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      side: THREE.DoubleSide,
      // The far membrane must show through the near one. Writing depth would
      // let the front hemisphere occlude the back and the cell would render as
      // an opaque ball with a bright edge.
      depthWrite: false,
    }),
    count,
  );
  mesh.frustumCulled = false;

  // Instance layout is authored in normalized units and scaled to metres each
  // frame, the same contract particleField uses — no world-space position is
  // ever written here.
  const unit = [];
  const seedAttr = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = range ? range[0] + rand() * (range[1] - range[0]) : 1;
    const rr = areaMeters > 0 ? Math.cbrt(rand()) : 0;
    const th = rand() * Math.PI * 2;
    const ph = Math.acos(2 * rand() - 1);
    unit.push({
      scale: range ? r / range[1] : 1,
      x: Math.sin(ph) * Math.cos(th) * rr,
      y: Math.cos(ph) * rr,
      z: Math.sin(ph) * Math.sin(th) * rr,
    });
    seedAttr[i] = rand();
  }
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedAttr, 1));

  const group = new THREE.Group();
  group.add(mesh);
  const m = new THREE.Matrix4();

  return {
    group,
    mesh,
    uniforms,
    update({ u, local, rebase, t }) {
      const meters = typeof radiusMeters === 'function'
        ? radiusMeters({ u, local, rebase, t })
        : baseMeters;
      const rWorld = rebase.toWorld(meters);
      const aWorld = rebase.toWorld(areaMeters);

      for (let i = 0; i < count; i++) {
        const p = unit[i];
        m.makeScale(rWorld * p.scale, rWorld * p.scale, rWorld * p.scale);
        m.setPosition(p.x * aWorld, p.y * aWorld, p.z * aWorld);
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

      uniforms.uTime.value = t;
      const w = respectBand ? rebase.weight(meters) : 1;
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
