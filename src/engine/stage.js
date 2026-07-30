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
    // A real light rig, opt-in per journey. OFF by default, because most of
    // what this stage draws is emissive — plasma, starfields, city lights — and
    // those need no lamp at all.
    //
    // But a journey with HARD SURFACES in it (a launch vehicle, a tower, a
    // lander) was being drawn with analytic lambert terms inside custom
    // shaders and no shadows anywhere, which is most of what "it looks
    // cartoonish" actually means. `castShadow` flags had been set on ten meshes
    // in kit/geometry.js since the port from howitworks and did nothing,
    // because no light and no shadow map ever existed here to honour them.
    //
    //   sun: { dir: [x, y, z], intensity, ambient, shadow: true|false, radius }
    //
    // `radius` is the half-extent of the shadow camera in WORLD UNITS, not
    // metres — the rebaser keeps everything inside a fixed unit band, so one
    // orthographic shadow camera sized to that band works at every scale from
    // a launch pad to a planet without ever being re-fitted.
    sun = null,
  } = options;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  if (fog) scene.fog = new THREE.FogExp2(fog.color ?? background, fog.density ?? 0.0008);

  let sunLight = null;
  if (sun) {
    const dir = sun.dir ?? [1, 0.6, 0.5];
    sunLight = new THREE.DirectionalLight(sun.color ?? 0xfff4e6, sun.intensity ?? 3.2);
    // Position is a DIRECTION scaled out: the light targets the origin, which is
    // where every journey puts its subject.
    sunLight.position.set(dir[0], dir[1], dir[2]).normalize().multiplyScalar(40);
    scene.add(sunLight, sunLight.target);
    if (sun.shadow !== false) {
      const r = sun.radius ?? 3.2;
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(2048, 2048);
      const c = sunLight.shadow.camera;
      c.left = -r; c.right = r; c.top = r; c.bottom = -r;
      c.near = 1; c.far = 90;
      // Without a bias, a self-shadowing cylinder acnes into stripes — which
      // reads as banding on the rocket rather than as shadow.
      sunLight.shadow.bias = -0.0008;
      sunLight.shadow.normalBias = 0.02;
      c.updateProjectionMatrix();
    }
    // A dim sky/ground fill so the unlit side is not pure black. In space the
    // fill is genuinely almost nothing, which is why it is this low — but zero
    // makes a curved hull read as a flat silhouette.
    scene.add(new THREE.HemisphereLight(sun.sky ?? 0x4a5a72, sun.ground ?? 0x14161c, sun.ambient ?? 0.5));
  }

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
  if (sun && sun.shadow !== false) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
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
