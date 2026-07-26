import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { animate } from 'animejs';
import {
  brushedMap,
  castMap,
  brushedNormalMap,
  castNormalMap,
  grimeMap,
  heatBlueMap,
  woodGrainMap,
} from './textures.js';

// Shared material presets so explainers look like one family.
export const materials = {
  // --- v2 physical presets (use for new/upgraded explainers) ---------------
  // aluminum/brushedSteel carry both a roughnessMap (large-scale grain) AND a
  // normalMap (the same grain as actual micro-bumps) — roughness alone reads
  // flat under raking light; the normal map is what makes each bump catch or
  // lose the highlight as the camera orbits.
  aluminum: (color = 0xb9c0c8) =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 1,
      roughness: 0.42,
      roughnessMap: castMap(),
      normalMap: castNormalMap(),
      normalScale: new THREE.Vector2(0.35, 0.35),
    }),
  brushedSteel: (color = 0xc6ccd4) =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 1,
      roughness: 0.3,
      roughnessMap: brushedMap(),
      normalMap: brushedNormalMap(),
      normalScale: new THREE.Vector2(0.4, 0.4),
    }),
  chrome: (color = 0xd8dde3) =>
    new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: 0.09 }),
  paintedMetal: (color) =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.25,
      roughness: 0.42,
      clearcoat: 1,
      clearcoatRoughness: 0.14,
    }),
  rubber: (color = 0x1c1e22) =>
    new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: 0.95 }),
  // matte moulded polymer — tool/appliance/firearm housings. Distinct from
  // `plastic` (glossier MeshStandard) and `paintedMetal` (glossy lacquer over
  // metal): near-zero specular gloss, just the faint sheen real polymer has,
  // so it reads as a dry moulded body rather than wet-looking plastic. A low
  // clearcoat (0.15) also lets it ghost correctly on reveal — a high coat
  // renders at full strength regardless of opacity and reads solid.
  polymer: (color = 0x23262c) =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0,
      roughness: 0.74,
      clearcoat: 0.15,
      clearcoatRoughness: 0.62,
    }),
  // varnished laminate wood — rifle/tool furniture, handles, stocks. The grain
  // colour rides a woodGrainMap; `tint` multiplies it (default white keeps the
  // map's own browns). A light clearcoat gives the satin varnish sheen.
  wood: (tint = 0xffffff) =>
    new THREE.MeshPhysicalMaterial({
      color: tint,
      map: woodGrainMap(),
      metalness: 0,
      roughness: 0.55,
      clearcoat: 0.25,
      clearcoatRoughness: 0.38,
    }),
  // grimy cast aluminum — oil/dirt pools toward the UV's "down" edge instead
  // of scattering evenly, for housings that sit low and collect it (sumps,
  // crankcases). Pair with geometry whose UV "down" is the part's actual
  // underside.
  grimyAluminum: (color = 0xb9c0c8) =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 1,
      // roughnessMap MULTIPLIES this — grime texels average ~0.6, so 0.9
      // lands at ~0.55 effective. Lower values turn large flat bases into
      // softbox mirrors.
      roughness: 0.9,
      roughnessMap: grimeMap(),
      normalMap: castNormalMap(),
      normalScale: new THREE.Vector2(0.12, 0.12),
    }),
  // heat-blued steel for exhaust parts: straw-gold at the hot end fading
  // through purple/blue to cold dark steel — colour driven entirely by a
  // gradient texture, no per-part tinting needed. direction 'u' suits
  // TubeGeometry headers, 'v' suits CylinderGeometry (jet nozzles etc.).
  heatBluedSteel: (direction = 'u') =>
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: heatBlueMap(direction),
      metalness: 1,
      roughness: 0.28,
      normalMap: brushedNormalMap(),
      normalScale: new THREE.Vector2(0.25, 0.25),
    }),

  // --- v1 presets ------------------------------------------------------------
  steel: (color = 0x9aa2ad) =>
    new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: 0.35 }),
  darkMetal: (color = 0x3a3f47) =>
    new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.45 }),
  plastic: (color) =>
    new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.55 }),
  glass: (color = 0xbfd8ff, opacity = 0.16) =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0,
      roughness: 0.12,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  glow: (color, intensity = 1.6) =>
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
    }),
};

