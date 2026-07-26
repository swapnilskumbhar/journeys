import { setLeader } from './labels.js';

// Runtime label declutter — keeps callout pills from overlapping each other,
// regardless of how their leaders were authored. Two labels whose anchors
// project near each other used to collide (the reviewer/eyes caught these one
// at a time); this resolves them automatically every frame.
//
// Strategy: measure every visible callout pill's on-screen box, then greedily
// push overlapping pills DOWN (classic vertical declutter) and re-aim each
// nudged leader so it still connects the anchor dot to its moved pill. The
// nudge is a screen-space delta relative to the anchor, so no camera projection
// is needed — the base leader (dir,len) plus the delta fully defines the new
// endpoint. Bases are reset from the element each frame so nudges never
// compound. Cheap for the handful of labels a step shows.
const MARGIN = 5; // px of clear space required between pills

export function declutterCallouts(scene) {
  const items = [];
  scene.traverse((o) => {
    if (!o.isCSS2DObject || !o.visible || !o.element) return;
    const el = o.element;
    if (!el.classList.contains('callout') || el.style.display === 'none') return;
    const tx = el.querySelector('.callout-text');
    if (!tx || el.dataset.baseDir === undefined) return;
    const bdir = parseFloat(el.dataset.baseDir);
    const blen = parseFloat(el.dataset.baseLen);
    setLeader(el, bdir, blen); // reset to authored position before re-measuring
    items.push({ el, tx, bdir, blen });
  });
  if (items.length < 2) return;

  for (const it of items) it.box = it.tx.getBoundingClientRect();
  // sort top→down; push each pill below any already-placed pill it overlaps
  items.sort((a, b) => a.box.top - b.box.top);
  for (let i = 0; i < items.length; i++) {
    const cur = items[i];
    cur.ny = 0;
    for (let j = 0; j < i; j++) {
      const prev = items[j];
      const horiz =
        cur.box.left < prev.box.right + MARGIN && cur.box.right > prev.box.left - MARGIN;
      if (!horiz) continue;
      const overlap = prev.box.bottom + prev.ny + MARGIN - (cur.box.top + cur.ny);
      if (overlap > 0) cur.ny += overlap;
    }
  }

  for (const it of items) {
    if (!it.ny || it.ny < 0.5) continue;
    // base endpoint (px, y-down) + the downward nudge → re-aim the leader there
    const rad = (it.bdir * Math.PI) / 180;
    const ex = Math.cos(rad) * it.blen;
    const ey = -Math.sin(rad) * it.blen + it.ny;
    const len = Math.hypot(ex, ey);
    const dir = (Math.atan2(-ey, ex) * 180) / Math.PI;
    setLeader(it.el, dir, len);
  }
}
