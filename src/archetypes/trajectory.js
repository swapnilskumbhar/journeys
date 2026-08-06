import * as THREE from 'three';
import { pointsMaterial } from './points-material.js';

// A path through space, with the part already flown drawn bright and the part
// still to fly drawn faint.
//
// That distinction is the whole archetype. A line through space is decoration;
// a line that is bright behind you and pale ahead of you is a PLAN, and every
// journey that travels somewhere needs one: a translunar coast, a Hohmann
// transfer to Mars, a gravity-assist swingby past Jupiter, a drill string going
// down through the crust. So the path is a parametric function returning
// METRES — never a preset shape — and the archetype has no opinion about where
// it goes.
//
// Positions are authored in metres and the group carries metre→world every
// frame (the same contract blocks.js and silhouette.js use), so a path written
// once is correct at every scale the rebaser passes through.

const vertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  uniform float uProgress;
  uniform float uAhead;      // opacity multiplier for the un-flown part
  uniform float uOpacity;

  attribute float aS;        // 0..1 along the path

  varying float vA;
  varying float vS;

  void main() {
    // A soft edge at the head of the trail rather than a hard cut: a line that
    // simply stops has a visible end, which reads as the geometry being broken.
    float flown = smoothstep(uProgress + 0.004, uProgress - 0.004, aS);
    vA = uOpacity * mix(uAhead, 1.0, flown);
    vS = aS;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uColor;
  uniform vec3 uColorAhead;
  uniform float uProgress;
  varying float vA;
  varying float vS;
  void main() {
    #include <logdepthbuf_fragment>
    vec3 col = mix(uColorAhead, uColor, smoothstep(uProgress + 0.004, uProgress - 0.004, vS));
    gl_FragColor = vec4(col, vA);
  }
`;

export function trajectory({
  // (s in 0..1) => [x, y, z] in METRES. Or `points`, an explicit polyline.
  path = null,
  points = null,
  samples = 260,
  progress = () => 1,
  // Marks at even intervals ALONG THE PATH. A coast with ticks on it can be
  // read as a rate; without them a long arc has no sense of speed at all.
  ticks = 0,
  tickSize = 5,
  tickColor = 0xbfe4ff,
  // The travelling body. `null` when the journey is already drawing its own
  // craft at the head of the path, which is the usual case.
  marker = null,          // { radiusMeters, color }
  markerAt = null,        // 0..1; defaults to `progress`
  color = 0x7fd8ff,
  colorAhead = 0x3a5f80,
  aheadOpacity = 0.22,
  opacity = () => 1,
  offsetMeters = null,
  // THE FRAME THE PATH IS DRAWN IN, as [x, y, z] radians, or a function of u.
  //
  // The geometry is built ONCE from `path(s)` and can only be moved afterwards,
  // which is correct — a path that is re-shaped per frame is not a path. But a
  // journey whose origin travels ALONG the path needs the whole heliocentric
  // frame to turn under it: `earth-to-mars` puts the spacecraft at the world
  // origin with +y always the direction of travel, and the direction of travel
  // swings through 180° over a Hohmann transfer. Rotating the frame is exactly
  // as rigid as translating it, and it is what lets the transfer ellipse, both
  // orbital rings and the Sun be ONE co-planar system rather than three
  // separately-authored decorations.
  rotationRad = null,
  respectBand = false,    // a path is SUPPOSED to span many frame-widths
} = {}) {
  if (!path && !points) throw new Error('trajectory needs `path` or `points`');

  const n = points ? points.length : samples;
  const pos = new Float32Array(n * 3);
  const sAttr = new Float32Array(n);
  let spanMeters = 0;
  for (let i = 0; i < n; i++) {
    const s = n === 1 ? 0 : i / (n - 1);
    const p = points ? points[i] : path(s);
    pos[i * 3] = p[0];
    pos[i * 3 + 1] = p[1];
    pos[i * 3 + 2] = p[2];
    sAttr[i] = s;
    spanMeters = Math.max(spanMeters, Math.hypot(p[0], p[1], p[2]));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aS', new THREE.BufferAttribute(sAttr, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), spanMeters * 1.2 || 1);

  const uniforms = {
    uProgress: { value: 1 },
    uAhead: { value: aheadOpacity },
    uOpacity: { value: 1 },
    uColor: { value: new THREE.Color(color) },
    uColorAhead: { value: new THREE.Color(colorAhead) },
  };

  const line = new THREE.Line(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  line.frustumCulled = false;

  const group = new THREE.Group();
  group.add(line);

  // --- ticks --------------------------------------------------------------
  let tickPoints = null;
  let tickMat = null;
  let tickGeo = null;
  if (ticks > 0) {
    const tp = new Float32Array(ticks * 3);
    const tc = new Float32Array(ticks * 3);
    const ts = new Float32Array(ticks);
    const tsc = new Float32Array(ticks);
    const c = new THREE.Color(tickColor);
    for (let i = 0; i < ticks; i++) {
      const s = (i + 0.5) / ticks;
      const p = points
        ? points[Math.min(points.length - 1, Math.round(s * (points.length - 1)))]
        : path(s);
      tp.set(p, i * 3);
      tc.set([c.r, c.g, c.b], i * 3);
      ts[i] = s;
      tsc[i] = 1;
    }
    tickGeo = new THREE.BufferGeometry();
    tickGeo.setAttribute('position', new THREE.BufferAttribute(tp, 3));
    tickGeo.setAttribute('aColor', new THREE.BufferAttribute(tc, 3));
    tickGeo.setAttribute('aSeed', new THREE.BufferAttribute(ts, 1));
    tickGeo.setAttribute('aScale', new THREE.BufferAttribute(tsc, 1));
    tickGeo.boundingSphere = geo.boundingSphere;
    tickMat = pointsMaterial({ size: tickSize, maxSize: 7 });
    tickPoints = new THREE.Points(tickGeo, tickMat);
    tickPoints.frustumCulled = false;
    group.add(tickPoints);
  }

  // --- marker -------------------------------------------------------------
  let markerPoints = null;
  let markerMat = null;
  let markerGeo = null;
  if (marker) {
    const mc = new THREE.Color(marker.color ?? 0xffffff);
    markerGeo = new THREE.BufferGeometry();
    markerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    markerGeo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array([mc.r, mc.g, mc.b]), 3));
    markerGeo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array([0.3]), 1));
    markerGeo.setAttribute('aScale', new THREE.BufferAttribute(new Float32Array([1]), 1));
    markerGeo.boundingSphere = geo.boundingSphere;
    markerMat = pointsMaterial({ size: marker.size ?? 14, maxSize: marker.maxSize ?? 26, twinkle: 0.1 });
    markerPoints = new THREE.Points(markerGeo, markerMat);
    markerPoints.frustumCulled = false;
    group.add(markerPoints);
  }

  const at = (s) => {
    const c = Math.max(0, Math.min(1, s));
    if (points) return points[Math.min(points.length - 1, Math.round(c * (points.length - 1)))];
    return path(c);
  };

  return {
    group,
    uniforms,
    update({ u, local, rebase, t }) {
      group.scale.setScalar(rebase.toWorld(1));

      if (offsetMeters !== null) {
        const raw = typeof offsetMeters === 'function'
          ? offsetMeters({ u, local, rebase, t })
          : offsetMeters;
        const [ox, oy, oz] = Array.isArray(raw) ? raw : [raw, 0, 0];
        group.position.set(rebase.toWorld(ox), rebase.toWorld(oy), rebase.toWorld(oz));
      }

      if (rotationRad !== null) {
        const r = typeof rotationRad === 'function'
          ? rotationRad({ u, local, rebase, t })
          : rotationRad;
        group.rotation.set(r[0] ?? 0, r[1] ?? 0, r[2] ?? 0);
      }

      const p = Math.max(0, Math.min(1, progress({ u, local, rebase, t })));
      uniforms.uProgress.value = p;

      const w = respectBand ? rebase.weight(spanMeters) : 1;
      const o = opacity({ u, local, rebase }) * w;
      uniforms.uOpacity.value = o;

      if (tickMat) {
        tickMat.uniforms.uTime.value = t;
        tickMat.uniforms.uOpacity.value = o * 0.7;
      }
      if (markerPoints) {
        const m = at(markerAt ? markerAt({ u, local, t }) : p);
        markerGeo.attributes.position.setXYZ(0, m[0], m[1], m[2]);
        markerGeo.attributes.position.needsUpdate = true;
        markerMat.uniforms.uTime.value = t;
        markerMat.uniforms.uOpacity.value = o;
      }

      group.visible = o > 0.003;
    },
    dispose() {
      geo.dispose();
      line.material.dispose();
      tickGeo?.dispose();
      tickMat?.dispose();
      markerGeo?.dispose();
      markerMat?.dispose();
    },
  };
}
