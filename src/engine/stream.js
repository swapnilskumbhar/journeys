// Layer streaming. A journey declares many more layers than can exist at once;
// this mounts the ones near the current axis position and disposes the rest.
//
// howitworks builds its entire scene graph up front, which is correct for an
// eight-step mechanism and fatal for a 200-beat journey. The window is what
// makes journey length independent of frame cost.
//
// A layer is:
//   { id, from, to, build({ scene, THREE, rebase, kit }) -> { group?, update?, dispose? } }
// where from/to are u values. `update({ u, local, rebase, dt })` runs every
// frame while mounted; `local` is the layer's own 0→1 progress, which is what
// most content should animate against.

export function makeStreamer({ scene, THREE, rebase, kit, hysteresis = 0.04 }) {
  const mounted = new Map(); // id -> { layer, handle }

  function windowFor(layer, slack) {
    return { from: layer.from - slack, to: layer.to + slack };
  }

  function sync(u) {
    // mount anything entering the window
    for (const layer of sync.layers) {
      if (mounted.has(layer.id)) continue;
      const w = windowFor(layer, 0);
      if (u < w.from || u > w.to) continue;
      const handle = layer.build({ scene, THREE, rebase, kit }) ?? {};
      if (handle.group) scene.add(handle.group);
      mounted.set(layer.id, { layer, handle });
    }

    // dispose anything that has left the window PLUS hysteresis, so scrubbing
    // across a boundary doesn't rebuild the same layer every frame
    for (const [id, entry] of mounted) {
      const w = windowFor(entry.layer, hysteresis);
      if (u >= w.from && u <= w.to) continue;
      if (entry.handle.group) scene.remove(entry.handle.group);
      entry.handle.dispose?.();
      disposeTree(entry.handle.group);
      mounted.delete(id);
    }
  }

  sync.layers = [];

  return {
    setLayers(layers) {
      sync.layers = layers;
    },
    sync,
    update(u, dt) {
      for (const { layer, handle } of mounted.values()) {
        if (!handle.update) continue;
        const span = layer.to - layer.from || 1;
        const local = Math.max(0, Math.min(1, (u - layer.from) / span));
        handle.update({ u, local, rebase, dt });
      }
    },
    get size() {
      return mounted.size;
    },
    disposeAll() {
      for (const [, entry] of mounted) {
        if (entry.handle.group) scene.remove(entry.handle.group);
        entry.handle.dispose?.();
        disposeTree(entry.handle.group);
      }
      mounted.clear();
    },
  };
}

// Three.js does not free GPU memory on remove() — over a long journey that is a
// guaranteed leak, so every unmount walks the subtree.
function disposeTree(root) {
  if (!root) return;
  root.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const k of Object.keys(m)) {
        const v = m[k];
        if (v && v.isTexture) v.dispose();
      }
      m.dispose?.();
    }
  });
}
