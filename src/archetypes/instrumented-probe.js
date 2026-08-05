import * as THREE from 'three';

// INSTRUMENTED PROBE — a deep-space robotic spacecraft: an equipment bus, a
// supported parabolic high-gain antenna, and booms leaving the bus in
// independent directions carrying generators, sensors and a scan platform.
//
// WHY THIS EXISTS. `vehicle` is an axial launch-stack generator: every primary
// mass stacks bottom-to-top on local y, its dish is a bare sphere cap on that
// same axis, and its only off-stack feature is a centreline tower. Voyager was
// being built out of it — a stage for the bus, a gold `capsule` for the
// payload, a `tower` for the magnetometer boom — and the silhouette that fell
// out of that substitution was, unavoidably, a TABLE LAMP: smooth white bowl,
// gold ball, tapered cylindrical base, one spike through the bowl. No
// parameter of `vehicle` can fix that, because the defect is the axis: a
// launch stack is symmetric about one line and an interplanetary probe is not.
//
// THE TWO THINGS THAT MAKE THE SILHOUETTE READ, both of which `vehicle` lacks:
//
//  1. THE DISH IS AN ANTENNA, NOT A BOWL. A true open paraboloid (LatheGeometry
//     from z = depth·(r/R)²), a thick separate rim ring, a distinct back face,
//     a feed horn standing off the focus, and a TRIPOD of struts holding it
//     there. The struts are most of what a stranger reads as "antenna" rather
//     than "lampshade" — they break the smooth circular silhouette into
//     something with structure in front of it.
//
//  2. IT IS ASYMMETRICAL. The bus hangs under the dish and the booms leave it
//     in three different directions, each with its own length, thickness and
//     end mass. That asymmetry is the entire difference between "a probe" and
//     "a lamp", and it is why `appendages` takes a free direction vector rather
//     than a ring count.
//
// GENERAL ON PURPOSE (rule 2). Nothing here knows about Voyager. The same
// parameters make Galileo (bus, furled HGA, a long science boom), Cassini (a
// tall stacked bus under a 4 m dish, three RTGs close in), Pioneer (small bus,
// big dish, one long RTG truss) or New Horizons (a triangular bus with the
// dish on top and a single RTG out one side). `vehicle` remains correct for
// launch stacks, landers and staged transfer vehicles — a Titan-Centaur IS a
// launch stack.
//
//   instrumentedProbe({
//     spanMeters,                 // number or fn — the model's overall envelope
//     bus:      { shape, radius, height, at, color, deckRim, modules[] },
//     hga:      { diameter, depth, at, direction, rim, faceColor, backColor,
//                 feed:{length,r}, struts:{count,r,color} },
//     appendages: [{ kind, anchor, direction, length, r, color,
//                    endModules:[{ at, kind, length, r, color }] }],
//     instruments: [{ kind, at, size, direction, color }],
//     payloadMounts: [{ kind, at, normal, size, color }],
//     lightDir, ambient, metalness, roughness,
//     attitude, offsetMeters, opacity, respectBand,
//   })
//
// EVERY DIMENSION IS A FRACTION OF `spanMeters` (rule 1). Geometry is built
// once in a unit envelope and the root is scaled by `rebase.toWorld(span)`
// every frame, so `spanMeters` may be a function of u without rebuilding a
// single buffer. Nothing below is a world-space position; `anchor` and `at`
// are MODEL geometry, which is what makes them legitimate literals.
//
// PBR NEEDS A SUN. Like `vehicle` and `tower`, hard surfaces here are
// MeshStandardMaterial, so a journey using this archetype must declare
// `stageOptions.sun` or the craft renders black. That lesson is already paid
// for in CLAUDE.md; it applies unchanged.

const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);

