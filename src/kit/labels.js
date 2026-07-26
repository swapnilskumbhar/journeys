import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// DOM callout label: anchor dot + hairline leader line + text pill, rendered
// by the stage's CSS2DRenderer — crisp at any DPI, styled by site CSS.
//
// `dir` is the leader direction in screen degrees (0 = right, 90 = up),
// `len` its length in px. Attach to any Object3D — including moving parts;
// the label follows the part's world position.
//
// The base (dir, len) is stashed on the element so the per-frame declutter pass
// (label-layout.js) can reset to it before re-resolving overlaps — otherwise
// nudges would compound frame over frame.
export function callout(text, { dir = 45, len = 48, key } = {}) {
  const root = document.createElement('div');
  root.className = 'callout';
  root.style.pointerEvents = 'none';

  const line = document.createElement('span');
  line.className = 'callout-line';

  const tx = document.createElement('span');
  tx.className = 'callout-text';
  tx.textContent = text;

  root.append(line, tx);
  root.dataset.baseDir = String(dir);
  root.dataset.baseLen = String(len);
  root.dataset.key = key ?? text; // matched by step.focus to pulse the active part
  setLeader(root, dir, len);
  const obj = new CSS2DObject(root);
  // live readouts (#17): drive from the model's pose fn to show values that
  // update in real time (RPM, current stroke, pressure). Cheap — just text.
  obj.setText = (s) => {
    tx.textContent = s;
  };
  return obj;
}

// Point a callout's leader at (dir°, len px) from its anchor and hang the pill
// off the far end. Shared by callout() and the declutter pass so the geometry
// stays consistent.
export function setLeader(root, dir, len) {
  const line = root.querySelector('.callout-line');
  const tx = root.querySelector('.callout-text');
  const rad = (dir * Math.PI) / 180;
  line.style.width = `${len}px`;
  line.style.transform = `rotate(${-dir}deg)`;
  tx.style.left = `${Math.cos(rad) * len}px`;
  tx.style.top = `${-Math.sin(rad) * len}px`;
  tx.style.transform =
    Math.cos(rad) >= 0 ? 'translate(4px, -50%)' : 'translate(calc(-100% - 4px), -50%)';
}
