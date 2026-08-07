import * as THREE from 'three';
import { rng } from './points-material.js';

// A flat surface carrying procedural MARKS — a clay tablet of cuneiform, a
// tally bone, a printed page, a painted wall. The sibling of silhouette.js:
// that one draws forms read from their outline against a bright sky, this one
// draws surfaces read from what is written on them.
//
// Why it has to exist. Some subjects are not shapes at all. "Writing" cannot
// be told with a skyline, a crowd or a field, because the whole content of the
// beat is at the scale of a fingernail — so the journey does what it already
// does for a living cell, and dives. At a 1.5 m frame a 35 cm tablet is a
// third of the screen and the wedges are legible, which is the only framing in
// which this beat means anything.
//
// Marks are baked into a canvas atlas once (several randomised variants) and
// instanced onto quads that yaw toward the camera and lean back by a fixed
// pitch, so the writing faces the reader from every angle the slow orbit
// reaches. Lighting is a lamp term, not a normal — these are lit by one warm
// source close by, and a real BRDF would buy nothing at this size.

const S = 512; // marks are fine; the atlas needs the resolution silhouette does not

// --- drawing ---------------------------------------------------------------
// Origin at the bottom-centre of the cell, y already flipped so +y is up.

function slab(ctx, w, h, rand, fill) {
  // A pillow-shaped tablet: straight-ish sides, bulging faces, corners knocked
  // off. Drawn as one path so the alpha edge is the slab's real outline —
  // a rectangle would read as a screenshot of a texture.
  const r = w * 0.09;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-w * 0.5 + r, 0);
  ctx.lineTo(w * 0.5 - r, 0);
  ctx.quadraticCurveTo(w * 0.52, 0, w * 0.5, r);
  ctx.quadraticCurveTo(w * 0.53 + rand() * w * 0.02, h * 0.5, w * 0.5, h - r);
  ctx.quadraticCurveTo(w * 0.52, h, w * 0.5 - r, h);
  ctx.lineTo(-w * 0.5 + r, h);
  ctx.quadraticCurveTo(-w * 0.52, h, -w * 0.5, h - r);
  ctx.quadraticCurveTo(-w * 0.53 - rand() * w * 0.02, h * 0.5, -w * 0.5, r);
  ctx.quadraticCurveTo(-w * 0.52, 0, -w * 0.5 + r, 0);
  ctx.closePath();
  ctx.fill();
}

function wedge(ctx, x, y, len, ang, dark, light) {
  // One impression: a triangular head with a tail, plus a bright lower lip.
  // The lip is what makes it read as PRESSED INTO clay rather than drawn on
  // it — the whole visual signature of cuneiform is a raised edge catching
  // the light below a dark cavity.
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const hw = len * 0.42;
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(x - s * hw, y + c * hw);
  ctx.lineTo(x + s * hw, y - c * hw);
  ctx.lineTo(x + c * len, y + s * len);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = light;
  ctx.lineWidth = Math.max(1, len * 0.12);
  ctx.beginPath();
  ctx.moveTo(x + s * hw * 0.9, y - c * hw * 0.9);
  ctx.lineTo(x + c * len * 0.92, y + s * len * 0.92);
  ctx.stroke();
}

function cuneiform(ctx, rand, { dark = '#5c3a1e', light = '#e6c99a', rule = '#a5814f' } = {}) {
  // An Uruk account tablet: RULED into rows and columns, with sign groups in
  // the boxes. The ruling matters more than the signs do. Marks alone read as
  // decoration; marks inside ruled boxes read as a LEDGER, which is what these
  // actually were and what the copy is about — grain and livestock, counted.
  const w = S * (0.74 + rand() * 0.1);
  const h = w * (0.82 + rand() * 0.22);
  const y0 = S * 0.03;

  const rows = 4 + Math.floor(rand() * 3);
  const cols = 1 + Math.floor(rand() * 2);
  const padX = w * 0.09;
  const padY = h * 0.09;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  ctx.lineCap = 'round';
  ctx.strokeStyle = rule;
  ctx.lineWidth = Math.max(1, S * 0.006);
  for (let r = 1; r < rows; r++) {
    const y = y0 + padY + (innerH * r) / rows;
    ctx.beginPath();
    ctx.moveTo(-innerW * 0.5, y);
    ctx.lineTo(innerW * 0.5, y);
    ctx.stroke();
  }
  for (let c = 1; c < cols; c++) {
    const x = -innerW * 0.5 + (innerW * c) / cols;
    ctx.beginPath();
    ctx.moveTo(x, y0 + padY);
    ctx.lineTo(x, y0 + padY + innerH);
    ctx.stroke();
  }

  const cellW = innerW / cols;
  const cellH = innerH / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bx = -innerW * 0.5 + cellW * c;
      const by = y0 + padY + cellH * r;
      // a handful of sign groups per box, left-aligned like real tablets
      const signs = 2 + Math.floor(rand() * 3);
      let cursor = bx + cellW * 0.06;
      for (let g = 0; g < signs && cursor < bx + cellW * 0.88; g++) {
        const gw = cellW * (0.13 + rand() * 0.1);
        const strokes = 2 + Math.floor(rand() * 4);
        for (let k = 0; k < strokes; k++) {
          const len = cellH * (0.2 + rand() * 0.22);
          // wedges cluster horizontal, vertical and oblique — three of the
          // four orientations a stylus can be pressed at
          const ang = [0, Math.PI * 0.5, Math.PI * 0.25][Math.floor(rand() * 3)]
            + (rand() - 0.5) * 0.18;
          wedge(
            ctx,
            cursor + rand() * gw * 0.7,
            by + cellH * (0.22 + rand() * 0.45),
            len, ang, dark, light,
          );
        }
        cursor += gw + cellW * 0.05;
      }
    }
  }
}

