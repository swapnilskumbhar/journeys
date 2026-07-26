import * as THREE from 'three';

// A luminous body: an optional solid core plus a camera-facing halo.
//
// Used for the singularity, the opaque primordial fireball, a Population III
// star, the young Sun. A billboarded sprite rather than a shader shell because
// a sprite stays circular and correctly sized from every angle, costs one quad,
// and — being additive under the stage's bloom — is what actually sells "this
// thing is emitting light" rather than "this thing is painted bright".

let haloTexture = null;

function getHaloTexture() {
  if (haloTexture) return haloTexture;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  // Four stops, not two: a linear falloff reads as a flat disc. The tight
  // white core plus a long tail is what makes it read as glare.
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.08, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.28, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.04)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  haloTexture = new THREE.CanvasTexture(c);
  haloTexture.colorSpace = THREE.SRGBColorSpace;
  return haloTexture;
}

export function glowSphere({
  radiusMeters,
  // Displacement from the journey's origin, in METRES — the only sanctioned
  // way to place a second body (a moon, a companion star, a spacecraft).
  // Number = distance along +x; array = a full offset; function = either,
  // evaluated per frame so real orbital recession can be animated.
  offsetMeters = null,
  color = 0xffffff,
  haloColor = null,
  haloScale = 4,
  solid = false,
  solidColor = null,
  opacity = () => 1,
  haloOpacity = () => 1,
  segments = 32,
  respectBand = true, // see particle-field.js — same reason
} = {}) {
  const group = new THREE.Group();

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getHaloTexture(),
      color: new THREE.Color(haloColor ?? color),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(sprite);

  let mesh = null;
  if (solid) {
    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, segments, segments / 2),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(solidColor ?? color),
        transparent: true,
      }),
    );
    group.add(mesh);
  }

  return {
    group,
    sprite,
    mesh,
    update({ u, local, rebase, t }) {
      const meters = typeof radiusMeters === 'function'
        ? radiusMeters({ u, local, rebase })
        : radiusMeters;
      const r = rebase.toWorld(meters);
      const w = respectBand ? rebase.weight(meters) : 1;
      const o = opacity({ u, local, rebase, t }) * w;
      const ho = haloOpacity({ u, local, rebase, t });

      if (offsetMeters !== null) {
        const raw = typeof offsetMeters === 'function'
          ? offsetMeters({ u, local, rebase, t })
          : offsetMeters;
        const [ox, oy, oz] = Array.isArray(raw) ? raw : [raw, 0, 0];
        group.position.set(rebase.toWorld(ox), rebase.toWorld(oy), rebase.toWorld(oz));
      }

      sprite.scale.setScalar(r * haloScale);
      sprite.material.opacity = Math.max(0, o * ho);
      sprite.visible = sprite.material.opacity > 0.002;

      if (mesh) {
        mesh.scale.setScalar(r);
        mesh.material.opacity = Math.max(0, o);
        mesh.visible = mesh.material.opacity > 0.002;
      }
    },
    dispose() {
      sprite.material.dispose();
      mesh?.geometry.dispose();
      mesh?.material.dispose();
    },
  };
}
