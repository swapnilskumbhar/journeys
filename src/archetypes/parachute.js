import * as THREE from 'three';

// PARACHUTE — an inflated fabric canopy on taut shroud lines above a payload.
//
// WHY THIS IS AN ARCHETYPE AND NOT A `blob`.
//
// `earth-to-mars` drew its supersonic disc-gap-band chute as
// `blob({ fill: 0x8f8878, wobble: 0.03 })`, under a comment in its own source
// that already said what was wrong: "ARCHETYPE GAP, WORKED AROUND. There is no
// parachute archetype, and a canopy is not a blob." A human scrolling the live
// journey put it more briefly — "the parachute is also not great" — and what
// they were looking at was a smooth pale sphere floating above a lander with
// nothing joining the two.
//
// No parameter of `blob` fixes that, because a blob is a CLOSED VOLUME and a
// parachute is an OPEN SHELL. The features that name one are all topological:
//
//   · it is a shallow dome, not a ball — wider than it is deep, and you can see
//     the inside of the far half through the mouth.
//   · it is built from GORES, radial fabric panels with seams between them, and
//     the seams are what make a curved surface read as sewn rather than moulded.
//   · it has a CROWN VENT — a real hole at the apex, which every large canopy
//     has because the air has to go somewhere, and which is the single clearest
//     "this is fabric, not a solid" signal in the silhouette.
//   · the SKIRT is scalloped, because the hem is pulled in at every gore
//     boundary by the line hanging off it.
//   · and the SHROUD LINES converge on the payload. A canopy with nothing under
//     it is a jellyfish; the taut cone of lines is what says it is carrying
//     something.
//
// GENERAL ON PURPOSE (rule 2). Nothing here knows about Mars. The same
// parameters make an Apollo main, a Soyuz landing chute, a booster recovery
// chute, a cargo drop, a drogue (few gores, deep, small), or a ram-air canopy
// seen from below.
//
//   parachute({
//     spanMeters,                     // canopy DIAMETER; everything scales from it
//     gores, ventRadius, crownHeight, // the shell
//     skirtDepth, scallops, scallop,  // the hem
//     lineLength, lines, risers, riserRadius, lineRadius,
//     fabricA, fabricB, seamColor, lineColor,
//     inflate,                        // 0..1, A PURE FUNCTION OF u
//     attitude, offsetMeters, opacity, respectBand,
//   })
//
// THE ROOT IS THE PAYLOAD, NOT THE CANOPY. `offsetMeters: [0,0,0]` therefore
// puts the lines' convergence point exactly on whatever the journey has already
// placed at the origin, and the canopy rides above it — one derivation, so the
// chute and the thing it is carrying cannot end up as two stickers.
//
// INFLATION IS A FUNCTION OF u AND NEVER OF t (rule 8). Nothing here reads the
// clock: a reader arriving at any scroll position gets the canopy at the state
// that scroll position means. Everything the inflation moves is a group
// transform, so no buffer is ever rebuilt.
//
// PBR NEEDS A SUN. Fabric here is MeshStandardMaterial, so a journey using this
// must declare `stageOptions.sun` or the canopy renders black.

const UP = new THREE.Vector3(0, 1, 0);

