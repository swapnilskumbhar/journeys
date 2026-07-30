import * as THREE from 'three';
import { createStage } from './stage.js';
import { makeRebaser } from './rebase.js';
import { makeStreamer } from './stream.js';
import { createRibbon } from './ribbon.js';
import { clamp01 } from './axis.js';
import { hrefFor } from '../routes.js';
import * as kit from '../kit/index.js';

// Mounts a journey and returns a destroy() handle.
//
// Layout: a fixed full-viewport canvas, one tall spacer that provides the
// scroll range, and a SINGLE copy panel whose contents swap at beat boundaries.
//
// That last part is the deliberate departure from howitworks, which renders one
// <section> per step. A journey can carry 200 beats; 200 sections would put the
// scaling problem straight back into the DOM. One panel, swapped, is O(1) in
// beat count — matching stream.js doing the same job for the scene graph.

export function mountJourney(journey, container) {
  container.innerHTML = `
    <div class="journey" style="--accent:${journey.accent ?? '#7cc4ff'}">
      <div class="canvas-holder"></div>
      <a class="back-link" href="${hrefFor()}">← all journeys</a>
      <header class="journey-hero">
        <p class="hero-kicker">a journey through</p>
        <h1>${journey.title}</h1>
        <p class="hero-summary">${journey.summary ?? ''}</p>
        <p class="scroll-hint">scroll<span>▾</span></p>
      </header>
      <div class="beat-panel" aria-live="polite">
        <span class="beat-num"></span>
        <h2></h2>
        <p class="beat-body"></p>
        <p class="beat-hint"></p>
      </div>
      <div class="scroll-spacer" style="height:${journey.length * 100}vh"></div>
      <div class="ribbon-mount"></div>
    </div>
  `;

  const holder = container.querySelector('.canvas-holder');
  const stage = createStage(holder, journey.stageOptions);
  const rebase = makeRebaser();
  const streamer = makeStreamer({ scene: stage.scene, THREE, rebase, kit, camera: stage.camera });
  streamer.setLayers(journey.layers);

  const panel = container.querySelector('.beat-panel');
  const numEl = panel.querySelector('.beat-num');
  const headEl = panel.querySelector('h2');
  const bodyEl = panel.querySelector('.beat-body');
  const hintEl = panel.querySelector('.beat-hint');
  const heroEl = container.querySelector('.journey-hero');

  const ribbon = createRibbon({
    container: container.querySelector('.ribbon-mount'),
    journey,
    // `smooth: false` is a SCRUB — the frame must land under the pointer, now.
    // 'instant', not 'auto': html carries `scroll-behavior: smooth`, and 'auto'
    // defers to that, so a dragged scrub would animate the page out from under
    // the finger it is supposed to be following.
    onSeek: (u, { smooth = true } = {}) =>
      window.scrollTo({ top: u * scrollRange(), behavior: smooth ? 'smooth' : 'instant' }),
  });

  const ctx = { rebase, axis: journey.axis, stage, THREE, kit };
  journey.onBuild?.(ctx);

  // --- look-around ---------------------------------------------------------
  // Left-drag turns the reader's head. The camera stays where the beat put it;
  // only the direction changes.
  //
  // This is the one feature that looks like it violates rule 8, and does not.
  // The rule bans a camera that moves ON ITS OWN — the old `t * 0.035` bearing
  // meant the frame you got for a beat depended on how long the tab had been
  // open, so two review shots of one u were two different pictures. Input is a
  // different thing entirely: u is already input, and this is a second input
  // axis beside it. The camera remains a pure function of (u, look), which is
  // what determinism actually requires.
  //
  // Three properties keep the authored work safe:
  //   · CLAMPED. Every composition here is authored in world space against a
  //     camera on +z — `offsetMeters`, `lightDir`, which way silhouettes face.
  //     A free 360° look slides all of it, which is exactly the defect the
  //     AZIMUTH table was written to kill. ±40° is parallax; it is not a new
  //     bearing.
  //   · RETURNS on release, so the next beat is framed as it was composed.
  //   · DISABLED whenever `window.__u` is set. Every review and export path
  //     drives that hook, so shots, frame-check and video stay byte-identical
  //     and scroll-check's camera-purity assertion still holds.
  const lookCfg = { maxYaw: 40, maxPitch: 22, sensitivity: 0.22, returnRate: 4.5, returnFloor: 14, enabled: true, ...(journey.look ?? {}) };
  const look = { yaw: 0, pitch: 0 };
  let dragging = null;

  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  const lookQuat = new THREE.Quaternion();

  function onPointerDown(e) {
    // Mouse only, main button only. Touch drags are the page's scroll gesture —
    // the wheel and the finger are this product's only way to move the axis
    // (rule 5), and stealing the finger to look around would cost more than it
    // buys. Pointer capture keeps a drag alive if it leaves the canvas.
    if (!lookCfg.enabled || e.pointerType !== 'mouse' || e.button !== 0) return;
    dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
    holder.setPointerCapture(e.pointerId);
    holder.classList.add('is-looking');
  }

  function onPointerMove(e) {
    if (!dragging || e.pointerId !== dragging.id) return;
    // Degrees per pixel scaled to the viewport, so the same gesture covers the
    // same fraction of the allowed range on any display.
    const k = (lookCfg.sensitivity * 1440) / Math.max(600, window.innerWidth);
    look.yaw = clampAbs(look.yaw + (e.clientX - dragging.x) * k, lookCfg.maxYaw);
    look.pitch = clampAbs(look.pitch - (e.clientY - dragging.y) * k, lookCfg.maxPitch);
    dragging.x = e.clientX;
    dragging.y = e.clientY;
  }

  function onPointerUp(e) {
    if (!dragging || e.pointerId !== dragging.id) return;
    if (holder.hasPointerCapture(e.pointerId)) holder.releasePointerCapture(e.pointerId);
    dragging = null;
    holder.classList.remove('is-looking');
  }

  holder.addEventListener('pointerdown', onPointerDown);
  holder.addEventListener('pointermove', onPointerMove);
  holder.addEventListener('pointerup', onPointerUp);
  holder.addEventListener('pointercancel', onPointerUp);
  // A drag across the canvas would otherwise select the hero copy behind it and
  // leave the page with a blue smear across it.
  holder.addEventListener('dragstart', (e) => e.preventDefault());

  function clampAbs(v, m) { return Math.max(-m, Math.min(m, v)); }

  function easeToZero(v, k, floor) {
    const next = v - v * k;
    return Math.abs(next) <= floor ? 0 : next;
  }

  // Yaw about WORLD up, then pitch about the camera's own right vector. Doing
  // both in local space would accumulate roll, which tilts the horizon — and a
  // tilted horizon reads as a bug in every ground-level beat.
  function applyLook(cam) {
    if (!look.yaw && !look.pitch) return;
    lookQuat.setFromAxisAngle(WORLD_UP, (look.yaw * Math.PI) / 180);
    cam.quaternion.premultiply(lookQuat);
    cam.rotateX((look.pitch * Math.PI) / 180);
  }

  function scrollRange() {
    return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  // --- beat selection ------------------------------------------------------
  // The active beat is the last one at or behind u. Binary search rather than a
  // scan, because this runs every frame and beat counts are unbounded.
  function beatIndexAt(u) {
    const b = journey.beats;
    let lo = 0;
    let hi = b.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (b[mid].u <= u) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found;
  }

  let activeBeat = -2;
  function showBeat(i) {
    if (i === activeBeat) return;
    activeBeat = i;
    if (i < 0) {
      panel.classList.remove('is-visible');
      return;
    }
    const beat = journey.beats[i];
    numEl.textContent = `${String(i + 1).padStart(2, '0')} / ${String(journey.beats.length).padStart(2, '0')}`;
    headEl.textContent = beat.heading;
    bodyEl.textContent = beat.body ?? '';
    hintEl.textContent = beat.hint ?? '';
    hintEl.style.display = beat.hint ? '' : 'none';
    panel.classList.add('is-visible');
    // restart the entrance transition
    panel.classList.remove('is-entering');
    void panel.offsetWidth;
    panel.classList.add('is-entering');
  }

  // --- frame ---------------------------------------------------------------
  let u = 0;
  let uTarget = 0;
  let elapsed = 0;

  const stopTick = stage.onTick((dt) => {
    elapsed += dt;
    // The exporter drives the axis directly for deterministic frames; a live
    // page reads scroll. One scalar either way — this is why journey renders
    // are simpler to make deterministic than howitworks' discrete steps.
    if (window.__u !== undefined) {
      u = uTarget = clamp01(window.__u);
      // Deterministic mode. `__look` lets an export author a turn on purpose;
      // absent it the frame is the authored one, so every review shot of a
      // given u is the same picture.
      look.yaw = window.__look?.yaw ?? 0;
      look.pitch = window.__look?.pitch ?? 0;
      dragging = null;
    } else {
      // Treat "within a couple of pixels of the bottom" as exactly 1. Browser
      // scroll positions are fractional and rounding-prone (DPI scaling, elastic
      // overscroll, smooth-scroll animation), and a journey's final beat sits at
      // u=1 — one pixel short and it is unreachable.
      const range = scrollRange();
      const y = window.scrollY;
      uTarget = y >= range - 2 ? 1 : clamp01(y / range);
      // Damping exists to smooth WHEEL JITTER, and only that. A drag — of the
      // scrollbar or of the ribbon — moves the axis by whole screens between
      // one frame and the next, and easing into that means the camera swims
      // through every scene in between while the reader is still holding the
      // pointer, then keeps moving after they let go. So a jump lands whole.
      //
      // The threshold is in viewport-heights, not in u, so it keeps its meaning
      // when a journey's length changes: 1.2vh is far more than any wheel or
      // trackpad delta and far less than any deliberate seek.
      if (Math.abs(uTarget - u) * journey.length > 1.2) {
        u = uTarget;
      } else {
        u += (uTarget - u) * Math.min(1, dt * 9);
        // Snap when close. An exponential approach never actually arrives, which
        // left u at 0.9994 at the bottom of the page — so the final beat, sitting
        // at exactly 1.0, could not be reached by scrolling at all.
        // 1e-3 of the axis is ~0.06 viewport-heights of scroll here: far too small
        // to see as a jump, and comfortably wider than the residual error left
        // after the ramp has visually settled.
        if (Math.abs(uTarget - u) < 1e-3) u = uTarget;
      }
    }

    rebase.setScale(journey.scaleAt(u, journey.axis));
    streamer.sync(u);
    // NO CLOCK HERE, deliberately — see the contract in journey.js. The camera
    // gets u and nothing that changes on its own, so the viewpoint for a beat is
    // the same every time you arrive at it. Idle motion is the layers' job;
    // they are the ones handed `elapsed` on the next line.
    journey.camera?.(u, stage.camera, ctx);
    // Ease back to the authored direction once the pointer is up, so the frame
    // a beat was composed for is the frame it gets. Held exactly while the
    // reader holds it, and not a moment past — the same instinct as the
    // damping rule above, where a released drag must not keep travelling.
    if (!dragging && window.__u === undefined && (look.yaw || look.pitch)) {
      // Exponential ease PLUS a floor rate, for the same reason the u ramp above
      // carries a snap: a pure exponential never arrives, and "almost back to
      // the authored direction" is still not the frame the beat was composed
      // for. The decay does the visible work; the floor closes the last degree.
      const k = Math.min(1, dt * lookCfg.returnRate);
      const floor = lookCfg.returnFloor * dt;
      look.yaw = easeToZero(look.yaw, k, floor);
      look.pitch = easeToZero(look.pitch, k, floor);
    }
    applyLook(stage.camera);
    streamer.update(u, dt, elapsed);

    const i = beatIndexAt(u);
    ribbon.update(u, i);
    showBeat(i);
    // Clear the hero before the first beat panel appears — the two occupy
    // overlapping space and a lingering title reads as a rendering fault.
    heroEl.style.opacity = String(Math.max(0, 1 - u * 150));
  });

  window.__journey = { stage, journey, rebase, streamer, look, seek: (v) => { window.__u = v; } };

  window.scrollTo(0, 0);

  return {
    destroy() {
      stopTick();
      holder.removeEventListener('pointerdown', onPointerDown);
      holder.removeEventListener('pointermove', onPointerMove);
      holder.removeEventListener('pointerup', onPointerUp);
      holder.removeEventListener('pointercancel', onPointerUp);
      ribbon.dispose();
      streamer.disposeAll();
      journey.onDispose?.(ctx);
      stage.dispose();
      delete window.__journey;
      container.innerHTML = '';
    },
  };
}
