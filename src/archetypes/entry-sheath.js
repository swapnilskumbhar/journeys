import * as THREE from 'three';

// ENTRY SHEATH — the shock-heated gas around a body entering an atmosphere.
//
// WHY THIS IS AN ARCHETYPE AND NOT A PARTICLE FIELD.
//
// `earth-to-mars` drew its plasma sheath as `particleField({ distribution:
// 'disk', blending: 'normal', colorA: 0x3a2016, colorB: 0x140a06 })` — sixteen
// hundred nearly-black sprites in a flattened disc, offset downward by a
// fraction of the frame. A human scrolling the journey asked "what the hell is
// this dust", and that is precisely what it was: soot, smeared across the
// terrain it was drawn in front of, occluding the one thing the beat had.
//
// No parameter of `particleField` fixes that, because the defect is what a
// point sprite IS. A sheath is not a cloud of particles:
//
//   · it EMITS. It is incandescent gas at a few thousand kelvin, so it is the
//     brightest thing in the frame, and it adds to whatever is behind it. Dark
//     normal-blended sprites are the exact inverse.
//   · it is ATTACHED to the vehicle, wrapping the windward face, standing off
//     the nose by a small fraction of the body's own diameter.
//   · it TAPERS. A wake runs behind the body along the velocity vector,
//     widest at the shoulder and thinning to nothing — that taper is the only
//     thing in the picture that says which way the object is going.
//
// GENERAL ON PURPOSE (rule 2). Nothing here knows about Mars. The same
// parameters make an Apollo command module over the Pacific, a Soyuz descent
// module, a Huygens probe at Titan, a Stardust sample return, or a meteor: a
// bow cap, a wake, and the two colours that separate the compression-heated
// core from the cooler radiating edge.
//
//   entrySheath({
//     spanMeters,                 // the entry body's DIAMETER; everything scales from it
//     capRadius, capDepth,        // the bow shock over the windward face
//     standoff,                   // shock stand-off, in spans, ahead of the body
//     wakeLength, wakeBase, wakeTail,
//     breakup,                    // 0..1 — longitudinal striation in the wake
//     core, edge,                 // the two emission colours
//     gain,                       // overall brightness, usually a function of u
//     attitude, offsetMeters, opacity, respectBand,
//   })
//
// EVERYTHING IS ADDITIVE AND WRITES NO DEPTH, because incandescent gas is not a
// surface: it must not occlude the vehicle inside it, and two shells of it must
// not fight each other in the transparent sort. Its axis is local +y, and +y is
// the direction of TRAVEL — so an entry pose shared with the vehicle points
// both of them the same way by construction.

const vertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vPos = position;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

// The shell is lit by NOTHING. Its brightness is a Fresnel term — thin at the
// centre where you look straight through the gas, bright at the limb where the
// line of sight runs along it — which is what makes a volume of glowing gas
// read as a volume rather than as a painted surface. Same reason a planet's
// atmosphere shell works.
const fragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3  uCore;
  uniform vec3  uEdge;
  uniform float uGain;
  uniform float uOpacity;
  uniform float uBreakup;
  uniform float uTime;
  uniform float uAxial;    // 0 = cap (no taper fade), 1 = wake (fades to the tail)
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vView;

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

    vec3 n = normalize(vN);
    vec3 v = normalize(vView);
    // Limb brightening. abs() because the shell is DoubleSide and the reader
    // sees the inside of the far half through the near half.
    float fres = pow(1.0 - abs(dot(n, v)), 2.2);
    float k = clamp(fres * 1.15, 0.0, 1.0);
    vec3 col = mix(uCore, uEdge, k);

    // Longitudinal breakup — the streaming, striated structure a real sheath
    // has along the flow. Two scales, drifting slowly down the axis, so the
    // wake is gas rather than an airbrushed cone. uTime is the stage's
    // virtual clock (rule 8: layers get t, the camera does not).
    float ang = atan(vPos.z, vPos.x);
    float s = vPos.y;
    float streak = vnoise(vec2(ang * 3.2, s * 9.0 - uTime * 1.4)) * 0.62
                 + vnoise(vec2(ang * 7.4, s * 22.0 - uTime * 2.6)) * 0.38;
    float striate = mix(1.0, 0.35 + 1.05 * streak, uBreakup);

    // The wake thins out along its own length; the cap does not.
    float taper = mix(1.0, smoothstep(-1.0, -0.02, s), uAxial);

    // GAIN DRIVES OPACITY, NOT COLOUR. Multiplying both squares it, and under
    // this stage's 0.42 bloom threshold an additive shell at full gain is a
    // blown white sail with none of the striation left in it — the blowout
    // failure mode, arrived at from the honest direction.
    float a = uOpacity * uGain * (0.15 + 0.78 * k) * striate * taper;
    gl_FragColor = vec4(col * (0.46 + 0.60 * k), clamp(a, 0.0, 1.0));
  }
