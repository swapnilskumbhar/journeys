import * as THREE from 'three';

// TOWER — a braced open framework: legs, bay ties, cross-bracing, a deck, and
// swing arms.
//
// This exists because a launch complex was being built out of `blocks`, which
// draws a field of solid boxes. Boxes make a town. They cannot make a STRUCTURE,
// and the difference is that a structure is mostly holes: what says "launch
// tower" is the lattice, the fact that you can see sky through it, and the arms
// reaching out to the vehicle. Drawn with blocks it came out as one tall brown
// slab beside the rocket — the name-the-object test failed at a glance, and no
// amount of lighting or scale was going to fix a slab.
//
// General on purpose (rule 2): the same parameters make a service tower, a
// derrick, a transmission mast, a crane, a pit-head winding frame or building
// scaffolding. Nothing here knows about rockets.
//
//   tower({
//     heightMeters, widthMeters,     // overall envelope
//     bays,                          // horizontal tie levels — the rung count
//     legR,                          // leg radius as a fraction of width
//     braces: 'x' | 'z' | 'none',    // diagonal style per bay face
//     deck: { sizeMeters, thickness, color },
//     arms: [{ at, lengthMeters, thickness, side }],   // at = 0..1 up the tower
//     cap: { heightMeters, overhang },                 // hammerhead / crane head
//     color, metalness, roughness,
//     offsetMeters, opacity, respectBand,
//   })
//
// Everything is authored in METRES and converted through rebase every frame
// (rule 1). Geometry is built once in a unit-height space and scaled, so
// `heightMeters` may be a per-frame function without rebuilding buffers — same
// contract as `vehicle`.
export function tower({
  heightMeters,
  widthMeters,
  bays = 9,
  legR = 0.035,
  braces = 'x',
  deck = null,
  arms = [],
  cap = null,
  color = 0x9aa1a8,
  metalness = 0.55,
  roughness = 0.62,
  offsetMeters = null,
  opacity = () => 1,
  respectBand = true,
} = {}) {
  const group = new THREE.Group();
  const geometries = [];
  const materials = [];
  const keep = (g) => { geometries.push(g); return g; };

  // One material for the frame, one for the deck. Sharing is what keeps a
  // lattice of ~200 members affordable.
  const frameMat = new THREE.MeshStandardMaterial({ color, metalness, roughness, transparent: true });
  materials.push(frameMat);

  // The whole tower is built in a unit box: x,z in [-0.5, 0.5], y in [0, 1].
  // `widthMeters / heightMeters` is applied as a non-uniform scale at the end,
  // so proportions stay correct while one number drives overall size.
  const aspect = widthMeters / heightMeters;
  const frame = new THREE.Group();
  group.add(frame);
  frame.scale.set(aspect, 1, aspect);

  const beam = (len, r) => keep(new THREE.BoxGeometry(r, len, r));
  const member = (geo, pos, rot) => {
    const m = new THREE.Mesh(geo, frameMat);
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    m.castShadow = true;
    m.receiveShadow = true;
    frame.add(m);
    return m;
  };

  // --- four legs, running the full height ---------------------------------
  const legGeo = beam(1, legR);
  const half = 0.5 - legR;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    member(legGeo, [sx * half, 0.5, sz * half]);
  }

  // --- bay ties and diagonals ---------------------------------------------
  // The ties are what give the tower its rung rhythm; the diagonals are what
  // make it read as ENGINEERED rather than as a cage. Alternating the diagonal
  // direction bay by bay is the detail that sells it — a lattice with every
  // brace leaning the same way looks like a texture, not like bracing.
  const span = 1 - 2 * legR;
  const tieGeo = beam(span, legR * 0.72);
  const bayH = 1 / bays;
  const diagLen = Math.hypot(span, bayH);
  const diagGeo = beam(diagLen, legR * 0.58);
  const tilt = Math.atan2(span, bayH);

  for (let i = 0; i <= bays; i++) {
    const y = i * bayH;
    // Horizontal ties on all four faces.
    member(tieGeo, [0, y, -half], [0, 0, Math.PI / 2]);
    member(tieGeo, [0, y, half], [0, 0, Math.PI / 2]);
    member(tieGeo, [-half, y, 0], [Math.PI / 2, 0, 0]);
    member(tieGeo, [half, y, 0], [Math.PI / 2, 0, 0]);

    if (i === bays || braces === 'none') continue;
    const yc = y + bayH / 2;
    const lean = i % 2 === 0 ? 1 : -1;
    // Front and back faces get a diagonal; the side faces get the opposite
    // lean, so the tower is braced in both planes without doubling the count.
    member(diagGeo, [0, yc, -half], [0, 0, lean * tilt]);
    member(diagGeo, [0, yc, half], [0, 0, -lean * tilt]);
    if (braces === 'x') {
      member(diagGeo, [-half, yc, 0], [-lean * tilt, 0, 0]);
      member(diagGeo, [half, yc, 0], [lean * tilt, 0, 0]);
    }
  }

  // --- the hammerhead ------------------------------------------------------
  // A crane head or capping truss. Without something on top, a lattice reads as
  // an unfinished stub — towers in the world nearly always carry a machine.
  if (cap) {
    const ch = (cap.heightMeters ?? heightMeters * 0.06) / heightMeters;
    const over = cap.overhang ?? 0.9;
    const capGeo = keep(new THREE.BoxGeometry(1 + over, ch, 0.8));
    const m = new THREE.Mesh(capGeo, frameMat);
    m.position.set(over * 0.35, 1 + ch / 2, 0);
    m.castShadow = true;
    frame.add(m);
  }

  // --- swing arms ----------------------------------------------------------
  // The arms are the single most legible thing about a service tower: they are
  // what connects it to whatever it is servicing, and they break the vertical
  // silhouette. Authored at a fraction of the height so they stay put when the
  // tower is resized.
  for (const a of arms) {
    const len = (a.lengthMeters ?? widthMeters * 1.4) / widthMeters;
    const th = (a.thickness ?? widthMeters * 0.09) / heightMeters;
    const g = keep(new THREE.BoxGeometry(len, th, th * 1.6 * (heightMeters / widthMeters)));
    const m = new THREE.Mesh(g, frameMat);
    const dir = a.side ?? 1;
    m.position.set(dir * (0.5 + len / 2), a.at, 0);
    m.castShadow = true;
    frame.add(m);
    // A short strut back to the tower, so the arm is supported rather than
    // cantilevered out of nothing.
    const sg = keep(new THREE.BoxGeometry(len * 0.9, th * 0.6, th * 0.6 * (heightMeters / widthMeters)));
    const s = new THREE.Mesh(sg, frameMat);
    s.position.set(dir * (0.5 + len * 0.45), a.at - th * 3.2, 0);
    // THE FRAME IS SCALED NON-UNIFORMLY (aspect, 1, aspect), so a rotation
    // authored in local space is SHEARED on the way out: a 0.22 rad lean on a
    // tower seven times taller than it is wide came out at 59°, and the support
    // struts rendered as long spindly diagonals shooting past the tower top.
    // Pre-distort the angle so the lean means 0.22 rad in the WORLD.
    s.rotation.z = dir * Math.atan(aspect * Math.tan(0.22));
    s.castShadow = true;
    frame.add(s);
  }

  // --- the deck ------------------------------------------------------------
  // Sits at y = 0 in the tower's own space and is sized in METRES independently
  // of the tower's width, because a launch deck, a rig floor and a scaffold base
  // are all much wider than the frame standing on them.
  let deckMat = null;
  if (deck) {
    deckMat = new THREE.MeshStandardMaterial({
      color: deck.color ?? 0x6d6a63,
      metalness: 0.1,
      roughness: 0.92,
      transparent: true,
    });
    materials.push(deckMat);
    const t = (deck.thickness ?? deck.sizeMeters * 0.05) / heightMeters;
    const s = deck.sizeMeters / heightMeters;
    const d = new THREE.Mesh(keep(new THREE.BoxGeometry(s, t, s)), deckMat);
    d.position.y = -t / 2;
    d.receiveShadow = true;
    d.castShadow = true;
    group.add(d);
  }

  return {
    group,
    materials,
    update({ u, local, rebase, t }) {
      const h = typeof heightMeters === 'function' ? heightMeters({ u, local, rebase, t }) : heightMeters;
      group.scale.setScalar(rebase.toWorld(h));

      if (offsetMeters !== null) {
        const raw = typeof offsetMeters === 'function' ? offsetMeters({ u, local, rebase, t }) : offsetMeters;
        const [ox, oy, oz] = Array.isArray(raw) ? raw : [raw, 0, 0];
        group.position.set(rebase.toWorld(ox), rebase.toWorld(oy), rebase.toWorld(oz));
      }

      const w = respectBand ? rebase.weight(h) : 1;
      const o = opacity({ u, local, rebase }) * w;
      frameMat.opacity = o;
      if (deckMat) deckMat.opacity = o;
      group.visible = o > 0.004;
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