function bootprint(ctx, rand, { dark = '#232322', light = '#f0eee6', dust = '#9c988c' } = {}) {
  // A pressed print in loose powder. Read from the RIDGES, not the outline:
  // what makes a bootprint legible is the row of transverse bars with bright
  // upstanding edges and dark troughs between them, and that pattern survives
  // being small in a way an outline never does.
  //
  // Not Moon-specific — the same routine is a print in mud, sand or snow; only
  // the palette changes. (`panel` lays flat rather than upright when the caller
  // passes tiltRad ≈ PI/2, which is what a print on the ground needs.)
  const w = S * (0.30 + rand() * 0.05);
  const h = S * (0.78 + rand() * 0.08);
  const y0 = S * 0.08;
  const cx = (rand() - 0.5) * S * 0.05;

  // the depression: a soft dark sole shape, slightly waisted at the arch
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.5, y0 + h * 0.12);
  ctx.quadraticCurveTo(cx - w * 0.56, y0 + h * 0.72, cx - w * 0.34, y0 + h * 0.97);
  ctx.quadraticCurveTo(cx, y0 + h * 1.06, cx + w * 0.34, y0 + h * 0.97);
  ctx.quadraticCurveTo(cx + w * 0.56, y0 + h * 0.72, cx + w * 0.5, y0 + h * 0.12);
  ctx.quadraticCurveTo(cx + w * 0.42, y0 - h * 0.02, cx, y0);
  ctx.quadraticCurveTo(cx - w * 0.42, y0 - h * 0.02, cx - w * 0.5, y0 + h * 0.12);
  ctx.closePath();
  ctx.fill();

  // ridges: dark bar, bright lip on the sun side. Nine of them, which is what
  // the Apollo overshoe actually carried and also about the most that stays
  // separable at a hundred pixels.
  const bars = 9;
  for (let i = 0; i < bars; i++) {
    const t = (i + 0.5) / bars;
    const yy = y0 + h * (0.06 + t * 0.88);
    const bw = w * (0.86 - Math.abs(t - 0.55) * 0.28);
    const bh = (h * 0.88) / bars;
    ctx.fillStyle = light;
    ctx.fillRect(cx - bw * 0.5, yy - bh * 0.16, bw, bh * 0.34);
    ctx.fillStyle = dark;
    ctx.fillRect(cx - bw * 0.5, yy + bh * 0.2, bw, bh * 0.3);
  }

  // thrown powder around the rim — a print has a raised collar, and without it
  // the shape reads as a decal lying on top of the ground
  ctx.fillStyle = dust;
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.5 + rand() * 0.22;
    ctx.fillRect(cx + Math.cos(a) * w * r, y0 + h * 0.5 + Math.sin(a) * h * r * 0.62, S * 0.008, S * 0.008);
  }
}