`;

export function entrySheath({
  spanMeters = 1,
  // The bow shock over the windward face: a shallow cap, WIDER than the body
  // (the shock stands off around the shoulder) and standing off ahead of it.
  capRadius = 0.62,
  capDepth = 0.30,
  standoff = 0.10,
  // The wake, in spans. Long, wide at the shoulder, nearly closed at the tail —
  // that ratio is the whole read, and a wake that does not taper is a tube.
  wakeLength = 2.6,
  wakeBase = 0.52,
  wakeTail = 0.06,
  breakup = 0.85,
  core = 0xfff0c8,
  edge = 0xff7428,
  gain = () => 1,
  // radians, [pitch, yaw, roll]. Local +y is the direction of travel.
  attitude = () => [0, 0, 0],
  offsetMeters = null,
  opacity = () => 1,
  respectBand = false,
} = {}) {
  const group = new THREE.Group();
  const geometries = [];
  const materials = [];

  const mkMat = (axial) => {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uCore: { value: new THREE.Color(core) },
        uEdge: { value: new THREE.Color(edge) },
        uGain: { value: 1 },
        uOpacity: { value: 1 },
        uBreakup: { value: breakup },
        uTime: { value: 0 },
        uAxial: { value: axial },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    materials.push(m);
    return m;
  };

  // --- the bow cap ---------------------------------------------------------
  // A blunt sphere-cone shell over the windward face, built as a lathe so its
  // profile can be genuinely blunt at the stagnation point and shallow out at
  // the shoulder — the same profile the aeroshell under it has, one step wider.
  {
    const RINGS = 20;
    const profile = [];
    for (let i = 0; i <= RINGS; i++) {
      const t = i / RINGS;
      const spherical = 1 - Math.sqrt(Math.max(0, 1 - t * t));
      profile.push(new THREE.Vector2(
        Math.max(t * capRadius, 1e-4),
        capDepth * (0.55 * spherical + 0.45 * t) + standoff,
      ));
    }
    const geo = new THREE.LatheGeometry(profile, 40);
    geometries.push(geo);
    // Ahead of the body, on +y — the shock stands OFF the windward face rather
    // than sitting on it, which is the one measurable fact about a bow shock.
    // The wake trails behind on -y, so the whole object points its direction of
    // travel and a shared entry pose aims the vehicle inside it the same way.
    const cap = new THREE.Mesh(geo, mkMat(0));
    group.add(cap);
  }

  // --- the wake ------------------------------------------------------------
  // Two nested cones rather than one: an inner bright core and an outer cooler
  // envelope. A single cone has one silhouette and reads as a solid party hat;
  // two at different radii and opacities read as a volume seen through itself.
  const wakeMats = [];
  for (const [rBase, rTail, len, k] of [
    [wakeBase, wakeTail, wakeLength, 1.0],
    [wakeBase * 0.58, wakeTail * 0.5, wakeLength * 0.72, 0.7],
  ]) {
    // WIDE AT THE SHOULDER, CLOSED AT THE TAIL. `CylinderGeometry`'s first
    // radius is the +y end, and +y is where the body is — getting this backwards
    // draws a searchlight beam widening away from the vehicle, which is the
    // opposite of a wake in every respect including which way it says you are
    // going.
    const geo = new THREE.CylinderGeometry(rBase, rTail, len, 34, 8, true);
    geo.translate(0, -len / 2, 0);
    // The shader's taper term reads vPos.y over a fixed -1..0 window, so the
    // geometry is pre-divided by its own length and the mesh's scale.y carries
    // it back. One shader serves wakes of any proportion that way.
    geo.scale(1, 1 / len, 1);
    geometries.push(geo);
    const mat = mkMat(1);
    wakeMats.push([mat, k]);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(1, len, 1);
    group.add(mesh);
  }
  const gainScale = new Map(wakeMats);

  return {
    group,
    materials,
    update({ u, local, rebase, t }) {
      const meters = typeof spanMeters === 'function'
        ? spanMeters({ u, local, rebase, t })
        : spanMeters;
      group.scale.setScalar(rebase.toWorld(meters));

      if (offsetMeters !== null) {
        const raw = typeof offsetMeters === 'function'
          ? offsetMeters({ u, local, rebase, t })
          : offsetMeters;
        const [ox, oy, oz] = Array.isArray(raw) ? raw : [raw, 0, 0];
        group.position.set(rebase.toWorld(ox), rebase.toWorld(oy), rebase.toWorld(oz));
      }

      const [pitch, yaw, roll] = attitude({ u, local, t }) ?? [0, 0, 0];
      group.rotation.set(pitch, yaw, roll);

      const g = typeof gain === 'function' ? gain({ u, local, rebase, t }) : gain;
      const w = respectBand ? rebase.weight(meters) : 1;
      const o = opacity({ u, local, rebase }) * w;
      for (const m of materials) {
        m.uniforms.uTime.value = t;
        m.uniforms.uOpacity.value = o;
        m.uniforms.uGain.value = Math.max(0, g) * (gainScale.get(m) ?? 1);
      }
      group.visible = o > 0.004 && g > 0.004;
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
