import * as THREE from 'three';

// A procedural spacecraft: stacked stages, nozzles, a capsule, an escape tower,
// solar panels, a dish, landing gear and an exhaust plume — none of which knows
// what a Saturn V is.
//
// WHY THIS IS AN ARCHETYPE AND NOT A MODULE. Three journeys queued behind
// earth-to-moon need a craft: Earth→Mars wants a transfer stack with radiators,
// Voyager→Pluto wants a bus with a high-gain dish and a boom, and every one of
// them wants the thing to shed parts partway through. Modelling one rocket for
// one journey is precisely the failure rule 2 exists to prevent.
//
// EVERYTHING IS A FRACTION OF THE TOTAL LENGTH. Geometry is built once in a
// unit-length space (the stack runs y = -0.5 → +0.5) and the group is scaled by
// `rebase.toWorld(lengthMeters)` every frame. So `lengthMeters` may be a
// function of u without rebuilding a single buffer — which matters here because
// the craft's drawn size has to track the frame across eight decades.
//
// SHEDDING IS ONE MECHANISM, NOT THREE. `shed` on a stage, on the tower or on
// the legs returns 0→1 and slides that part along its own axis while fading it.
// First-stage separation, escape-tower jettison and an ascent stage leaving a
// descent stage behind are the same call with different signs.
//
// THE PLUME IS TWO CONES. An additive core (the flame, which is genuinely
// brighter than anything around it) plus a NORMAL-blended dark collar at the
// nozzle. Additive alone cannot draw the dark part of an exhaust, so an
// additive-only plume dissolves into a bright daytime sky exactly the way
// big-bang's volcanic ash and impact dust did before they were switched to
// alpha compositing.

const vertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vLocal;
  void main() {
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vView = normalize(cameraPosition - world.xyz);
    vLocal = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform vec3  uColor;
  uniform vec3  uLightDir;
  uniform vec3  uAmbient;
  uniform float uBands;     // painted roll-pattern stripes, per unit length
  uniform float uBandDepth;
  uniform float uEmissive;
  uniform float uOpacity;

  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vLocal;

  void main() {
    #include <logdepthbuf_fragment>

    vec3 n = normalize(vN);
    float nl = max(0.0, dot(n, normalize(uLightDir)));
    // A hard terminator on a white cylinder is the single most model-kit-looking
    // thing a spacecraft can do. Wrapping the lambert term keeps the shadowed
    // side readable, which is also physically what a body in sunlight next to a
    // bright planet actually looks like.
    float wrap = pow(nl * 0.62 + 0.38, 1.5);

    // Roll-pattern banding. Real launch vehicles are painted in high-contrast
    // blocks so the range cameras can measure roll; without it a white cylinder
    // has no visible rotation at all and the attitude drive does nothing you can
    // see.
    float band = uBands > 0.0
      ? step(0.5, fract(vLocal.y * uBands)) * uBandDepth
      : 0.0;
    vec3 base = uColor * (1.0 - band * 0.8);

    // A rim term, because in space the fill light is a planet and the only thing
    // separating a dark hull from a dark sky is its edge.
    float rim = pow(1.0 - max(0.0, dot(n, normalize(vView))), 3.0);

    vec3 col = base * (uAmbient + wrap * 1.35) + base * rim * 0.35 + base * uEmissive;
    gl_FragColor = vec4(col, uOpacity);
  }
`;

const plumeVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

// v of the cone geometry runs 0 at the tip and 1 at the open end; the cone is
// built pointing away from the engine, so v=1 is the throat.
const plumeFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3  uCore;
  uniform vec3  uEdge;
  uniform float uOpacity;
  uniform float uSoft;
  varying vec2 vUv;
  void main() {
    #include <logdepthbuf_fragment>
    float along = vUv.y;                 // 1 at the throat, 0 at the tip
    float hot = pow(along, uSoft);       // brightest where it leaves the nozzle
    vec3 col = mix(uEdge, uCore, hot);
    gl_FragColor = vec4(col, uOpacity * hot);
  }
`;

export function vehicle({
  // number, or ({ u, local, rebase }) => metres. Total length of the stack.
  lengthMeters = 1,
  // Bottom → top. `span` and every radius are fractions of lengthMeters.
  stages = [{ span: 0.6, r: 0.045, color: 0xe6e9ee, nozzles: 5, nozzleR: 0.016 }],
  capsule = { span: 0.07, r: 0.022, color: 0xb9c2cc, cone: 1 },
  tower = null,       // { span, r, color, shed }
  panels = null,      // { count, span, width, at, tilt, color, deploy }
  dish = null,        // { r, at, tilt, color }
  legs = null,
  // Fins / stabiliser vanes around the base of the first stage. A launch
  // vehicle without them is a smooth tube, and the tube is most of why the
  // stack read as a bollard rather than as a rocket.
  fins = null,        // { count, span, spread, footR, color, deploy }
  bands = 0,          // stripes per unit length; 0 = plain
  bandDepth = 0.75,
  plume = null,       // { span, r, core, edge, gain, soft, throttle }
  lightDir = [1, 0.15, 0.35],
  ambient = 0.16,
  // radians, [pitch (about x), yaw (about y), roll (about z)]
  attitude = () => [0, 0, 0],
  offsetMeters = null,
  opacity = () => 1,
  respectBand = true,
} = {}) {
  const group = new THREE.Group();
  const materials = [];
  const geometries = [];
  const light = new THREE.Vector3(...lightDir).normalize();

  // HARD SURFACES GET A REAL MATERIAL MODEL.
  //
  // This used to be a ShaderMaterial computing one lambert term against a
  // `lightDir` uniform, with a flat ambient floor and no specular, no
  // roughness, no shadows. That is a perfectly good way to draw a glowing
  // nebula and the wrong way to draw a machine: metal reads as metal because
  // of how its highlight moves and how it shadows itself, and none of that
  // existed. A launch vehicle came out as flat grey tubes.
  //
  // MeshStandardMaterial gets the whole lighting pipeline — the stage's
  // directional sun, the hemisphere fill, and shadow maps — for free. The one
  // thing it does not have is the painted roll pattern, so that is injected
  // with onBeforeCompile rather than given up: `bands` is what makes a
  // cylinder read as a STAGE with panel lines rather than as a smooth tube,
  // and at small apparent sizes it is most of the detail there is.
  //
  // `emissive` still means what it did (nozzle throats, lit windows), and
  // `uOpacity` is preserved as a per-material handle because `shed` fades
  // parts out as they separate.
  const mat = (color, { emissive = 0, banded = false, transparent = true } = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      // Spacecraft skin is a painted or foil-wrapped alloy: mostly rough, a
      // little metallic. Fully metallic with no environment map renders black,
      // which is the classic PBR-without-IBL trap.
      metalness: 0.35,
      roughness: 0.52,
      // Keep the old ambient contract alongside the authored emissive: journeys
      // set a floor so the unlit side never went pure black, and the hemisphere
      // light alone is dimmer than that was. (THREE.Color has no
      // addScaledVector — it is not a Vector3.)
      emissive: new THREE.Color(color).multiplyScalar(emissive + ambient * 0.55),
      transparent,
      opacity: 1,
    });
    if (banded && bands > 0) {
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uBands = { value: bands };
        shader.uniforms.uBandDepth = { value: bandDepth };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying float vBandY;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBandY = position.y;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uBands;\nuniform float uBandDepth;\nvarying float vBandY;')
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
             float bandT = fract(vBandY * uBands);
             float bandE = smoothstep(0.0, 0.06, bandT) * smoothstep(1.0, 0.94, bandT);
             diffuseColor.rgb *= 1.0 - uBandDepth * (1.0 - bandE);`,
          );
      };
      // Two materials that differ only by onBeforeCompile still share a program
      // unless their cache keys differ.
      m.customProgramCacheKey = () => `veh-band-${bands}-${bandDepth}`;
    }
    materials.push(m);
    return m;
  };

  const keep = (g) => { geometries.push(g); return g; };

  // --- the stack ----------------------------------------------------------
  // Parts are laid out bottom-up from y = -0.5 so the whole craft is centred on
  // the origin — which is the spacecraft's own position in every journey that
  // uses this, so the ship sits where the axis says it is.
  let y = -0.5;
  const parts = []; // { group, shed, dir }

  const addPart = (shed, dir) => {
    const g = new THREE.Group();
    group.add(g);
    parts.push({ group: g, shed: shed ?? null, dir });
    return g;
  };

  for (const st of stages) {
    const g = addPart(st.shed, -1);
    const h = st.span;
    const rBot = st.r;
    const rTop = st.topR ?? st.r;
    const body = new THREE.Mesh(
      keep(new THREE.CylinderGeometry(rTop, rBot, h, 28, 1, true)),
      mat(st.color ?? 0xe6e9ee, { banded: st.banded !== false }),
    );
    body.position.y = y + h / 2;
    g.add(body);

    // An interstage collar, so two stacked cylinders read as two STAGES rather
    // than as one tube with a seam. This is the only thing that makes a
    // separation legible at small sizes.
    const collar = new THREE.Mesh(
      keep(new THREE.CylinderGeometry(rTop * 1.06, rTop * 1.06, h * 0.045, 24)),
      mat(0x3c4148),
    );
    collar.position.y = y + h;
    g.add(collar);

    const n = st.nozzles ?? 0;
    if (n > 0) {
      const nr = st.nozzleR ?? rBot * 0.34;
      const nh = nr * 2.1;
      const nozzleMat = mat(0x2b2f36);
      for (let i = 0; i < n; i++) {
        // one on the axis, the rest on a ring — the F-1 arrangement, and also
        // the arrangement of nearly every clustered engine ever flown
        const onAxis = n % 2 === 1 && i === n - 1;
        const a = (i / Math.max(1, n - (n % 2 === 1 ? 1 : 0))) * Math.PI * 2;
        const rr = onAxis ? 0 : rBot * 0.52;
        const noz = new THREE.Mesh(
          keep(new THREE.CylinderGeometry(nr, nr * 0.45, nh, 14, 1, true)),
          nozzleMat,
        );
        noz.position.set(Math.cos(a) * rr, y - nh * 0.42, Math.sin(a) * rr);
        g.add(noz);
      }
    }
    y += h;
  }

  if (capsule) {
    const g = addPart(capsule.shed, -1);
    const h = capsule.span;
    const geo = capsule.cone
      ? new THREE.CylinderGeometry(capsule.r * 0.35, capsule.r, h, 24, 1, true)
      : new THREE.SphereGeometry(capsule.r, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const m = new THREE.Mesh(keep(geo), mat(capsule.color ?? 0xb9c2cc));
    m.position.y = y + h / 2;
    g.add(m);
    y += h;
  }

  if (tower) {
    // Sheds UPWARD and away: an escape tower leaves on its own motor, which is
    // the opposite direction from every other jettison on the vehicle.
    const g = addPart(tower.shed, 1);
    const h = tower.span;
    const shaft = new THREE.Mesh(
      keep(new THREE.CylinderGeometry(tower.r * 0.4, tower.r, h, 12, 1, true)),
      mat(tower.color ?? 0x8a8f96),
    );
    shaft.position.y = y + h / 2;
    g.add(shaft);
    // the truss legs that make a tower read as a tower and not as a spike
    const legMat = mat(0x6d737b);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(keep(new THREE.CylinderGeometry(tower.r * 0.12, tower.r * 0.12, h * 0.45, 6)), legMat);
      leg.position.set(Math.cos(a) * tower.r * 0.8, y + h * 0.16, Math.sin(a) * tower.r * 0.8);
      leg.rotation.z = Math.cos(a) * 0.18;
      leg.rotation.x = -Math.sin(a) * 0.18;
      g.add(leg);
    }
    y += h;
  }

  // --- appendages ---------------------------------------------------------
  let panelGroups = [];
  if (panels) {
    const pm = mat(panels.color ?? 0x1c2c52, { emissive: 0.05 });
    for (let i = 0; i < (panels.count ?? 2); i++) {
      const g = new THREE.Group();
      const a = (i / (panels.count ?? 2)) * Math.PI * 2;
      const w = new THREE.Mesh(keep(new THREE.BoxGeometry(panels.span, panels.span * 0.02, panels.width)), pm);
      // pivot at the hull so `deploy` can swing it out rather than slide it
      w.position.x = panels.span * 0.5;
      g.add(w);
      g.position.y = -0.5 + (panels.at ?? 0.7);
      g.rotation.y = a;
      group.add(g);
      panelGroups.push(g);
    }
  }

  if (dish) {
    const d = new THREE.Mesh(
      keep(new THREE.SphereGeometry(dish.r, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.34)),
      mat(dish.color ?? 0xd8dde4),
    );
    d.material.side = THREE.DoubleSide;
    d.position.y = -0.5 + (dish.at ?? 0.9);
    d.rotation.x = Math.PI + (dish.tilt ?? 0);
    group.add(d);
  }

  if (legs) {
    const legGroup = addPart(legs.shed, -1);
    const lm = mat(legs.color ?? 0x9aa0a8);
    const n = legs.count ?? 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      const strut = new THREE.Mesh(keep(new THREE.CylinderGeometry(legs.span * 0.05, legs.span * 0.05, legs.span, 8)), lm);
      const tilt = legs.spread ?? 0.6;
      strut.position.set(
        Math.cos(a) * legs.span * 0.5 * Math.sin(tilt),
        -0.5 + legs.span * 0.5 * Math.cos(tilt) - legs.span * 0.15,
        Math.sin(a) * legs.span * 0.5 * Math.sin(tilt),
      );
      strut.rotation.z = -Math.cos(a) * tilt;
      strut.rotation.x = Math.sin(a) * tilt;
      legGroup.add(strut);
      const pad = new THREE.Mesh(
        keep(new THREE.CylinderGeometry(legs.footR ?? legs.span * 0.16, legs.footR ?? legs.span * 0.16, legs.span * 0.05, 12)),
        lm,
      );
      pad.position.set(
        Math.cos(a) * legs.span * Math.sin(tilt),
        -0.5 - legs.span * 0.15 + legs.span * (1 - Math.cos(tilt)) * 0.0,
        Math.sin(a) * legs.span * Math.sin(tilt),
      );
      legGroup.add(pad);
    }
  }

  // --- the plume ----------------------------------------------------------
  let plumeCore = null;
  let plumeCollar = null;
  let plumeMat = null;
  let collarMat = null;
  if (plume) {
    plumeMat = new THREE.ShaderMaterial({
      uniforms: {
        uCore: { value: new THREE.Color(plume.core ?? 0xfff0d0) },
        uEdge: { value: new THREE.Color(plume.edge ?? 0xff7a2a) },
        uOpacity: { value: 0 },
        uSoft: { value: plume.soft ?? 1.4 },
      },
      vertexShader: plumeVertex,
      fragmentShader: plumeFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    materials.push(plumeMat);
    plumeCore = new THREE.Mesh(keep(new THREE.ConeGeometry(plume.r ?? 0.05, plume.span ?? 0.5, 24, 1, true)), plumeMat);
    plumeCore.rotation.x = Math.PI; // tip downward, throat at the engine
    group.add(plumeCore);

    // The dark collar. Rocket exhaust is not uniformly luminous — the plume has
    // a cool, smoke-laden outer sheath that OCCLUDES, and it is the only part of
    // an exhaust that reads against a bright sky. Normal blending, deliberately.
    collarMat = new THREE.ShaderMaterial({
      uniforms: {
        uCore: { value: new THREE.Color(plume.smoke ?? 0x2a2622) },
        uEdge: { value: new THREE.Color(plume.smokeEdge ?? 0x14120f) },
        uOpacity: { value: 0 },
        uSoft: { value: 0.7 },
      },
      vertexShader: plumeVertex,
      fragmentShader: plumeFragment,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    materials.push(collarMat);
    plumeCollar = new THREE.Mesh(
      keep(new THREE.ConeGeometry((plume.r ?? 0.05) * 1.55, (plume.span ?? 0.5) * 1.35, 20, 1, true)),
      collarMat,
    );
    plumeCollar.rotation.x = Math.PI;
    plumeCollar.renderOrder = -1;
    group.add(plumeCollar);
  }

  // Opacity is resolved once here rather than by traversing every frame: each
  // shed part owns its own meshes (they fade with the part), and everything
  // else — dish, panel wings — takes the vehicle's plain opacity.
  const shaded = (root) => {
    const out = [];
    root.traverse((m) => {
      if (!m.material || !m.material.isMeshStandardMaterial) return;
      if (m.material === plumeMat || m.material === collarMat) return;
      // Hard surfaces both cast and receive: a rocket has to shadow its own
      // flank and the tower has to lay a shadow across the deck, or the whole
      // point of turning shadows on is lost.
      m.castShadow = true;
      m.receiveShadow = true;
      out.push(m);
    });
    return out;
  };
  const partMeshes = parts.map((p) => shaded(p.group));
  const owned = new Set(partMeshes.flat());
  const looseMeshes = shaded(group).filter((m) => !owned.has(m));

  const shedVec = new THREE.Vector3();

  return {
    group,
    materials,
    update({ u, local, rebase, t }) {
      const meters = typeof lengthMeters === 'function'
        ? lengthMeters({ u, local, rebase, t })
        : lengthMeters;
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

      const w = respectBand ? rebase.weight(meters) : 1;
      const o = opacity({ u, local, rebase }) * w;

      // Materials are SHARED between parts (one nozzle material serves five
      // nozzles), so the per-part opacity is written mesh by mesh in stack
      // order — a shed stage is drawn before the parts still attached, and the
      // last write for a shared material is the one that is still flying.
      for (const m of looseMeshes) m.material.opacity = o;
      parts.forEach((p, i) => {
        const s = p.shed ? Math.max(0, Math.min(1, p.shed({ u, local, t }))) : 0;
        // Shed parts fall AWAY along the stack axis and fade. The distance is
        // deliberately generous — a stage that only slides a tenth of its own
        // length reads as a rendering glitch, not as a separation.
        shedVec.set(0, p.dir * s * 1.6, 0);
        p.group.position.copy(shedVec);
        const po = o * (1 - s * s);
        p.group.visible = po > 0.004;
        for (const m of partMeshes[i]) m.material.opacity = po;
      });

      if (panels) {
        const d = panels.deploy ? Math.max(0, Math.min(1, panels.deploy({ u, local, t }))) : 1;
        for (const g of panelGroups) {
          g.scale.setScalar(Math.max(0.001, d));
          g.visible = d > 0.02 && o > 0.004;
        }
      }

      if (plumeCore) {
        const th = Math.max(0, Math.min(1, plume.throttle ? plume.throttle({ u, local, t }) : 1));
        // Length, width and brightness move together: a throttled engine is a
        // shorter, dimmer, narrower flame, and driving only the opacity produces
        // a full-size ghost.
        const len = 0.25 + th * 0.95;
        plumeCore.scale.set(0.55 + th * 0.65, len, 0.55 + th * 0.65);
        plumeCore.position.y = -0.5 - (plume.span ?? 0.5) * len * 0.5;
        plumeMat.uniforms.uOpacity.value = o * th * (plume.gain ?? 0.9);
        plumeCore.visible = plumeMat.uniforms.uOpacity.value > 0.004;

        plumeCollar.scale.copy(plumeCore.scale);
        plumeCollar.position.y = plumeCore.position.y * 1.05;
        collarMat.uniforms.uOpacity.value = o * th * (plume.smokeGain ?? 0.45);
        plumeCollar.visible = collarMat.uniforms.uOpacity.value > 0.004;
      }

      group.visible = o > 0.004;
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