function record(ctx, rand, { disc = '#c9a24a', groove = '#8a6a26', dark = '#40300e', light = '#f4e1a4' } = {}) {
  // An engraved disc: a metal plate carrying instructions for whoever finds it.
  // Voyager's Golden Record cover is the case this was written for, but the
  // shape is general — the Pioneer plaque, a foundation-stone plate, a
  // commemorative medal are the same object, and every one of them is read
  // from its MARKS rather than from its outline, which is what puts it here
  // rather than in silhouette.js.
  //
  // Everything is drawn as concentric structure plus a small number of
  // diagrams, because that is what makes an engraved disc legible at a couple
  // of hundred pixels: the grooves say "record", the diagrams say "this is
  // meant to be understood", and neither survives being drawn as one flat
  // texture.
  const R = S * 0.46;
  const cx = 0;
  const cy = S * 0.5;

  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  // A rim, and the spindle hole — the two features that stop a gold circle
  // reading as a coin.
  ctx.strokeStyle = light;
  ctx.lineWidth = S * 0.012;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.965, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = groove;
  ctx.lineWidth = Math.max(1, S * 0.0045);
  for (let i = 0; i < 46; i++) {
    const rr = R * (0.30 + 0.63 * (i / 46)) * (1 + (rand() - 0.5) * 0.006);
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.055, 0, Math.PI * 2);
  ctx.fill();

  // The pulsar map: a burst of rays of different lengths from one point, each
  // ticked with binary. It is the most recognisable thing on the real cover
  // and it reads at almost any size because it is pure radial geometry.
  const px0 = cx - R * 0.42;
  const py0 = cy - R * 0.40;
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1, S * 0.006);
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2 + rand() * 0.12;
    const len = R * (0.16 + rand() * 0.20);
    ctx.beginPath();
    ctx.moveTo(px0, py0);
    ctx.lineTo(px0 + Math.cos(a) * len, py0 + Math.sin(a) * len);
    ctx.stroke();
  }

  // The hydrogen hyperfine transition — two circles with a linking bar, the
  // unit of time and length the rest of the diagram is quoted in.
  const hx = cx + R * 0.44;
  const hy = cy - R * 0.44;
  ctx.lineWidth = Math.max(1, S * 0.007);
  for (const dx of [-R * 0.07, R * 0.07]) {
    ctx.beginPath();
    ctx.arc(hx + dx, hy, R * 0.055, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx + dx, hy, R * 0.015, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(hx - R * 0.02, hy);
  ctx.lineTo(hx + R * 0.02, hy);
  ctx.stroke();

  // The playback diagram: the disc seen edge on with a stylus on it, plus a
  // row of binary ticks giving the rotation period.
  const sx = cx - R * 0.40;
  const sy = cy + R * 0.46;
  ctx.beginPath();
  ctx.moveTo(sx - R * 0.20, sy);
  ctx.lineTo(sx + R * 0.20, sy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx + R * 0.14, sy);
  ctx.lineTo(sx + R * 0.06, sy + R * 0.13);
  ctx.stroke();

  ctx.fillStyle = dark;
  for (let i = 0; i < 22; i++) {
    if (rand() < 0.42) continue;
    const bx = cx + R * (0.06 + 0.03 * i);
    ctx.fillRect(bx, cy + R * 0.50, S * 0.008, S * (0.014 + rand() * 0.022));
  }
}

const KINDS = { cuneiform, bootprint, record };

function buildAtlas(kind, variants, seed, opts, body) {
  const draw = KINDS[kind];
  if (!draw) throw new Error(`unknown panel kind: ${kind}`);
  const rand = rng(seed);
  const c = document.createElement('canvas');
  c.width = S * variants;
  c.height = S;
  const ctx = c.getContext('2d');
  for (let v = 0; v < variants; v++) {
    ctx.save();
    ctx.translate(S * (v + 0.5), S);
    ctx.scale(1, -1);
    // `body: null` skips the slab entirely — a mark that is IN a surface (a
    // print in dust, a scratch on rock) has no carrier of its own. The rand is
    // still consumed so variants stay identical either way.
    const sw = S * (0.74 + rand() * 0.1);
    if (body) slab(ctx, sw, S * 0.9, rand, body);
    else rand();
    // the slab draw above consumes one rand; the kind re-derives its own size
    // from the next few, so variants differ in outline as well as in content
    draw(ctx, rand, opts || {});
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// --- rendering -------------------------------------------------------------

const vertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  uniform vec3  uCamLocal;
  uniform float uVariants;
  uniform float uTilt;

  attribute float aVariant;

  varying vec2 vUv;

  void main() {
    vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
    float sx = length(vec3(instanceMatrix[0][0], instanceMatrix[0][1], instanceMatrix[0][2]));
    float sy = length(vec3(instanceMatrix[1][0], instanceMatrix[1][1], instanceMatrix[1][2]));

    vec3 toCam = uCamLocal - iPos;
    toCam.y = 0.0;
    float len = length(toCam);
    vec3 fwd = len > 1e-9 ? toCam / len : vec3(0.0, 0.0, 1.0);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));

    // Lean the top AWAY from the camera. The camera in this journey always sits
    // above the origin looking down a little, so tipping the far edge back is
    // what turns the face toward the reader — leaning it forward would present
    // the writing to the ground.
    float c = cos(uTilt);
    float s = sin(uTilt);
    vec3 lean = vec3(0.0, 1.0, 0.0) * c - fwd * s;

    float up01 = position.y + 0.5;
    vec3 local = iPos + right * (position.x * sx) + lean * (up01 * sy);

    vec4 mv = modelViewMatrix * vec4(local, 1.0);
    gl_Position = projectionMatrix * mv;

    vUv = vec2((uv.x + aVariant) / uVariants, uv.y);
    #include <logdepthbuf_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform sampler2D uMap;
  uniform vec3  uAmbient;
  uniform vec3  uLampCol;
  uniform float uLamp;
  uniform vec2  uLampAt;   // uv of the hot spot
  uniform float uOpacity;

  varying vec2 vUv;

  void main() {
    #include <logdepthbuf_fragment>

    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.35) discard;

    // One warm source a short distance off the surface: inverse-square in uv,
    // softened. A lamp is the only light these objects ever had, and the
    // falloff across the face is most of what makes the clay look like clay.
    vec2 d = vUv - uLampAt;
    float fall = 1.0 / (1.0 + dot(d, d) * 9.0);
    vec3 lit = tex.rgb * (uAmbient + uLampCol * uLamp * fall);

    gl_FragColor = vec4(lit, uOpacity);
  }
`;

export function panel({
  kind = 'cuneiform',
  kindOpts = null,
  count = 1,
  variants = 4,
  seed = 1,
  sizeMeters = [0.3, 0.36],   // cell height in metres; the drawn slab fills ~0.9 of it
  aspect = 1,
  areaMeters = 0,             // scatter radius for count > 1; instance 0 stays at the origin
  yMeters = 0,
  tiltRad = 0.42,
  bodyColor = '#c9a273',      // fired clay
  ambient = 0x2a2620,
  lampColor = 0xffb066,
  lamp = () => 1.6,
  lampAt = [0.38, 0.3],
  opacity = () => 1,
  respectBand = true,
} = {}) {
  const rand = rng(seed);
  const tex = buildAtlas(kind, variants, seed * 17 + 3, kindOpts, bodyColor);

  const uniforms = {
    uMap: { value: tex },
    uCamLocal: { value: new THREE.Vector3() },
    uVariants: { value: variants },
    uTilt: { value: tiltRad },
    uAmbient: { value: new THREE.Color(ambient) },
    uLampCol: { value: new THREE.Color(lampColor) },
    uLamp: { value: 1 },
    uLampAt: { value: new THREE.Vector2(...lampAt) },
    uOpacity: { value: 1 },
  };

  const geo = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    }),
    count,
  );
  mesh.frustumCulled = false;

  const variantAttr = new Float32Array(count);
  const m = new THREE.Matrix4();

  for (let i = 0; i < count; i++) {
    // the first is the subject and sits at the origin at full size; the rest
    // are the archive around it, smaller and further out
    const near = i === 0;
    const r = near ? 0 : areaMeters * (0.35 + 0.65 * Math.sqrt(rand()));
    const th = rand() * Math.PI * 2;
    const h = (sizeMeters[0] + rand() * (sizeMeters[1] - sizeMeters[0])) * (near ? 1 : 0.72);
    m.makeScale(h * aspect, h, 1);
    m.setPosition(Math.cos(th) * r, yMeters, Math.sin(th) * r);
    mesh.setMatrixAt(i, m);
    variantAttr[i] = Math.floor(rand() * variants);
  }
  mesh.instanceMatrix.needsUpdate = true;
  geo.setAttribute('aVariant', new THREE.InstancedBufferAttribute(variantAttr, 1));

  const group = new THREE.Group();
  group.add(mesh);

  const camLocal = new THREE.Vector3();

  return {
    group,
    uniforms,
    update({ u, local, rebase, t, camera }) {
      group.scale.setScalar(rebase.toWorld(1));
      uniforms.uLamp.value = lamp({ u, local, t });

      if (camera) {
        group.updateMatrixWorld();
        camLocal.copy(camera.position);
        group.worldToLocal(camLocal);
        uniforms.uCamLocal.value.copy(camLocal);
      }

      const w = respectBand ? rebase.weight(sizeMeters[1]) : 1;
      const o = opacity({ u, local, rebase }) * w;
      uniforms.uOpacity.value = o;
      group.visible = o > 0.004;
    },
    dispose() {
      geo.dispose();
      mesh.material.dispose();
      mesh.dispose();
      tex.dispose();
    },
  };
}