export function parachute({
  spanMeters = 1,
  // The shell. `crownHeight` and `ventRadius` are fractions of the canopy
  // RADIUS, so the profile keeps its proportions at any span.
  gores = 20,
  ventRadius = 0.055,
  crownHeight = 0.62,
  // The profile exponent. Below 1 the dome is full and shouldered — an inflated
  // canopy with the air trapped in it — rather than the cone a linear falloff
  // draws.
  crownPower = 0.55,
  seamWidth = 0.16,        // fraction of a gore's angular width
  // The hem, in fractions of the canopy radius.
  skirtDepth = 0.14,
  scallop = 0.045,
  // The suspension. `lineLength` is in canopy DIAMETERS, because that is how a
  // real chute is specified — a main is typically 1.0–1.7 diameters of line.
  lineLength = 0.9,
  lines = null,            // defaults to one per gore boundary
  risers = 4,
  riserRadius = 0.035,
  riserAt = 0.14,          // fraction of lineLength — where the risers gather
  lineRadius = 0.0055,     // fraction of the canopy RADIUS
  fabricA = 0xb8ae99,
  fabricB = 0x8e8574,
  seamColor = 0x6e6659,
  ventColor = 0x7c7466,
  lineColor = 0x514b42,
  // Accepted for API symmetry with the other hard-surface archetypes; the real
  // lighting is the stage's sun.
  lightDir = [1, 0.15, 0.35],
  ambient = 0.20,
  inflate = () => 1,
  attitude = () => [0, 0, 0],
  offsetMeters = null,
  opacity = () => 1,
  respectBand = false,
} = {}) {
  void lightDir;

  const group = new THREE.Group();
  const geometries = [];
  const materials = [];
  const keep = (g) => { geometries.push(g); return g; };

  const mat = (color, opts = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      metalness: opts.metalness ?? 0.04,
      roughness: opts.roughness ?? 0.86,
      emissive: new THREE.Color(color).multiplyScalar(ambient * 0.5),
      transparent: true,
      opacity: 1,
      side: opts.side ?? THREE.DoubleSide,
    });
    materials.push(m);
    return m;
  };

  // Unit envelope: the canopy spans ±0.5, so its radius is 0.5 and the root
  // scale is `rebase.toWorld(spanMeters)` — the same contract as `vehicle`,
  // `cruiseStage` and `instrumentedProbe`.
  const R = 0.5;
  const LINE = lineLength;            // already in diameters == unit envelope
  const vent = ventRadius * R;
  const crown = crownHeight * R;
  const hem = skirtDepth * R;
  const nLines = lines ?? gores;

  // The canopy's own group. The inflation scales and lifts THIS, which is why
  // nothing needs rebuilding per frame: radius is x/z scale, depth is y scale,
  // and how high it rides is position.y.
  const canopy = new THREE.Group();
  group.add(canopy);

  // The profile, in the canopy's own frame: skirt at y = 0, crown above it.
  const RINGS = 12;
  const profileY = (r) => crown * Math.pow(Math.max(0, 1 - (r / R) * (r / R)), crownPower);

  // A patch of the canopy surface spanning [a0, a1] in azimuth — one gore, or
  // one seam strip, depending on how wide you ask for it. Built as an indexed
  // grid over (ring, azimuth), normals computed, so a gore is genuinely a
  // curved sewn panel rather than a flat card.
  const surfacePatch = (a0, a1, cols, lift) => {
    const pos = [];
    const idx = [];
    for (let j = 0; j <= RINGS; j++) {
      const r = vent + (R - vent) * (j / RINGS);
      const y = profileY(r) + lift;
      for (let i = 0; i <= cols; i++) {
        const a = a0 + (a1 - a0) * (i / cols);
        pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      }
    }
    for (let j = 0; j < RINGS; j++) {
      for (let i = 0; i < cols; i++) {
        const p = j * (cols + 1) + i;
        idx.push(p, p + cols + 1, p + 1, p + 1, p + cols + 1, p + cols + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return keep(g);
  };

  // --- the gores -----------------------------------------------------------
  // TWENTY SEPARATE MESHES, IN TWO ALTERNATING VALUES. One lathe in one colour
  // is a moulded shell; alternating panels with dark seams between them is
  // sewn fabric, and at small apparent size the alternation is the only thing
  // that survives.
  const step = (Math.PI * 2) / gores;
  const inset = step * seamWidth * 0.5;
  const matA = mat(fabricA, { roughness: 0.9 });
  const matB = mat(fabricB, { roughness: 0.9 });
  const matSeam = mat(seamColor, { roughness: 0.8, metalness: 0.06 });
  for (let i = 0; i < gores; i++) {
    const a0 = i * step + inset;
    const a1 = (i + 1) * step - inset;
    canopy.add(new THREE.Mesh(surfacePatch(a0, a1, 4, 0), i % 2 ? matB : matA));
    // The seam, standing very slightly proud so it is never z-fought away.
    canopy.add(new THREE.Mesh(
      surfacePatch((i + 1) * step - inset, (i + 1) * step + inset, 1, R * 0.004), matSeam));
  }

  // --- the crown vent ------------------------------------------------------
  // A REAL HOLE, with a reinforced ring around it. The gores start at `vent`
  // rather than at the axis, so the reader can see sky — or the far inside of
  // the canopy — straight through the apex. That is the single feature a closed
  // volume can never have, and it is why this is an archetype and not a blob.
  canopy.add(new THREE.Mesh(
    keep(new THREE.TorusGeometry(vent, R * 0.014, 6, 26)),
    mat(ventColor, { roughness: 0.72, metalness: 0.1 }),
  ).translateY(profileY(vent)));

  // --- the skirt -----------------------------------------------------------
  // A scalloped hem. The radius and the height both dip between gores, because
  // the hem is being pulled down at every point a line is attached to it and
  // billows out between them. A perfect circular rim is the tell of a solid.
  {
    const SEG = gores * 4;
    const pos = [];
    const idx = [];
    const rimAt = (a) => {
      const s = Math.cos(a * nLines);
      return { r: R * (1 + scallop * 0.55 * (1 + s) - scallop * 0.2), d: hem * (0.45 + 0.55 * (0.5 + 0.5 * s)) };
    };
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const { r, d } = rimAt(a);
      pos.push(Math.cos(a) * R, 0, Math.sin(a) * R);
      pos.push(Math.cos(a) * r, -d, Math.sin(a) * r);
    }
    for (let i = 0; i < SEG; i++) {
      const p = i * 2;
      idx.push(p, p + 1, p + 2, p + 2, p + 1, p + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    canopy.add(new THREE.Mesh(keep(g), matSeam));
  }

  // --- the suspension ------------------------------------------------------
  // Real cylinders, not `THREE.Line`. A line is one device pixel wide whatever
  // the object's apparent size, so a chute drawn a third of the frame across
  // would have hairline suspension that vanishes under bloom; a thin cylinder
  // scales with the object and catches the same sun as everything else.
  const lineMat = mat(lineColor, { roughness: 0.78, metalness: 0.08, side: THREE.FrontSide });
  const lineGeo = keep(new THREE.CylinderGeometry(lineRadius * R, lineRadius * R, 1, 5, 1, true));
  lineGeo.translate(0, 0.5, 0);   // base at the origin, so scale.y is the length

  const shrouds = [];
  for (let i = 0; i < nLines; i++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(lineGeo, lineMat));
    group.add(g);
    shrouds.push({ g, a: (i / nLines) * Math.PI * 2, riser: i % risers });
  }
  const bridles = [];
  for (let i = 0; i < risers; i++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(lineGeo, lineMat));
    group.add(g);
    bridles.push({ g, a: (i / risers) * Math.PI * 2 + Math.PI / risers });
  }

  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const stretch = (g, sx, sy, sz, ex, ey, ez) => {
    from.set(sx, sy, sz);
    to.set(ex, ey, ez);
    dir.copy(to).sub(from);
    const len = dir.length();
    g.position.copy(from);
    if (len > 1e-6) {
      dir.divideScalar(len);
      g.quaternion.setFromUnitVectors(UP, dir);
    }
    g.scale.set(1, Math.max(len, 1e-6), 1);
  };

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

      // INFLATION. Three things change together, because on a real canopy they
      // do: it grows, it deepens, and it rises away from the payload as the
      // lines come taut. A squeezed, shallow canopy close over the vehicle is
      // what a chute looks like in the first tenth of a second of the opening.
      const raw = inflate({ u, local, rebase, t });
      const d = Math.max(0, Math.min(1, typeof raw === 'number' ? raw : 1));
      const ease = d * d * (3 - 2 * d);
      const rad = 0.08 + 0.92 * ease;
      canopy.scale.set(rad, 0.12 + 0.88 * ease, rad);
      const ride = LINE * (0.25 + 0.75 * ease);
      canopy.position.y = ride;

      const riserY = ride * riserAt;
      const riserR = riserRadius * R;
      for (const s of shrouds) {
        // The skirt point, moved by the canopy's own transform — so the lines
        // ALWAYS end on the hem, at every stage of the opening, rather than at a
        // remembered position the canopy has since grown away from.
        const rr = R * (1 + scallop * 0.55 * (1 + Math.cos(s.a * nLines)) - scallop * 0.2) * rad;
        const hy = ride - hem * (0.45 + 0.55 * (0.5 + 0.5 * Math.cos(s.a * nLines)))
          * (0.12 + 0.88 * ease);
        const ra = (s.riser / risers) * Math.PI * 2 + Math.PI / risers;
        stretch(s.g,
          Math.cos(ra) * riserR, riserY, Math.sin(ra) * riserR,
          Math.cos(s.a) * rr, hy, Math.sin(s.a) * rr);
      }
      for (const b of bridles) {
        stretch(b.g, 0, 0, 0,
          Math.cos(b.a) * riserR, riserY, Math.sin(b.a) * riserR);
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
