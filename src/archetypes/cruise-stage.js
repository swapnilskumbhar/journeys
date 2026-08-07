import * as THREE from 'three';

// CRUISE STAGE — an interplanetary delivery vehicle: a wide flat equipment DISC
// with body-mounted solar sections, an aeroshell slung underneath it, and
// deployable array wings off the rim.
//
// WHY THIS EXISTS, and why it is not a parameter of `vehicle`.
//
// `vehicle` is an axial launch-stack generator: every primary mass stacks
// bottom-to-top on local y, and the stack's whole silhouette is a vertical
// line. `earth-to-mars` was flying one for fourteen beats with the lower stages
// shed, and a blind reviewer that never saw the copy described the entire
// cruise as "glowing cylinders, panels, spheres" — never once as a spacecraft.
// That is the same defect that produced `instrumentedProbe`: the substitution
// is wrong at the AXIS, so no parameter of the archetype being substituted can
// fix it.
//
// A real interplanetary cruise stage is not a rocket with the bottom shed. The
// Mars 2020 / MER stage is 2.65 m across and 1.6 m tall WITH the aeroshell —
// wider than it is tall, aluminium, an outer ring of ribs, solar cells in five
// sections on the disc FACE, spin-stabilised at 2 rpm. The aeroshell hangs
// under it: a bell-shaped backshell and a shallow blunt heat shield.
//
// And a disc is MORE legible at small apparent size than a tube is. A disc
// seen at any angle reads as a disc; a tube seen end-on reads as a dot, and a
// tube seen side-on reads as a line. This object has to hold fourteen beats at
// a third of the frame, so that difference is the whole job.
//
// GENERAL ON PURPOSE (rule 2). Nothing here knows about Mars. The same
// parameters make MER, Phoenix, InSight, Mars Pathfinder, a Venus entry
// probe, or a crewed-class transfer stage (a fatter disc, bigger wings, no
// aeroshell). Each of the three assemblies is independently optional, which
// also means the archetype can draw a JETTISONED HEAT SHIELD on its own — a
// shallow rigid dish tumbling and catching light on its convex face, which is
// a real object with a real shape and not the "pale bubble" a soft `blob`
// makes of it.
//
//   cruiseStage({
//     spanMeters,                        // the disc's DIAMETER; everything scales from it
//     disc:       { height, sectors, sectorGap, ribs, deckColor, cellColor,
//                   rimColor, thrusters, cellRows, cellCols, cellGap },
//     arrays:     { count, span, width, at, color, tilt, deploy,
//                   panelCount, panelGap, panelThickness, boom, hingeRadius,
//                   cellRows, cellCols, cellGap, backColor, gridColor },
//     antenna:    { diameter, depth, at, tilt, color },
//     backshell:  { diameter, topDiameter, height, at, color },
//     heatShield: { diameter, at, coneAngleDeg, noseRadius, shellThickness,
//                   tileRings, tileSectors, tileGap,
//                   tileColorA, tileColorB, tileColorC,
//                   jointColor, interiorColor, interiorRibs, ribColor,
//                   rimColor, rimScallops, rimScallop, depth (override) },
//     separate,                          // 0..1 — slides the aeroshell away
//     lightDir, ambient, metalness, roughness,
//     attitude, offsetMeters, opacity, respectBand,
//   })
//
// EVERY DIMENSION IS A FRACTION OF `spanMeters` (rule 1). Geometry is built
// once in a unit envelope — the disc runs r = ±0.5 about the origin — and the
// root is scaled by `rebase.toWorld(span)` every frame, so `spanMeters` may be
// a function of u without rebuilding a single buffer. Same contract as
// `vehicle`, `tower` and `instrumentedProbe`.
//
// PBR NEEDS A SUN. Hard surfaces here are MeshStandardMaterial, so a journey
// using this archetype must declare `stageOptions.sun` or the craft renders
// black. That lesson is already paid for in CLAUDE.md; it applies unchanged.

