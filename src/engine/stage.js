import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// The journeys stage is NOT howitworks' stage. That one is a photographic
// studio: HDRI softboxes, a contact-shadow floor, GTAO, product-shot framing.
// Correct for a machined object on a sweep; wrong for a void.
//
// This one is an atmosphere:
//   · logarithmicDepthBuffer — non-negotiable. Even with scale rebasing keeping
//     the world inside eight decades, a linear depth buffer z-fights badly at
//     the far end of that band.
//   · emissive-and-bloom led. Almost nothing here is lit by a lamp; stars,
//     plasma and city lights emit. Bloom is the primary tonal tool, not a
//     garnish.
//   · no floor, no ground shadow, no environment map by default. A shadow plane
//     under a galaxy is nonsense, and an environment map costs fill rate that
//     the particle counts need.
//
// Anything a specific journey needs beyond this belongs in that journey's own
// files, never here. (Same rule as howitworks: the stage is shared, and shared
// things do not grow per-journey branches.)

export function createStage(container, options = {}) {
  const {
    bloom = { strength: 0.9, radius: 0.5, threshold: 0.0 },
    fog = null, // { color, density } — exponential, opt-in per journey
    background = 0x02030a,
    fov = 55,
  } = options;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  if (fog) scene.fog = new THREE.FogExp2(fog.color ?? background, fog.density ?? 0.0008);

  // The near/far pair spans the renderable world-unit band from rebase.js with
  // a margin at each end. Everything outside it is culled before it is built,
  // so this range never has to grow.
  const camera = new THREE.PerspectiveCamera(fov, 1, 1e-4, 1e6);
  camera.position.set(0, 0, 6);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    logarithmicDepthBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // CSS2D layer for distance/era callouts. pointer-events:none is load-bearing
  // — a full-viewport overlay that swallows the wheel would break page scroll,
  // which IS the journey's input device.
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.inset = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(labelRenderer.domElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    bloom.strength,
    bloom.radius,
    bloom.threshold,
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    labelRenderer.setSize(w, h);
    bloomPass.resolution.set(w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // --- frame loop ---------------------------------------------------------
  const ticks = new Set();
  const clock = new THREE.Clock();
  let raf = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    // The video exporter replaces the wall clock with a virtual one so renders
    // are deterministic and frame-rate independent (same contract as
    // howitworks' export-video.mjs — keep the global name identical).
    const dt = window.__vt ? window.__vtDelta ?? 1 / 60 : Math.min(clock.getDelta(), 0.1);
    for (const fn of ticks) fn(dt);
    composer.render();
    labelRenderer.render(scene, camera);
  }
  frame();

  return {
    scene,
    camera,
    renderer,
    composer,
    bloomPass,
    THREE,
    onTick(fn) {
      ticks.add(fn);
      return () => ticks.delete(fn);
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      ticks.clear();
      composer.dispose?.();
      renderer.dispose();
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
    },
  };
}