// Cylinder whose origin is at its BOTTOM end and which extends along +Y.
// Much easier to position rods/stems with than the centered default.
export function rod(radius, length, material, radialSegments = 20) {
  const geo = new THREE.CylinderGeometry(radius, radius, length, radialSegments);
  geo.translate(0, length / 2, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

export function box(w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = true;
  return mesh;
}

export function disc(radius, thickness, material, segments = 40) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, thickness, segments),
    material,
  );
  mesh.castShadow = true;
  return mesh;
}

// Small cone used as a flow-direction arrow.
export function arrow(color, size = 0.1) {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(size * 0.5, size, 12),
    materials.glow(color, 1.2),
  );
  mesh.material.transparent = true;
  mesh.material.depthWrite = false; // fully-faded arrows must not punch holes in glass
  return mesh;
}

// Brief emissive pulse to draw attention to a part.
export function pulse(mesh, color = 0x6ea8ff) {
  const mat = mesh.material;
  if (!mat || !mat.emissive) return;
  const original = mat.emissive.getHex();
  mat.emissive.setHex(color);
  const state = { t: 1 };
  animate(state, {
    t: 0,
    duration: 900,
    ease: 'outQuad',
    onUpdate: () => (mat.emissiveIntensity = state.t * 1.4),
    onComplete: () => {
      mat.emissive.setHex(original);
      mat.emissiveIntensity = 1;
    },
  });
}

// A queue of small glowing dots riding a curve (anything with getPointAt(t)
// in 0..1 — tubeAlong()'s userData.curve, chainPath(), a plain
// CatmullRomCurve3), for visualizing charge/current queuing along a wire:
// capacitor leads charging, current building in an inductor/transformer
// winding. `setFront(front)` places `count` dots trailing behind a leading
// edge at `front` (0..1 along the curve), each spaced `spacing` behind the
// last and fading in as it enters the curve — so a single scalar sweeping
// 0→1→0 reads as charge arriving then draining, no continuous animation
// loop required. Reverse direction (drain) just sweeps front back down.
export function chargeQueue(curve, count = 6, color = 0x6ea8ff, opts = {}) {
  const { size = 0.022, spacing = 0.09 } = opts;
  const geo = new THREE.SphereGeometry(size, 10, 8);
  const group = new THREE.Group();
  const dots = [];
  for (let i = 0; i < count; i++) {
    const mat = materials.glow(color, 1.5);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
    const dot = new THREE.Mesh(geo, mat);
    group.add(dot);
    dots.push(dot);
  }
  function setFront(front, visible = true) {
    dots.forEach((dot, i) => {
      const t = front - i * spacing;
      if (!visible || t <= 0.001) {
        dot.material.opacity = 0;
        return;
      }
      const tc = Math.min(1, t);
      const p = curve.getPointAt(tc);
      dot.position.copy(p);
      dot.material.opacity = Math.min(1, t * 8) * (1 - (i / count) * 0.2);
    });
  }
  setFront(0);
  return { group, dots, setFront };
}

// Standard charcoal display plinth every product-shot explainer stands on.
// The clearcoat comes pre-softened: the paintedMetal preset's default coat
// streak was the ONE clipped-white patch in a full readPixels bisect of the
// gearbox scene — these numbers are the verified fix, don't re-brighten them.
// Returns a mesh with its BOTTOM at y=0 (model stands on top at y=h).
export function studioPlinth({ w = 3.6, h = 0.26, d = 1.9, bevel = 0.06, color = 0x1b1d21 } = {}) {
  const mat = materials.paintedMetal(color);
  mat.clearcoat = 0.45;
  mat.clearcoatRoughness = 0.32;
  mat.roughness = 0.55;
  const r = Math.min(bevel, w / 2, h / 2, d / 2);
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat);
  mesh.position.y = h / 2;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

// Floating text label rendered onto a canvas sprite.
export function label(text, { color = '#e8eaf0', size = 0.5 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = '600 52px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
  );
  sprite.scale.set(size * 4, size, 1);
  return sprite;
}
