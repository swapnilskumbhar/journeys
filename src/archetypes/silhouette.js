import * as THREE from 'three';
import { rng } from './points-material.js';

// Backlit forms — the answer to "how do you show a trilobite without modelling
// a trilobite".
//
// Each `kind` is a 2D drawing routine that fills an alpha mask on a canvas;
// several randomised variants are packed into one atlas, and instances are
// cylindrical billboards sampling it. Nothing is lit, because a silhouette has
// no lit side: the form is read entirely from its OUTLINE against a bright
// backdrop. That is what makes this cheap to build and impossible to render as
// bad 3D — there is no 3D to get wrong, and recognisability lives in the
// profile, which is exactly where it lives in real life.
//
// Pair with backdrop.js. A silhouette against a dark sky is a black rectangle.

const S = 256;

// --- drawing ---------------------------------------------------------------
// All routines work in canvas pixels with the origin moved to bottom-centre and
// y already flipped, so +y is up and the form stands on y=0.

function frond(ctx, rand) {
  // Ediacaran rangeomorph (Charnia): a quilted PADDLE on a short stalk, not a
  // conifer. Built from paired lobes angled up along a spine, which gives the
  // bumpy leaf outline that distinguishes it in silhouette from a tree — the
  // earlier version drew fine needles and read unmistakably as a fir.
  const h = S * (0.62 + rand() * 0.24);
  // Wide and leaf-like. A narrow frond standing on ground against a bright
  // gradient reads as a cypress no matter how its edge is drawn — the width
  // and the ROUNDED tip are what separate "frond" from "conifer".
  const wMax = h * (0.52 + rand() * 0.26);
  const lean = (rand() - 0.5) * 0.75;
  const stalkH = h * (0.16 + rand() * 0.1);
  const lobes = 7 + Math.floor(rand() * 4);

  // holdfast disc
  ctx.beginPath();
  ctx.ellipse(0, S * 0.012, wMax * 0.34, S * 0.02, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineCap = 'round';
  ctx.lineWidth = wMax * 0.13;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(lean * wMax, stalkH);
  ctx.stroke();

  for (let i = 0; i < lobes; i++) {
    const t = (i + 0.5) / lobes;
    const y = stalkH + (h - stalkH) * t;
    const x = lean * wMax * (0.5 + t);
    // sin(t^0.5) peaks early and falls away slowly, giving a blunt top; the
    // earlier t^0.7 tapered to a spike
    const env = Math.sin(t ** 0.5 * Math.PI) * (1 - t * 0.05) + 0.18;
    const lw = wMax * 0.5 * env * (0.85 + rand() * 0.3);
    const lh = ((h - stalkH) / lobes) * 1.25;
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.translate(x + dir * lw * 0.5, y);
      ctx.rotate(dir * -0.34);
      ctx.beginPath();
      ctx.ellipse(0, 0, lw * 0.78, lh * 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // spine stops short of the tip — running it to the top drew the spike back on
  ctx.lineWidth = wMax * 0.09;
  ctx.beginPath();
  ctx.moveTo(lean * wMax, stalkH);
  ctx.lineTo(lean * wMax * 1.5, h * 0.8);
  ctx.stroke();
}

function segmented(ctx, rand) {
  // A Cambrian swimmer in profile, Anomalocaris-like. Everything here fights
  // one failure mode: a smooth ellipse with small scallops reads as a torpedo.
  // The body is therefore a CHAIN OF DISCS (a lumpy, jointed outline) and the
  // lateral lobes are large and clearly separated, because at 60–100 px tall
  // any detail finer than that disappears and only the profile survives.
  const L = S * (0.58 + rand() * 0.2);
  const H = L * (0.26 + rand() * 0.1);
  const cy = S * 0.5;
  const segs = 8 + Math.floor(rand() * 4);
  const bodyAt = (t) => -L * 0.46 + t * L * 0.8;

  // lobes first, so the body overlaps and unifies them
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const x = bodyAt(t);
    const env = Math.sin(t * Math.PI);
    const w = L * 0.058;
    const drop = H * (0.5 + env * 1.05);
    ctx.beginPath();
    ctx.moveTo(x - w, cy - H * 0.05);
    ctx.quadraticCurveTo(x - w * 0.5, cy - drop * 1.05, x, cy - drop);
    ctx.quadraticCurveTo(x + w * 0.5, cy - drop * 1.05, x + w, cy - H * 0.05);
    ctx.closePath();
    ctx.fill();
  }

  // segmented trunk
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const r = H * 0.5 * (0.4 + Math.sin(t ** 0.75 * Math.PI) * 0.9);
    ctx.beginPath();
    ctx.ellipse(bodyAt(t), cy, r * 0.8, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // head, deeper than the trunk
  ctx.beginPath();
  ctx.ellipse(L * 0.38, cy, L * 0.15, H * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();

  // splayed tail fan
  for (const a of [-0.55, 0, 0.55]) {
    ctx.save();
    ctx.translate(-L * 0.44, cy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(-L * 0.11, 0, L * 0.12, H * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // forward grasping appendages, curling down and in
  ctx.lineCap = 'round';
  ctx.lineWidth = L * 0.045;
  for (const s of [0, 1]) {
    ctx.beginPath();
    ctx.moveTo(L * 0.48, cy - H * 0.1 + s * H * 0.2);
    ctx.quadraticCurveTo(L * 0.72, cy - H * 0.5 - s * H * 0.1, L * 0.58, cy - H * 1.1 - s * H * 0.15);
    ctx.stroke();
  }

  // stalked eyes — small, but they break the head outline, which is what the
  // Cambrian copy is actually about
  for (const s of [-1, 1]) {
    ctx.lineWidth = L * 0.028;
    ctx.beginPath();
    ctx.moveTo(L * 0.36 + s * L * 0.04, cy + H * 0.3);
    ctx.lineTo(L * 0.36 + s * L * 0.09, cy + H * 0.78);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(L * 0.36 + s * L * 0.09, cy + H * 0.85, L * 0.055, L * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function tree(ctx, rand) {
  // Recursive branching with tapering, plus canopy blobs at the tips. The same
  // routine covers a Devonian tree fern and an oak, by depth and blob size.
  const h = S * (0.62 + rand() * 0.3);
  const canopy = 0.55 + rand() * 0.6;

  const branch = (x, y, ang, len, w, depth) => {
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    ctx.lineWidth = Math.max(1, w);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (depth === 0) {
      const r = S * 0.05 * canopy * (0.7 + rand() * 0.7);
      ctx.beginPath();
      ctx.ellipse(x2, y2, r * 1.25, r, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const n = 2 + (rand() < 0.35 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const spread = 0.42 + rand() * 0.42;
      const a = ang + (i - (n - 1) / 2) * spread + (rand() - 0.5) * 0.22;
      branch(x2, y2, a, len * (0.66 + rand() * 0.16), w * 0.62, depth - 1);
    }
  };

  branch(0, 0, Math.PI / 2 + (rand() - 0.5) * 0.18, h * 0.36, S * 0.042, 3 + (rand() < 0.5 ? 1 : 0));
}

function dome(ctx, rand) {
  // Stromatolite: a stack of accreted mounds, wider than tall.
  //
  // The arc runs 0→PI, not PI→2PI. The atlas is drawn with the y axis already
  // flipped so +y is up, which inverts the sense of the angle too — the
  // original range drew the BOTTOM half of each ellipse, and every stromatolite
  // in the journey rendered as a flat-topped slab.
  const w = S * (0.42 + rand() * 0.3);
  const h = w * (0.5 + rand() * 0.45);
  const layers = 3 + Math.floor(rand() * 3);
  for (let i = layers - 1; i >= 0; i--) {
    const t = i / layers;
    ctx.beginPath();
    ctx.ellipse(
      (rand() - 0.5) * w * 0.12,
      h * t * 0.55,
      w * 0.5 * (1 - t * 0.34),
      h * 0.55 * (1 - t * 0.18),
      0, 0, Math.PI,
    );
    ctx.fill();
  }
  ctx.fillRect(-w * 0.5, 0, w, h * 0.06);
}

function figure(ctx, rand) {
  // A person, standing or mid-stride.
  //
  // Deliberately plain, and deliberately THICK. These land at 20–60 px tall,
  // and at the original limb widths (h * 0.052) the torso was under two pixels
  // — every hominin in the journey rendered as a faint scratch next to a tree.
  // A silhouette that survives being small has to be drawn heavier than looks
  // right at full size; the stance carries the meaning, not the anatomy.
  const h = S * (0.74 + rand() * 0.2);
  const stride = 0.55 + rand() * 0.75;
  const w = h * 0.085;

  ctx.lineCap = 'round';
  ctx.lineWidth = w * 1.6;
  // legs
  ctx.beginPath();
  ctx.moveTo(0, h * 0.45);
  ctx.lineTo(h * 0.13 * stride, 0);
  ctx.moveTo(0, h * 0.45);
  ctx.lineTo(-h * 0.13 * stride, 0);
  ctx.stroke();
  // torso
  ctx.lineWidth = w * 2.2;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.44);
  ctx.lineTo(0, h * 0.79);
  ctx.stroke();
  // arms
  ctx.lineWidth = w * 1.35;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.76);
  ctx.lineTo(-h * 0.14 * stride, h * 0.48);
  ctx.moveTo(0, h * 0.76);
  ctx.lineTo(h * 0.16 * stride, h * 0.5);
  ctx.stroke();
  // head
  ctx.beginPath();
  ctx.ellipse(0, h * 0.885, h * 0.085, h * 0.095, 0, 0, Math.PI * 2);
  ctx.fill();
}

function reed(ctx, rand) {
  // Blades of grass / shoreline reeds. Cheap ground clutter that stops a
  // terrain reading as bare.
  const n = 4 + Math.floor(rand() * 5);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const h = S * (0.35 + rand() * 0.55);
    const x = (rand() - 0.5) * S * 0.4;
    const bend = (rand() - 0.5) * S * 0.3;
    ctx.lineWidth = S * (0.012 + rand() * 0.014);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + bend * 0.4, h * 0.6, x + bend, h);
    ctx.stroke();
  }
}

const KINDS = { frond, segmented, tree, dome, figure, reed };

function buildAtlas(kind, variants, seed) {
  const draw = KINDS[kind];
  if (!draw) throw new Error(`unknown silhouette kind: ${kind}`);
  const rand = rng(seed);
  const c = document.createElement('canvas');
  c.width = S * variants;
  c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  for (let v = 0; v < variants; v++) {
    ctx.save();
    // origin to the bottom-centre of this slice, y flipped so +y is up
    ctx.translate(S * (v + 0.5), S);
    ctx.scale(1, -1);
    draw(ctx, rand);
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
  uniform float uTime;
  uniform float uSway;
  uniform float uNearFade;  // metres — dissolve instances closer than this

  attribute float aVariant;
  attribute float aSeed;

  varying vec2 vUv;
  varying float vNear;

  void main() {
    vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
    float sx = length(vec3(instanceMatrix[0][0], instanceMatrix[0][1], instanceMatrix[0][2]));
    float sy = length(vec3(instanceMatrix[1][0], instanceMatrix[1][1], instanceMatrix[1][2]));

    // cylindrical billboard: yaw toward the camera, never pitch — these things
    // stand on ground and must not tip toward an overhead viewer
    // centreClear only keeps instances away from the ORIGIN, and the camera is
    // neither at the origin nor stationary — it sits several units out and the
    // copy panel pans it sideways. So a scatter that looks well spaced can
    // still put one instance three metres off the lens, where it fills a
    // quarter of the frame as a cropped black mass. Fading by true distance to
    // the camera is the only thing that fixes it for every framing.
    // (NB no backticks in this file's shader comments — the GLSL lives in a JS
    // template literal, and one backtick ends it three hundred lines early.)
    float camDist = length(uCamLocal - iPos);
    vNear = uNearFade > 0.0 ? smoothstep(uNearFade * 0.55, uNearFade, camDist) : 1.0;

    vec3 toCam = uCamLocal - iPos;
    toCam.y = 0.0;
    float len = length(toCam);
    vec3 fwd = len > 1e-9 ? toCam / len : vec3(0.0, 0.0, 1.0);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));

    float up01 = position.y + 0.5;           // 0 at the base, 1 at the top
    float sway = sin(uTime * 0.9 + aSeed * 6.2831853) * uSway * up01 * up01;

    vec3 local = iPos
      + right * ((position.x + sway) * sx)
      + vec3(0.0, 1.0, 0.0) * (up01 * sy);

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
  uniform vec3  uColor;
  uniform vec3  uRim;
  uniform float uCut;
  uniform float uOpacity;

  varying vec2 vUv;
  varying float vNear;

  void main() {
    #include <logdepthbuf_fragment>

    float a = texture2D(uMap, vUv).a;
    if (a < uCut) discard;
    if (vNear <= 0.004) discard;

    // A hair of light bleeding around the edge. Without it a silhouette is a
    // dead hole in the frame; with it the form reads as a body with light
    // behind it.
    float core = smoothstep(uCut, uCut + 0.45, a);
    vec3 col = mix(uRim, uColor, core);

    gl_FragColor = vec4(col, uOpacity * vNear);
  }
`;

export function silhouette({
  kind = 'frond',
  count = 40,
  variants = 5,
  seed = 1,
  areaMeters = 20,          // scatter radius on the ground
  heightMeters = [1, 2.4],  // base → tallest
  aspect = 1,               // width/height multiplier of the drawn form
  centreClear = 0,          // keep a clear radius at the origin
  nearFadeMeters = 0,       // dissolve instances that come this close to the camera
  color = 0x05060a,
  rim = 0x2a3450,
  cut = 0.34,
  sway = 0,
  yMeters = 0,              // lift off the ground (swimmers)
  spreadY = 0,              // vertical scatter around yMeters
  opacity = () => 1,
  respectBand = true,
} = {}) {
  const rand = rng(seed);
  const tex = buildAtlas(kind, variants, seed * 31 + 7);

  const uniforms = {
    uMap: { value: tex },
    uCamLocal: { value: new THREE.Vector3() },
    uVariants: { value: variants },
    uTime: { value: 0 },
    uSway: { value: sway },
    uNearFade: { value: nearFadeMeters },
    uColor: { value: new THREE.Color(color) },
    uRim: { value: new THREE.Color(rim) },
    uCut: { value: cut },
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
  const seedAttr = new Float32Array(count);
  const m = new THREE.Matrix4();

  for (let i = 0; i < count; i++) {
    // sqrt keeps the scatter uniform by area rather than piling up at the centre
    const r = centreClear + (areaMeters - centreClear) * Math.sqrt(rand());
    const th = rand() * Math.PI * 2;
    const h = heightMeters[0] + rand() ** 1.7 * (heightMeters[1] - heightMeters[0]);
    m.makeScale(h * aspect, h, 1);
    m.setPosition(
      Math.cos(th) * r,
      yMeters + (rand() - 0.5) * spreadY,
      Math.sin(th) * r,
    );
    mesh.setMatrixAt(i, m);
    variantAttr[i] = Math.floor(rand() * variants);
    seedAttr[i] = rand();
  }
  mesh.instanceMatrix.needsUpdate = true;
  geo.setAttribute('aVariant', new THREE.InstancedBufferAttribute(variantAttr, 1));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedAttr, 1));

  const group = new THREE.Group();
  group.add(mesh);

  const camLocal = new THREE.Vector3();

  return {
    group,
    uniforms,
    update({ u, local, rebase, t, camera }) {
      // instances are authored in metres
      group.scale.setScalar(rebase.toWorld(1));
      uniforms.uTime.value = t;

      if (camera) {
        camLocal.copy(camera.position);
        group.worldToLocal(camLocal);
        uniforms.uCamLocal.value.copy(camLocal);
      }

      const w = respectBand ? rebase.weight(areaMeters) : 1;
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
