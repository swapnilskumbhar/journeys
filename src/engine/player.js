import * as THREE from 'three';
import { createStage } from './stage.js';
import { makeRebaser } from './rebase.js';
import { makeStreamer } from './stream.js';
import { createRibbon } from './ribbon.js';
import { clamp01 } from './axis.js';
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
      <a class="back-link" href="/">← all journeys</a>
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
  const streamer = makeStreamer({ scene: stage.scene, THREE, rebase, kit });
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
    onSeek: (u) => window.scrollTo({ top: u * scrollRange(), behavior: 'smooth' }),
  });

  const ctx = { rebase, axis: journey.axis, stage, THREE, kit };
  journey.onBuild?.(ctx);

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

  const stopTick = stage.onTick((dt) => {
    // The exporter drives the axis directly for deterministic frames; a live
    // page reads scroll. One scalar either way — this is why journey renders
    // are simpler to make deterministic than howitworks' discrete steps.
    if (window.__u !== undefined) {
      u = uTarget = clamp01(window.__u);
    } else {
      uTarget = clamp01(window.scrollY / scrollRange());
      // light damping so a flicked trackpad reads as travel, not a jump
      u += (uTarget - u) * Math.min(1, dt * 9);
    }

    rebase.setScale(journey.scaleAt(u, journey.axis));
    streamer.sync(u);
    journey.camera?.(u, stage.camera, ctx);
    streamer.update(u, dt);

    const i = beatIndexAt(u);
    ribbon.update(u, i);
    showBeat(i);
    heroEl.style.opacity = String(Math.max(0, 1 - u * 40));
  });

  window.__journey = { stage, journey, rebase, streamer, seek: (v) => { window.__u = v; } };

  window.scrollTo(0, 0);

  return {
    destroy() {
      stopTick();
      ribbon.dispose();
      streamer.disposeAll();
      journey.onDispose?.(ctx);
      stage.dispose();
      delete window.__journey;
      container.innerHTML = '';
    },
  };
}