export function cruiseStage({
  spanMeters = 1,
  disc = {},
  arrays = null,
  antenna = null,
  backshell = null,
  heatShield = null,
  separate = null,
  // WHERE THE ARCHETYPE'S OWN ORIGIN SITS.
  //
  // 'centre' (the default, and every existing call site) puts it at the disc's
  // centre, which is right for a free-flying spacecraft: it is roughly the
  // centre of mass, so an authored attitude turns the craft about itself.
  //
  // 'aftMount' puts it at the AFT HARDPOINT — the lowest point of the assembly,
  // which is the face that bolts to a launch vehicle's payload adapter. This is
  // an archetype-level concern and not a journey-level one, because only the
  // archetype knows how deep its own aeroshell is: `earth-to-mars` was placing
  // the payload by guessing a fraction of the stack length that was supposed to
  // agree with the sum of the backshell height and the heat shield's depth, and
  // it did not — beat 7 showed open sky between two objects that are bolted
  // together. With an anchor, the journey says `offsetMeters: theJoint` and the
  // two cannot disagree. It also makes the attitude turn the payload about its
  // mount, which is what a bolted joint does.
  anchor = 'centre',
  lightDir = [1, 0.15, 0.35],
  ambient = 0.16,
  metalness = 0.36,
  roughness = 0.56,
  // radians, [pitch (about x), yaw (about y), roll (about z)]
  attitude = () => [0, 0, 0],
  offsetMeters = null,
  opacity = () => 1,
  respectBand = true,
} = {}) {
  const group = new THREE.Group();
  // Everything is built into `body`; `group` carries only the journey's own
  // position, scale and attitude. The split is what makes `anchor` possible —
  // shifting the whole assembly inside its own root moves the point the
  // attitude turns about, without any call site knowing the geometry.
  const body = new THREE.Group();
  group.add(body);
  const geometries = [];
  const materials = [];
  const keep = (g) => { geometries.push(g); return g; };

  // Accepted for API symmetry with `vehicle` and `instrumentedProbe`: the real
  // lighting is the stage's sun, and `ambient` is the floor that stops the
  // shadowed side of a machine in deep space going pure black.
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

  const add = (parent, geo, material, pos, rot) => {
    const m = new THREE.Mesh(geo, material);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // -----------------------------------------------------------------------
  // THE DISC.
  //
  // Three things turn a cylinder of aspect 8:1 into a spacecraft deck rather
  // than a hockey puck, and all three are cheap: a proud RIM ring around the
  // edge (a hard circular outline is what survives at small apparent size),
  // radial RIBS on the face, and the solar array cut into SECTORS with real
  // gaps between them. The sectors are the strongest read of the three,
  // because a face divided into wedges is unmistakably engineered — no
  // natural object looks like that.
  // -----------------------------------------------------------------------
  const discH = disc === null ? 0 : (disc.height ?? 0.20);
  if (disc !== null) {
    const R = 0.5;
    const deckMat = mat(disc.deckColor ?? 0xb6bcc4, { roughness: 0.62 });
    add(body, keep(new THREE.CylinderGeometry(R, R * 0.96, discH, 40, 1, true)), deckMat);
    // A closed underside, so the disc is a solid object seen from below rather
    // than an open can with the aeroshell visible through it.
    add(body, keep(new THREE.CircleGeometry(R * 0.96, 40)), deckMat, [0, -discH / 2, 0], [Math.PI / 2, 0, 0]);

    // The stiffening rim.
    const rimMat = mat(disc.rimColor ?? 0x767d86, { metalness: 0.6, roughness: 0.44 });
    add(body, keep(new THREE.TorusGeometry(R, discH * 0.16, 8, 44)), rimMat,
      [0, discH * 0.42, 0], [Math.PI / 2, 0, 0]);
    add(body, keep(new THREE.TorusGeometry(R * 0.97, discH * 0.12, 8, 44)), rimMat,
      [0, -discH * 0.40, 0], [Math.PI / 2, 0, 0]);

    // The solar face, in sectors — and each sector in CELLS.
    //
    // One `RingGeometry` per sector is a blue wedge, and five blue wedges under
    // grey ribs is a pie chart. A solar array is a TILED surface: rectangular
    // cells laid in rows and columns with a bright joint between every pair,
    // and that grid is what identifies it at any size where the sector gaps
    // have stopped resolving. Each radial band is one geometry instantiated
    // once per azimuthal patch per sector, so the whole face costs
    // `cellRows` geometries however many patches are drawn.
    const sectors = disc.sectors ?? 5;
    const gap = disc.sectorGap ?? 0.10;   // radians
    if (sectors > 0) {
      const cellMat = mat(disc.cellColor ?? 0x1b2a55, {
        metalness: 0.42, roughness: 0.34, emissive: 0.04,
      });
      const step = (Math.PI * 2) / sectors;
      const rows = Math.max(1, disc.cellRows ?? 3);
      const cols = Math.max(1, disc.cellCols ?? 4);
      const cGap = disc.cellGap ?? 0.006;
      const r0 = R * 0.20;
      const r1 = R * 0.94;
      const wedge = step - gap;
      const aStep = wedge / cols;
      // One geometry per radial band, spanning ONE azimuthal cell. Rotating a
      // mesh about y is free; a fresh RingGeometry per patch is not.
      const bandGeo = [];
      for (let j = 0; j < rows; j++) {
        const ra = r0 + (r1 - r0) * (j / rows) + cGap * 0.5;
        const rb = r0 + (r1 - r0) * ((j + 1) / rows) - cGap * 0.5;
        // The angular joint is a fixed ARC width, so cells near the hub are not
        // separated by a hairline while cells at the rim are separated by a
        // canyon. Half of it at each end of the patch.
        const inset = (cGap * 0.5) / Math.max(rb, 1e-4);
        bandGeo.push(keep(new THREE.RingGeometry(ra, rb, 4, 1, inset, Math.max(aStep - inset * 2, 1e-3))));
      }
      for (let i = 0; i < sectors; i++) {
        const base = i * step + gap / 2;
        for (let c = 0; c < cols; c++) {
          for (let j = 0; j < rows; j++) {
            // RingGeometry is built in the xy plane and laid flat by the -π/2
            // pitch; the azimuthal placement is therefore a ROLL about the
            // patch's own z, applied before that pitch by Euler XYZ order.
            add(body, bandGeo[j], cellMat, [0, discH * 0.51, 0],
              [-Math.PI / 2, 0, base + c * aStep]);
          }
        }
      }
    }

    // Radial ribs, standing proud of the face ON the sector boundaries — not on
    // an independent count that would land them in the middle of a panel.
    const ribs = disc.ribs ?? sectors;
    if (ribs > 0) {
      const ribMat = mat(disc.ribColor ?? disc.deckColor ?? 0xc4cad2, { roughness: 0.55 });
      const ribGeo = keep(new THREE.BoxGeometry(R * 0.76, discH * 0.24, R * 0.05));
      for (let i = 0; i < ribs; i++) {
        const a = (i / ribs) * Math.PI * 2;
        const m = add(body, ribGeo, ribMat, [0, discH * 0.54, 0], [0, -a, 0]);
        m.position.set(Math.cos(a) * R * 0.57, discH * 0.54, Math.sin(a) * R * 0.57);
      }
      // A central hub, which is where a spin-stabilised stage's plumbing goes.
      add(body, keep(new THREE.CylinderGeometry(R * 0.19, R * 0.22, discH * 0.55, 20)), ribMat,
        [0, discH * 0.42, 0]);
    }

    // Thruster pods on the rim. Small, dark, and asymmetric against the
    // otherwise perfectly circular disc — the same job the booms do on
    // `instrumentedProbe`.
    const pods = disc.thrusters ?? 4;
    if (pods > 0) {
      const podMat = mat(0x494f57, { metalness: 0.55, roughness: 0.5 });
      const podGeo = keep(new THREE.BoxGeometry(R * 0.16, discH * 0.85, R * 0.11));
      const jetGeo = keep(new THREE.CylinderGeometry(R * 0.012, R * 0.030, R * 0.075, 8, 1, true));
      for (let i = 0; i < pods; i++) {
        const a = (i / pods) * Math.PI * 2 + Math.PI / pods;
        const px = Math.cos(a) * R * 1.02;
        const pz = Math.sin(a) * R * 1.02;
        add(body, podGeo, podMat, [px, discH * 0.15, pz], [0, -a, 0]);
        const j = add(body, jetGeo, podMat, [px, discH * 0.15 - discH * 0.5, pz]);
        j.rotation.z = Math.PI;
      }
    }
  }

  // -----------------------------------------------------------------------
  // THE ARRAY WINGS.
  //
  // Body-mounted cells alone are correct for a small robotic stage and wrong
  // for anything that has to show DEPLOYMENT as an event. Wings are on a
  // pivoted group each so `deploy` swings them out from the rim rather than
  // growing them out of the middle of the vehicle.
  // -----------------------------------------------------------------------
  // A wing is a CHAIN: root hinge → panel → hinge → panel → hinge → panel.
  // `wingGroups` holds the root pivot of each wing, `foldGroups` every
  // inter-panel pivot with the sign it folds in, so `deploy` articulates a real
  // Z-fold instead of scaling one group.
  const wingGroups = [];
  const foldGroups = [];
  if (arrays && (arrays.count ?? 2) > 0) {
    const n = arrays.count ?? 2;
    const len = arrays.span ?? 0.95;
    const w = arrays.width ?? 0.34;
    const boom = arrays.boom ?? 0.16;
    const panels = Math.max(1, arrays.panelCount ?? 3);
    const pGap = arrays.panelGap ?? 0.025;
    const thick = arrays.panelThickness ?? 0.012;
    const rows = Math.max(1, arrays.cellRows ?? 4);
    const cols = Math.max(1, arrays.cellCols ?? 6);
    const cGap = arrays.cellGap ?? 0.004;
    const hingeR = arrays.hingeRadius ?? 0.012;

    const wingMat = mat(arrays.color ?? 0x22376e, {
      metalness: 0.42, roughness: 0.34, emissive: 0.04,
    });
    // THE BACK OF A PANEL IS NOT THE FRONT OF ONE. Half the time a deployed
    // wing is seen from behind, and a slab that is cell-blue on both faces
    // cannot say which way it is pointing at the Sun. The substrate is pale
    // metallic honeycomb; it catches light where the cells swallow it.
    const backMat = mat(arrays.backColor ?? 0x89939d, { roughness: 0.52, metalness: 0.5 });
    const frameMat = mat(arrays.frameColor ?? 0x9aa1aa, { roughness: 0.6 });
    const gridMat = mat(arrays.gridColor ?? 0x7890b8, {
      metalness: 0.55, roughness: 0.4, emissive: 0.02,
    });

    // One panel SECTION, in its own local frame running x = 0 → segLen.
    const segLen = Math.max((len - boom - (panels - 1) * pGap) / panels, 1e-3);
    const rail = Math.min(segLen, w) * 0.035;
    const backGeo = keep(new THREE.BoxGeometry(segLen, thick, w));
    const faceGeo = keep(new THREE.PlaneGeometry(segLen - rail * 2, w - rail * 2));
    const railX = keep(new THREE.BoxGeometry(segLen, thick * 1.5, rail));
    const railZ = keep(new THREE.BoxGeometry(rail, thick * 1.5, w));
    const barZ = keep(new THREE.BoxGeometry(cGap * 2.2, thick * 0.5, w - rail * 2));
    const barX = keep(new THREE.BoxGeometry(segLen - rail * 2, thick * 0.5, cGap * 2.2));
    const hingeGeo = keep(new THREE.CylinderGeometry(hingeR, hingeR, w * 0.9, 8));
    const yokeGeo = keep(new THREE.BoxGeometry(boom, len * 0.035, len * 0.035));
    const yokeHinge = keep(new THREE.CylinderGeometry(hingeR * 1.3, hingeR * 1.3, w * 0.9, 8));

    const buildSection = (parent) => {
      const g = new THREE.Group();
      parent.add(g);
      add(g, backGeo, backMat, [segLen * 0.5, 0, 0]);
      // The cell face, inset inside its rails and standing just proud of the
      // substrate so the rails read as a raised perimeter.
      add(g, faceGeo, wingMat, [segLen * 0.5, thick * 0.62, 0], [-Math.PI / 2, 0, 0]);
      add(g, railX, frameMat, [segLen * 0.5, 0, (w - rail) * 0.5]);
      add(g, railX, frameMat, [segLen * 0.5, 0, -(w - rail) * 0.5]);
      add(g, railZ, frameMat, [rail * 0.5, 0, 0]);
      add(g, railZ, frameMat, [segLen - rail * 0.5, 0, 0]);
      // THE CELL GRID. Thin bright bars across the blue in both directions —
      // the interconnects between cell strings. This is what makes a rectangle
      // read as an ARRAY rather than as a painted panel, and it is the one
      // feature that survives all the way down to a wing forty pixels long.
      for (let c = 1; c < cols; c++) {
        add(g, barZ, gridMat, [rail + (segLen - rail * 2) * (c / cols), thick * 0.72, 0]);
      }
      for (let r = 1; r < rows; r++) {
        add(g, barX, gridMat, [segLen * 0.5, thick * 0.72, -(w - rail * 2) * (0.5 - r / rows)]);
      }
      return g;
    };

    for (let i = 0; i < n; i++) {
      const a = (arrays.phase ?? 0) + (i / n) * Math.PI * 2;
      // Three nested frames, and the nesting is the point: `arm` turns the wing
      // onto its radial, `hinge` is the ROOT PIVOT at the rim, and everything
      // past the yoke is a chain of fold pivots.
      const arm = new THREE.Group();
      arm.rotation.y = -a;
      body.add(arm);
      const hinge = new THREE.Group();
      hinge.position.set(0.5, discH * (arrays.at ?? 0.1), 0);
      arm.add(hinge);
      wingGroups.push(hinge);

      // THE YOKE. A twin-beam boom standing the array off the bus, with a
      // transverse hinge tube across its outboard end. Without it the panels
      // grow straight out of the hull and the whole wing reads as a fin; with
      // it there is a visible joint, and a joint is what says the thing folds.
      add(hinge, yokeGeo, frameMat, [boom * 0.5, 0, w * 0.32]);
      add(hinge, yokeGeo, frameMat, [boom * 0.5, 0, -w * 0.32]);
      const yh = add(hinge, yokeHinge, frameMat, [boom, 0, 0]);
      yh.rotation.x = Math.PI / 2;

      // The fold chain.
      let parent = hinge;
      for (let p = 0; p < panels; p++) {
        const pivot = new THREE.Group();
        pivot.position.x = p === 0 ? boom : segLen + pGap;
        parent.add(pivot);
        if (p > 0) foldGroups.push({ g: pivot, sign: p % 2 ? 1 : -1 });
        const sec = buildSection(pivot);
        sec.rotation.z = arrays.tilt ?? 0;
        // A hinge tube in every inter-panel gap. The gaps are real gaps — you
        // can see through them — and a tube in each is what stops them reading
        // as three separate rectangles that happen to be in a row.
        if (p < panels - 1) {
          const h = add(pivot, hingeGeo, frameMat, [segLen + pGap * 0.5, 0, 0]);
          h.rotation.x = Math.PI / 2;
        }
        parent = pivot;
      }
    }
  }

  // -----------------------------------------------------------------------
  // THE ANTENNA. One paraboloid on a short mast — a small one, because on a
  // cruise stage it is a detail rather than the subject, but a real one,
  // because a dish is the single feature that names a machine as a
  // SPACECRAFT rather than as a machine.
  // -----------------------------------------------------------------------
  if (antenna) {
    const D = antenna.diameter ?? 0.30;
    const R = D * 0.5;
    const depth = antenna.depth ?? R * 0.30;
    const hub = new THREE.Group();
    hub.position.set(...(antenna.at ?? [0.16, discH * 0.75, -0.14]));
    hub.rotation.set(antenna.tilt ?? -0.5, antenna.yaw ?? 0.6, 0);
    body.add(hub);

    const mastMat = mat(0x8a9098, { roughness: 0.6 });
    add(hub, keep(new THREE.CylinderGeometry(R * 0.10, R * 0.13, R * 0.9, 10)), mastMat, [0, -R * 0.45, 0]);

    const RINGS = 16;
    const profile = [];
    for (let i = 0; i <= RINGS; i++) {
      const rr = (i / RINGS) * R;
      profile.push(new THREE.Vector2(Math.max(rr, 1e-4), -depth * (rr / R) * (rr / R)));
    }
    const dishGeo = keep(new THREE.LatheGeometry(profile, 30));
    add(hub, dishGeo, mat(antenna.color ?? 0xdfe4ea, {
      side: THREE.DoubleSide, roughness: 0.34, metalness: 0.24,
    }), [0, R * 0.25, 0]);
    add(hub, keep(new THREE.TorusGeometry(R, R * 0.055, 6, 30)), mat(0xb8bfc8, { roughness: 0.5 }),
      [0, R * 0.25 - depth, 0], [Math.PI / 2, 0, 0]);
    // The feed on a tripod — the detail that makes a dish an antenna rather
    // than a lampshade, carried over from `instrumentedProbe` because it is
    // the same read at a quarter of the size.
    const feedMat = mat(0xc8ced6, { metalness: 0.55, roughness: 0.4 });
    add(hub, keep(new THREE.CylinderGeometry(R * 0.13, R * 0.07, R * 0.20, 10)), feedMat,
      [0, R * 0.25 + depth * 0.9, 0]);
    const strutGeo = keep(new THREE.CylinderGeometry(R * 0.022, R * 0.022, R * 0.95, 5));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const s = add(hub, strutGeo, feedMat,
        [Math.cos(a) * R * 0.45, R * 0.25 + depth * 0.35, Math.sin(a) * R * 0.45]);
      s.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
    }
  }

  // -----------------------------------------------------------------------
  // THE AEROSHELL, slung under the disc.
  //
  // Two pieces, because they are two pieces on the real article and because
  // they separate at different times: a BELL-shaped backshell (a truncated
  // cone, wide at the bottom, holding the parachute) and a shallow blunt
  // HEAT SHIELD under that.
  // -----------------------------------------------------------------------
  const shellGroup = new THREE.Group();
  body.add(shellGroup);

  if (backshell) {
    const rb = (backshell.diameter ?? 0.62) * 0.5;
    const rt = (backshell.topDiameter ?? (backshell.diameter ?? 0.62) * 0.42) * 0.5;
    const h = backshell.height ?? 0.26;
    const at = backshell.at ?? -(discH * 0.5 + h * 0.5);
    const bMat = mat(backshell.color ?? 0xc9cdd3, { roughness: 0.7, metalness: 0.24 });
    add(shellGroup, keep(new THREE.CylinderGeometry(rt, rb, h, 32, 1, true)), bMat, [0, at, 0]);
    add(shellGroup, keep(new THREE.CircleGeometry(rt, 32)), bMat, [0, at + h / 2, 0], [-Math.PI / 2, 0, 0]);
    // The shoulder ring where backshell meets shield — the widest point of the
    // whole aeroshell, and the thing that gives it a waist.
    add(shellGroup, keep(new THREE.TorusGeometry(rb, h * 0.055, 8, 40)),
      mat(0x6a7078, { metalness: 0.55, roughness: 0.5 }), [0, at - h / 2, 0], [Math.PI / 2, 0, 0]);
  }

  // -----------------------------------------------------------------------
  // THE HEAT SHIELD, built once and used twice.
  //
  // A shield is an independently optional assembly here, which is what lets
  // `earth-to-mars` draw the JETTISONED one as this same archetype with the
  // other three assemblies omitted. The two therefore have to be ONE
  // construction, or the object that falls away is a different object from the
  // one that was bolted on a moment earlier.
  //
  // WHAT WAS WRONG WITH THE OLD ONE. It was a single open `LatheGeometry` with
  // the same brown `DoubleSide` material on both faces, a smooth torus
  // shoulder, and "tile joins" that were two concentric torus bands. A human
  // scrolling the journey said "heat shield away is also not great", and what
  // they were looking at was a turned wooden plate: perfectly circular, grooved,
  // and — because there was no rear shell — infinitely thin from the edge, so
  // the tumble could never reveal that it was a dish with an inside.
  //
  // Four things fix that, and none of them is a colour:
  //
  //   · a REAL 70° sphere-cone, derived from the cone angle and a rounded nose
  //     rather than from a hand-tuned depth. Shallow, blunt at the stagnation
  //     point, straight out to the shoulder.
  //   · a TILED face — curved quadrilateral patches with recessed joints and
  //     two alternating char values, which is structure at a second scale that
  //     is not concentric. Circular grooves are the one pattern that reads as
  //     turned wood.
  //   · a SECOND, INWARD-FACING SHELL a real thickness behind the first, dark
  //     inside, with backing ribs following its curve. This is what a tumble
  //     has to reveal, and without it there is nothing to reveal.
  //   · a SCALLOPED edge wall joining the two. A perfect circular silhouette is
  //     the last thing making it a plate.
  // -----------------------------------------------------------------------
  const buildHeatShield = (parent, hs) => {
    const D = hs.diameter ?? 0.62;
    const R = D * 0.5;
    const coneRad = ((hs.coneAngleDeg ?? 70) * Math.PI) / 180;
    // dy/dr along the cone flank. A 70° half-angle from the axis is a 20° rise
    // off the plane of the shoulder — shallow, which is the whole point.
    const m = 1 / Math.max(Math.tan(coneRad), 1e-3);
    const nr = Math.min((hs.noseRadius ?? 0.16) * D, R * 0.92);
    // The nose sphere tangent to the cone at r = nr. Solving dy/dr = m there
    // gives this radius; anything else leaves a visible crease at the join.
    const Rs = nr * Math.sqrt(1 + 1 / (m * m));
    const yn = -(R - nr) * m;
    const yc = yn + nr / m;
    const natural = Rs - yc;
    // `depth` stays supported as an explicit override — the ATTACHED shield on
    // this journey's cruise stage is tuned against the backshell above it and
    // the aft anchor below it, and re-deriving its depth would move a joint the
    // journey has already composed around.
    const depth = hs.depth ?? natural;
    const k = natural > 1e-6 ? depth / natural : 1;
    const prof = (r) => k * (r >= nr ? yn + (r - nr) * m : yc - Math.sqrt(Math.max(0, Rs * Rs - r * r)));
    const at = hs.at ?? -(discH * 0.5 + (backshell ? (backshell.height ?? 0.26) : 0) + depth * 0.15);

    const shield = new THREE.Group();
    shield.position.y = at;
    parent.add(shield);

    const thick = (hs.shellThickness ?? 0.035) * D;
    const rings = Math.max(1, hs.tileRings ?? 5);
    const secs = Math.max(3, hs.tileSectors ?? 16);
    const tGap = (hs.tileGap ?? 0.006) * D;
    const scallops = hs.rimScallops ?? 24;
    const scallop = hs.rimScallop ?? 0.018;

    // A curved quad patch of the shield surface, over [r0,r1] × [a0,a1].
    // Built once per radial band and instantiated once per sector: the whole
    // tiled face costs `tileRings` geometries however many tiles are drawn.
    const patch = (r0, r1, a0, a1, lift, radial, azim) => {
      const pos = [];
      const idx = [];
      for (let j = 0; j <= radial; j++) {
        const r = r0 + (r1 - r0) * (j / radial);
        const y = prof(r) + lift;
        for (let i = 0; i <= azim; i++) {
          const a = a0 + (a1 - a0) * (i / azim);
          pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
        }
      }
      for (let j = 0; j < radial; j++) {
        for (let i = 0; i < azim; i++) {
          const p = j * (azim + 1) + i;
          idx.push(p, p + azim + 1, p + 1, p + 1, p + azim + 1, p + azim + 2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return keep(g);
    };

    // The substrate under the tiles — dark, so every recessed joint is a real
    // shadow line rather than a seam of the same colour as the tile.
    {
      const RINGS = 16;
      const profile = [];
      for (let i = 0; i <= RINGS; i++) {
        const r = Math.max((i / RINGS) * R, 1e-4);
        profile.push(new THREE.Vector2(r, prof(r)));
      }
      add(shield, keep(new THREE.LatheGeometry(profile, 40)),
        mat(hs.jointColor ?? 0x241a15, { roughness: 0.95, metalness: 0.05 }));
    }

    // --- the ablative face, in tiles ---------------------------------------
    // THREE VALUES, CHOSEN BY A HASH, NOT BY PARITY. Alternating two colours on
    // (ring + sector) is a chessboard wrapped round a disc, and on a circular
    // face that reads as a DARTBOARD — a decorative pattern, which is the same
    // failure the concentric grooves were. A hash over the tile's own indices
    // scatters the char into blotches, and three closely-spaced values rather
    // than two far-apart ones keep it reading as one material that has been
    // unevenly burned rather than as two materials laid in a pattern.
    const tileMats = [
      mat(hs.tileColorA ?? hs.color ?? 0x68483a, { roughness: 0.88, metalness: 0.08 }),
      mat(hs.tileColorB ?? 0x54392e, { roughness: 0.92, metalness: 0.07 }),
      mat(hs.tileColorC ?? 0x5f4535, { roughness: 0.94, metalness: 0.06 }),
    ];
    const charAt = (s, j) => {
      const h = Math.sin(s * 12.9898 + j * 78.233) * 43758.5453;
      return tileMats[Math.floor((h - Math.floor(h)) * 3) % 3];
    };
    const aStep = (Math.PI * 2) / secs;
    const bandGeo = [];
    for (let j = 0; j < rings; j++) {
      const ra = Math.max(R * 0.02 + (R - R * 0.02) * (j / rings) + tGap * 0.5, 1e-4);
      const rb = R * 0.02 + (R - R * 0.02) * ((j + 1) / rings) - tGap * 0.5;
      const inset = (tGap * 0.5) / Math.max(rb, 1e-4);
      bandGeo.push(patch(ra, rb, inset, aStep - inset, -D * 0.004, 3, 3));
    }
    for (let s = 0; s < secs; s++) {
      for (let j = 0; j < rings; j++) {
        const mesh = new THREE.Mesh(bandGeo[j], charAt(s, j));
        mesh.rotation.y = s * aStep;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        shield.add(mesh);
      }
    }

    // --- the rear shell, and what the tumble is for ------------------------
    // Offset INWARD by a real thickness and drawn DoubleSide in a near-black
    // interior value, so an edge-on or three-quarter-rear attitude shows a dish
    // with a cavity in it. The old single skin had the same brown on both
    // faces, so there was nothing to see from behind and the tumble bought
    // nothing.
    {
      const RINGS = 14;
      const profile = [];
      for (let i = 0; i <= RINGS; i++) {
        const r = Math.max((i / RINGS) * R, 1e-4);
        profile.push(new THREE.Vector2(r, prof(r) + thick));
      }
      add(shield, keep(new THREE.LatheGeometry(profile, 36)),
        mat(hs.interiorColor ?? 0x15181b, {
          side: THREE.DoubleSide, roughness: 0.92, metalness: 0.1,
        }));
      // Backing ribs, following the curve rather than cutting through it.
      const nribs = hs.interiorRibs ?? 8;
      if (nribs > 0) {
        const ribMat = mat(hs.ribColor ?? 0x2b3037, { side: THREE.DoubleSide, roughness: 0.7, metalness: 0.34 });
        const ribGeo = patch(R * 0.14, R * 0.9, -0.05, 0.05, thick * 1.5, 5, 1);
        for (let i = 0; i < nribs; i++) {
          const mesh = new THREE.Mesh(ribGeo, ribMat);
          mesh.rotation.y = (i / nribs) * Math.PI * 2;
          shield.add(mesh);
        }
      }
    }

    // --- the scalloped edge wall -------------------------------------------
    // The annular face between the ablator and the rear shell. It is the
    // silhouette at every attitude near edge-on, and it is modulated so the
    // outline is not a perfect circle — the last thing that made this a plate.
    {
      const SEG = scallops * 3;
      const pos = [];
      const idx = [];
      for (let i = 0; i <= SEG; i++) {
        const a = (i / SEG) * Math.PI * 2;
        const r = R * (1.004 + scallop * Math.cos(a * scallops));
        pos.push(Math.cos(a) * r, prof(R), Math.sin(a) * r);
        pos.push(Math.cos(a) * r, prof(R) + thick, Math.sin(a) * r);
      }
      for (let i = 0; i < SEG; i++) {
        const p = i * 2;
        idx.push(p, p + 1, p + 2, p + 2, p + 1, p + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      add(shield, keep(g), mat(hs.rimColor ?? 0x9c6a44, {
        side: THREE.DoubleSide, roughness: 0.6, metalness: 0.34,
      }));
    }

    return depth;
  };

  let shieldDepth = 0;
  if (heatShield) shieldDepth = buildHeatShield(shellGroup, heatShield);

  // --- the anchor ---------------------------------------------------------
  // The lowest point of the assembly, in the unit envelope. Derived from the
  // pieces that were actually built, so omitting the aeroshell moves it up
  // rather than leaving a phantom gap under a bare disc.
  let aftY = -discH / 2;
  if (backshell) {
    const h = backshell.height ?? 0.26;
    aftY = Math.min(aftY, (backshell.at ?? -(discH * 0.5 + h * 0.5)) - h / 2);
  }
  if (heatShield) {
    const R = (heatShield.diameter ?? 0.62) * 0.5;
    const at = heatShield.at ?? -(discH * 0.5 + (backshell ? (backshell.height ?? 0.26) : 0) + shieldDepth * 0.15);
    aftY = Math.min(aftY, at - shieldDepth - R * 0.045);
  }
  // 'aftMount' | 'centre' | a number | a function of the frame returning 0..1.
  // The NUMBER form is the load-bearing one: a payload that is bolted down for
  // the launch and free-flying afterwards has to slide from one origin to the
  // other continuously, and it cannot do that if the anchor is fixed at build
  // time. 0 is the disc centre, 1 is the aft hardpoint.
  const anchorK = ({ u, local, t }) => {
    if (anchor === 'aftMount') return 1;
    if (anchor === 'centre' || anchor == null) return 0;
    const v = typeof anchor === 'function' ? anchor({ u, local, t }) : anchor;
    return Math.max(0, Math.min(1, v ?? 0));
  };

  const shedVec = new THREE.Vector3();

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

      body.position.y = -aftY * anchorK({ u, local, t });

      if (separate) {
        // ONE EVENT, ONE DERIVATION. The gap starts at zero — coincident at the
        // start is what "still attached" means — and the shell both drops and
        // turns, because discarded hardware tumbles.
        const s = Math.max(0, Math.min(1, separate({ u, local, t })));
        shedVec.set(0, -s * 1.5, 0);
        shellGroup.position.copy(shedVec);
        shellGroup.rotation.set(s * 1.1, 0, s * 0.7);
      }

      if (arrays && arrays.deploy) {
        // A REAL UNFOLDING. The root pivot swings the wing off the disc face,
        // and every inter-panel pivot alternates through ±157° so a stowed
        // array is a Z-FOLDED STACK against the hull and a deployed one is
        // three coplanar panels. The previous version scaled the wing group
        // along x, which compresses the panel and its spar into a shorter
        // panel — a thing that does not fold, telescopes, and looks like
        // neither. An articulation is what the beat whose entire subject is the
        // panels going out is worth.
        const d = Math.max(0, Math.min(1, arrays.deploy({ u, local, t }) ?? 1));
        for (const g of wingGroups) g.rotation.z = (1 - d) * 1.18;
        for (const f of foldGroups) f.g.rotation.z = f.sign * (1 - d) * 2.75;
      }

      const w = respectBand ? rebase.weight(meters) : 1;
      const o = opacity({ u, local, rebase }) * w;
      for (const m of materials) m.opacity = o;
      group.visible = o > 0.004;
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