export function instrumentedProbe({
  spanMeters = 1,
  bus = { shape: 'octagonalDeck', radius: 0.15, height: 0.18, at: [0, -0.12, 0], color: 0x8f959d },
  hga = {
    diameter: 0.62, depth: 0.13, at: [0, 0.12, 0], direction: [0, 1, 0],
    rim: 0.018, faceColor: 0xe4e8ee, backColor: 0x9aa1aa,
  },
  appendages = [],
  instruments = [],
  payloadMounts = [],
  lightDir = [1, 0.15, 0.35],
  ambient = 0.16,
  metalness = 0.38,
  roughness = 0.55,
  // radians, [pitch (about x), yaw (about y), roll (about z)]
  attitude = () => [0, 0, 0],
  // 0 = booms folded against the bus, 1 = fully extended. Null means "always
  // deployed", which is what every cruise beat wants and therefore the
  // default. A probe spends minutes folded and decades open, so the folded
  // state has to be asked for explicitly.
  //
  // This scales each boom about its own root rather than articulating a
  // hinge, and the comment says so because the difference is visible at close
  // range: the generator cans and the sensor head grow as they travel out,
  // where the real hardware stayed one size and swung. At the sizes anything
  // in this project draws a spacecraft it reads as unfolding, and an
  // articulated version would need a hinge axis per appendage — worth doing
  // the day a journey stages deployment as its own beat rather than as a
  // moment inside one.
  deploy = null,
  offsetMeters = null,
  opacity = () => 1,
  respectBand = true,
} = {}) {
  const group = new THREE.Group();
  const geometries = [];
  const materials = [];
  const keep = (g) => { geometries.push(g); return g; };

  // `lightDir` is accepted for API symmetry with `vehicle` and `rocks` — the
  // real lighting comes from the stage's sun, but the ambient floor is what
  // stops the shadowed side of a machine in deep space going pure black, and
  // journeys author that per layer.
  void lightDir;

  const mat = (color, opts = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      metalness: opts.metalness ?? metalness,
      roughness: opts.roughness ?? roughness,
      emissive: new THREE.Color(color).multiplyScalar(ambient * 0.55 + (opts.emissive ?? 0)),
      transparent: true,
      opacity: 1,
      side: opts.side ?? THREE.FrontSide,
    });
    materials.push(m);
    return m;
  };

  const add = (parent, geo, material, pos, quat) => {
    const m = new THREE.Mesh(geo, material);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (quat) m.quaternion.copy(quat);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const dirQuat = (d, from = UP) => {
    const v = new THREE.Vector3(d[0], d[1], d[2]);
    if (v.lengthSq() < 1e-12) v.copy(from);
    v.normalize();
    return new THREE.Quaternion().setFromUnitVectors(from, v);
  };

  // A rod between two model-space points. Cylinders are built along +y and
  // rotated onto the segment, which is the only honest way to draw a strut
  // between two arbitrary points — laying them out with Euler angles is where
  // struts start missing their anchors.
  const rod = (parent, a, b, r, material, segments = 8) => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const delta = vb.clone().sub(va);
    const len = delta.length();
    if (len < 1e-6) return null;
    const geo = keep(new THREE.CylinderGeometry(r, r, len, segments, 1));
    const q = new THREE.Quaternion().setFromUnitVectors(UP, delta.clone().normalize());
    return add(parent, geo, material, va.clone().add(vb).multiplyScalar(0.5).toArray(), q);
  };

  // ---------------------------------------------------------------------
  // THE BUS — a shallow polygonal equipment deck, not a rocket stage.
  //
  // Voyager's is a ten-sided box 47 cm deep under a 3.7 m dish: WIDE and
  // FLAT. Drawing it as an end-to-end cylinder was half of why the craft read
  // as a lamp base, so the default proportion here is deliberately squat and
  // the rim rings are on by default — a bare 8-gon at this aspect is a hockey
  // puck, and the rims are what make it read as a machined deck with
  // equipment bays in it.
  // ---------------------------------------------------------------------
  if (bus) {
    const busGroup = new THREE.Group();
    busGroup.position.set(...(bus.at ?? [0, -0.12, 0]));
    group.add(busGroup);

    const r = bus.radius ?? 0.15;
    const h = bus.height ?? 0.18;
    const bodyMat = mat(bus.color ?? 0x8f959d, { roughness: 0.62 });

    let bodyGeo;
    if (bus.shape === 'box') bodyGeo = keep(new THREE.BoxGeometry(r * 2, h, r * 2));
    else if (bus.shape === 'cylinder') bodyGeo = keep(new THREE.CylinderGeometry(r, r, h, 24));
    else bodyGeo = keep(new THREE.CylinderGeometry(r, r, h, bus.sides ?? 10));
    add(busGroup, bodyGeo, bodyMat, [0, 0, 0]);

    // Deck rims, top and bottom. Two proud rings turn a solid prism into a
    // structure with a top surface and a bottom surface — at small apparent
    // sizes this is most of the detail there is, and it is the same reason
    // `vehicle` puts an interstage collar between two cylinders.
    const dr = bus.deckRim ?? 0.025;
    if (dr > 0) {
      const rimMat = mat(bus.rimColor ?? 0x4c525a, { metalness: 0.6, roughness: 0.45 });
      const rimGeo = keep(new THREE.CylinderGeometry(r * 1.08, r * 1.08, dr * 0.6, bus.sides ?? 10));
      add(busGroup, rimGeo, rimMat, [0, h * 0.5 - dr * 0.3, 0]);
      add(busGroup, rimGeo, rimMat, [0, -h * 0.5 + dr * 0.3, 0]);
    }

    // Service modules — electronics bays, thruster clusters, the propulsion
    // module. Small masses hung off the deck at authored places, because a
    // spacecraft bus in every photograph ever taken of one is lumpy.
    for (const mod of bus.modules ?? []) {
      const size = mod.size ?? [0.05, 0.05, 0.05];
      const g = mod.kind === 'cylinder'
        ? keep(new THREE.CylinderGeometry(size[0], size[0], size[1], 12))
        : keep(new THREE.BoxGeometry(size[0], size[1], size[2] ?? size[0]));
      const m = add(busGroup, g, mat(mod.color ?? 0x6b7178), mod.at ?? [0, 0, 0]);
      if (mod.direction) m.quaternion.copy(dirQuat(mod.direction));
    }
  }

  // ---------------------------------------------------------------------
  // THE HIGH-GAIN ANTENNA.
  //
  // A real paraboloid, generated as a lathe of z = depth·(r/R)². A sphere cap
  // of the same depth is visibly wrong at the rim — it curls back where a dish
  // flares out — and it cannot carry a focus, which is what the feed and the
  // struts need in order to be somewhere rather than nowhere.
  // ---------------------------------------------------------------------
  if (hga) {
    const hgaGroup = new THREE.Group();
    hgaGroup.position.set(...(hga.at ?? [0, 0.12, 0]));
    // Built with its boresight along local +z (the API's convention), then
    // turned to face `direction`.
    hgaGroup.quaternion.copy(dirQuat(hga.direction ?? [0, 1, 0], FWD));
    group.add(hgaGroup);

    const R = (hga.diameter ?? 0.62) * 0.5;
    const depth = hga.depth ?? 0.13;

    // The lathe is built about +y and the whole dish assembly is then tipped
    // so its axis is +z, which keeps `direction` meaning what it says.
    const shell = new THREE.Group();
    shell.rotation.x = Math.PI / 2;
    hgaGroup.add(shell);

    const RINGS = 24;
    const profile = [];
    for (let i = 0; i <= RINGS; i++) {
      const rr = (i / RINGS) * R;
      profile.push(new THREE.Vector2(Math.max(rr, 1e-4), depth * (rr / R) * (rr / R)));
    }
    const dishGeo = keep(new THREE.LatheGeometry(profile, 44));

    // Two meshes off one geometry so the concave face and the convex back are
    // genuinely different colours. A dish that is the same white on both sides
    // gives the reader no way to tell which way it is pointing, and "which way
    // is the antenna aimed" is the only orientation cue a probe has.
    const faceMat = mat(hga.faceColor ?? 0xe4e8ee, {
      side: THREE.BackSide, roughness: 0.34, metalness: 0.22,
    });
    const backMat = mat(hga.backColor ?? 0x9aa1aa, {
      side: THREE.FrontSide, roughness: 0.72, metalness: 0.28,
    });
    add(shell, dishGeo, faceMat);
    add(shell, dishGeo, backMat);

    // THE RIM. A paraboloid alone terminates in an infinitely thin edge, which
    // renders as a hairline that disappears at any distance. A real antenna has
    // a stiffening ring around it, and drawn as a torus it is what gives the
    // dish a hard, unmistakably circular outline against black.
    const rimR = hga.rim ?? 0.018;
    if (rimR > 0) {
      const rimGeo = keep(new THREE.TorusGeometry(R, rimR, 8, 48));
      const rimMesh = add(hgaGroup, rimGeo, mat(hga.rimColor ?? 0xb8bfc8, { roughness: 0.5 }));
      rimMesh.position.z = depth;
    }

    // Radial ribs on the BACK, which is the face a three-quarter view mostly
    // shows. Without them the back of the dish is a smooth grey dome and reads
    // as the outside of a bowl — exactly the thing being fixed here.
    const ribs = hga.ribs ?? 8;
    if (ribs > 0) {
      const ribMat = mat(hga.backColor ?? 0x9aa1aa, { roughness: 0.8, metalness: 0.2 });
      for (let i = 0; i < ribs; i++) {
        const a = (i / ribs) * Math.PI * 2;
        rod(
          hgaGroup,
          [0, 0, -rimR * 0.5],
          [Math.cos(a) * R * 0.96, Math.sin(a) * R * 0.96, depth * 0.92],
          rimR * 0.42,
          ribMat,
          5,
        );
      }
    }

    // THE FEED, ON A TRIPOD. This is the single most legible feature on the
    // whole craft: three rods converging on a small horn standing off the
    // middle of the dish. It is what a stranger names when they say "that is
    // an antenna" and not "that is a bowl".
    const feed = hga.feed ?? { length: 0.14, r: 0.018 };
    const strutSpec = hga.struts ?? { count: 3, r: 0.012 };
    const focus = [0, 0, depth + (feed.length ?? 0.14)];

    if (feed) {
      const feedMat = mat(feed.color ?? 0xc8ceD6, { metalness: 0.55, roughness: 0.4 });
      const fr = feed.r ?? 0.018;
      // A subreflector horn: a truncated cone with its wide end facing the
      // dish, plus a short can behind it.
      const horn = keep(new THREE.CylinderGeometry(fr * 1.9, fr * 0.85, fr * 2.6, 16, 1, true));
      const hm = add(hgaGroup, horn, feedMat, [0, 0, focus[2] - fr * 0.4]);
      hm.rotation.x = -Math.PI / 2;
      hm.material.side = THREE.DoubleSide;
      const can = keep(new THREE.CylinderGeometry(fr * 0.85, fr * 0.85, fr * 1.6, 14));
      const cm = add(hgaGroup, can, feedMat, [0, 0, focus[2] + fr * 1.4]);
      cm.rotation.x = -Math.PI / 2;
    }

    if (strutSpec && (strutSpec.count ?? 3) > 0) {
      const n = strutSpec.count ?? 3;
      const sr = strutSpec.r ?? 0.012;
      const strutMat = mat(strutSpec.color ?? 0xa8afb8, { metalness: 0.5, roughness: 0.5 });
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.4;
        rod(
          hgaGroup,
          [Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9, depth * 0.86],
          focus,
          sr * 0.5,
          strutMat,
          6,
        );
      }
    }
  }

  // ---------------------------------------------------------------------
  // APPENDAGES — booms leaving the bus in independent directions.
  //
  // One mechanism, four uses. `rtgBoom` carries generator cans, an
  // `instrumentMast` carries a scan platform, a `magnetometerBoom` is a
  // genuinely thin rod with a small sensor at the tip, and a `radiator` is a
  // flat panel on a short stalk. What makes each read differently is the
  // aspect ratio and what is hung on the end — not four separate code paths.
  // ---------------------------------------------------------------------
  // EACH BOOM GETS ITS OWN GROUP, PIVOTED AT ITS ROOT.
  //
  // Not tidiness — it is what makes `deploy` possible. A probe launches
  // FOLDED: Voyager's science and magnetometer booms were stowed against the
  // bus inside the shroud and only extended after separation, which is a real
  // event and one worth being able to show. Building every boom straight into
  // the shared group, as the first pass did, welds the craft permanently
  // open, and the beat where it unfolds cannot exist.
  //
  // Everything inside a boom's group is therefore authored RELATIVE TO ITS
  // ANCHOR, so scaling the group extends the boom from where it is hinged
  // rather than from the middle of the spacecraft.
  const boomGroups = [];

  for (const ap of appendages) {
    const anchor = new THREE.Vector3(...(ap.anchor ?? [0, 0, 0]));
    const dir = new THREE.Vector3(...(ap.direction ?? [1, 0, 0]));
    if (dir.lengthSq() < 1e-12) dir.set(1, 0, 0);
    dir.normalize();
    const len = ap.length ?? 0.3;
    const r = ap.r ?? (ap.kind === 'magnetometerBoom' ? 0.004 : 0.016);
    const boomMat = mat(ap.color ?? 0x8a9098, {
      roughness: ap.kind === 'magnetometerBoom' ? 0.9 : 0.6,
    });

    const apGroup = new THREE.Group();
    apGroup.position.copy(anchor);
    group.add(apGroup);
    boomGroups.push(apGroup);

    // Anchor-relative from here down: the root is the group's own origin.
    const tip = dir.clone().multiplyScalar(len);

    if (ap.kind === 'radiator') {
      // A flat panel rather than a rod: radiators are area, not length.
      const w = ap.width ?? len * 0.55;
      const g = keep(new THREE.BoxGeometry(len, len * 0.03, w));
      const m = add(apGroup, g, boomMat, dir.clone().multiplyScalar(len * 0.5).toArray());
      m.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir));
    } else {
      rod(apGroup, [0, 0, 0], tip.toArray(), r, boomMat, ap.kind === 'magnetometerBoom' ? 5 : 10);
      // A root fitting, so the boom leaves the bus from a hinge rather than
      // simply intersecting it. A rod that vanishes into a deck with no joint
      // reads as a modelling mistake.
      const fitGeo = keep(new THREE.CylinderGeometry(r * 2.6, r * 2.6, r * 3.4, 10));
      const fm = add(apGroup, fitGeo, mat(ap.fittingColor ?? 0x555b63, { metalness: 0.6 }),
        dir.clone().multiplyScalar(r * 2.2).toArray());
      fm.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(UP, dir));
    }

    for (const em of ap.endModules ?? []) {
      const at = em.at ?? 0.8;
      const centre = dir.clone().multiplyScalar(len * at);
      const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
      const emColor = em.color ?? (em.kind === 'rtg' ? 0x2a2c30 : 0x9aa1aa);

      if (em.kind === 'rtg') {
        // A radioisotope generator: a dark can with cooling fins. DARK is the
        // point — an RTG is a black-anodised heat radiator, and drawing it
        // pale loses the tonal contrast against the white dish that makes the
        // boom legible at all.
        const cl = em.length ?? 0.10;
        const cr = em.r ?? 0.045;
        const canMat = mat(emColor, { roughness: 0.85, metalness: 0.3 });
        const canGeo = keep(new THREE.CylinderGeometry(cr, cr, cl, 14));
        add(apGroup, canGeo, canMat, centre.toArray(), q);
        const finGeo = keep(new THREE.BoxGeometry(cr * 2.5, cl * 0.94, cr * 0.16));
        for (let i = 0; i < (em.fins ?? 4); i++) {
          const fin = add(apGroup, finGeo, canMat, centre.toArray(), q);
          fin.rotateY((i / (em.fins ?? 4)) * Math.PI);
        }
      } else if (em.kind === 'scanPlatform') {
        // The steerable instrument platform: a body with two barrels on it.
        // Barrels are what make it read as CAMERAS rather than as a box.
        const s = em.length ?? 0.09;
        const bodyMat = mat(emColor, { roughness: 0.5 });
        add(apGroup, keep(new THREE.BoxGeometry(s, s * 0.8, s * 0.8)), bodyMat, centre.toArray(), q);
        const barrel = keep(new THREE.CylinderGeometry(s * 0.22, s * 0.26, s * 1.1, 12));
        for (const off of [-0.26, 0.26]) {
          const bm = add(apGroup, barrel, mat(em.barrelColor ?? 0x33373d, { roughness: 0.4 }),
            centre.clone().addScaledVector(dir, s * 0.2).toArray(), q);
          bm.translateOnAxis(new THREE.Vector3(1, 0, 0), s * off);
          bm.rotateX(Math.PI / 2);
        }
      } else {
        // A generic sensor head — the magnetometer tip, a plasma detector, a
        // star tracker.
        const s = em.r ?? 0.02;
        add(apGroup, keep(new THREE.BoxGeometry(s * 2, s * 2, s * 2.6)), mat(emColor, { roughness: 0.6 }),
          centre.toArray(), q);
      }
    }
  }

  // ---------------------------------------------------------------------
  // INSTRUMENTS — small masses bolted to the bus itself, as opposed to hung
  // off a boom. Booms make the silhouette; these make the surface busy at
  // close range.
  // ---------------------------------------------------------------------
  for (const ins of instruments) {
    const size = ins.size ?? [0.04, 0.04, 0.04];
    const g = ins.kind === 'cylinder'
      ? keep(new THREE.CylinderGeometry(size[0], size[0], size[1], 12))
      : ins.kind === 'antenna'
        ? keep(new THREE.CylinderGeometry(size[0] * 0.35, size[0], size[1], 10))
        : keep(new THREE.BoxGeometry(size[0], size[1], size[2] ?? size[0]));
    const m = add(group, g, mat(ins.color ?? 0x767c84, { roughness: 0.6 }), ins.at ?? [0, 0, 0]);
    if (ins.direction) m.quaternion.copy(dirQuat(ins.direction));
  }

  // ---------------------------------------------------------------------
  // PAYLOAD MOUNTS — a physical bracket for something the journey draws
  // SEPARATELY, at close range, with its own archetype.
  //
  // This exists because the Golden Record beat had the bus as a giant
  // foreground obstruction sitting on top of the record. A mount is a
  // standoff plate: the record can be placed on its face by the journey, and
  // the structure behind it then reads as the spacecraft it is bolted to
  // rather than as an object swallowing it.
  // ---------------------------------------------------------------------
  for (const pm of payloadMounts) {
    const at = pm.at ?? [0, 0, 0];
    const size = pm.size ?? [0.2, 0.2];
    const q = dirQuat(pm.normal ?? [0, 0, 1], FWD);
    const mmat = mat(pm.color ?? 0x555b63, { roughness: 0.7, metalness: 0.4 });
    const mount = new THREE.Group();
    mount.position.set(...at);
    mount.quaternion.copy(q);
    group.add(mount);

    // The plate itself, its face perpendicular to `normal`.
    const thick = pm.thickness ?? Math.min(size[0], size[1]) * 0.10;
    add(mount, keep(new THREE.BoxGeometry(size[0], size[1], thick)), mmat, [0, 0, -thick * 0.5]);

    if (pm.kind !== 'panel') {
      // Standoff posts and a retaining lip — a bracket, not a shelf.
      const post = keep(new THREE.CylinderGeometry(thick * 0.55, thick * 0.55, size[0] * 0.35, 8));
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const p = add(mount, post, mmat,
          [sx * size[0] * 0.40, sy * size[1] * 0.40, -thick - size[0] * 0.175]);
        p.rotation.x = Math.PI / 2;
      }
      const lipGeo = keep(new THREE.BoxGeometry(size[0] * 1.04, thick * 1.4, thick * 2.2));
      add(mount, lipGeo, mmat, [0, -size[1] * 0.5, thick * 0.4]);
    }
  }

  // Every mesh in the model shares one opacity, so the list is gathered once
  // rather than traversed per frame.
  const shadedMats = materials;

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

      if (deploy) {
        // Floored rather than allowed to reach zero: a group at scale 0 has a
        // degenerate matrix, and the stowed pose is folded hardware, not
        // absent hardware.
        const dep = Math.max(0.08, Math.min(1, deploy({ u, local, t }) ?? 1));
        for (const g of boomGroups) g.scale.setScalar(dep);
      }

      const w = respectBand ? rebase.weight(meters) : 1;
      const o = opacity({ u, local, rebase }) * w;
      for (const m of shadedMats) m.opacity = o;
      group.visible = o > 0.004;

      // OPEN DEFECT, not yet diagnosed: on the Golden Record beat the bus and
      // its bracket render with the starfield showing through the metal, at a
      // measured opacity of 1. The obvious cause — `transparent: true` putting
      // an opaque hull in the transparent pass, where an additive backdrop can
      // sort in front of it — was tried and changed nothing, so it is NOT that,
      // and the next reader should not spend the round rediscovering it. The
      // stage runs a bloom composite, which is the other candidate worth ruling
      // out before touching material flags again.
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
