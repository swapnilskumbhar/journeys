// Smart component highlighting — "never make the user search for the part
// being explained." Two tiers:
//
//  A) setFocusCallouts — UNIVERSAL, data-driven. A step declares
//     `focus: ['Piston', 'Spark plug']` and the matching callouts pulse (accent
//     glow, via the .callout--active CSS). No per-model plumbing: the player
//     calls this on every step activation. Keys match callout({key}) or its text.
//
//  B) pulseEmissive — OPT-IN, premium. Breathes a part's emissive so the stage
//     bloom turns it into a real glow. For a key part with its OWN material
//     (shared/ghost materials are skipped so a highlight can't bleed across the
//     whole frame). Returns a stop() that restores the original look.

export function setFocusCallouts(scene, keys) {
  const set = new Set(keys == null ? [] : Array.isArray(keys) ? keys : [keys]);
  scene.traverse((o) => {
    if (!o.isCSS2DObject || !o.element) return;
    const el = o.element;
    if (!el.classList.contains('callout')) return;
    el.classList.toggle('callout--active', set.has(el.dataset.key));
  });
}

// Guard: only pulse a material we won't disturb elsewhere. Skip if the same
// material instance is used by more than the target (shared) — a highlight must
// not light up unrelated parts.
function collectEmissiveTargets(root) {
  const meshes = [];
  root.traverse
    ? root.traverse((o) => o.isMesh && o.material?.emissive && meshes.push(o))
    : root.isMesh && root.material?.emissive && meshes.push(root);
  return meshes;
}

export function pulseEmissive(stage, target, { accent = 0x8fb4ff, speed = 3.2, strength = 1.3 } = {}) {
  const meshes = collectEmissiveTargets(target);
  if (!meshes.length) return () => {};
  const saved = meshes.map((m) => ({
    m,
    hex: m.material.emissive.getHex(),
    intensity: m.material.emissiveIntensity ?? 1,
  }));
  for (const { m } of saved) m.material.emissive.setHex(accent);
  let t = 0;
  const stopTick = stage.onTick((dt) => {
    t += dt;
    const k = Math.sin(t * speed) * 0.5 + 0.5; // 0..1 breathe
    for (const { m, intensity } of saved) m.material.emissiveIntensity = intensity + k * strength;
  });
  return () => {
    stopTick();
    for (const { m, hex, intensity } of saved) {
      m.material.emissive.setHex(hex);
      m.material.emissiveIntensity = intensity;
    }
  };
}
