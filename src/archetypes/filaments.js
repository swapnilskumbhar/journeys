import * as THREE from 'three';
import { pointsMaterial, rng, gaussian } from './points-material.js';

// The cosmic web: matter is not scattered evenly, it hangs in sheets and
// filaments strung between dense nodes, with near-empty voids between. This is
// the single most recognisable large-scale structure in the universe and the
// visual payoff of the whole dark-ages-to-galaxies stretch.
//
// Built as nodes joined to their nearest neighbours, with galaxies seeded ALONG
// the connections rather than uniformly — that is what produces the stringy,
// beaded look instead of a fog. Rendered as points (same shared shader as
// particle-field) plus faint lines for the strands themselves.

export function filaments({
  nodes = 90,
  perStrand = 55,
  neighbours = 2,
  radiusMeters,
  jitterAlongStrand = 0.035,
  colorA = 0xdfe9ff,
  colorB = 0x5b7fd4,
  nodeColor = 0xfff2d0,
  size = 2.4,
  seed = 7,
  opacity = () => 1,
  strandOpacity = 0.16,
  spin = 0,
  respectBand = true, // see particle-field.js — same reason
} = {}) {
  const rand = rng(seed);

  // Node placement: uniform in the ball, then pushed slightly outward so the
  // centre is not denser than the rim (a plain cbrt fill looks like a blob).
  const N = [];
  for (let i = 0; i < nodes; i++) {
    const v = onSphere(rand);
    const r = 0.25 + Math.cbrt(rand()) * 0.75;
    N.push(new THREE.Vector3(v[0] * r, v[1] * r, v[2] * r));
  }

  // Connect each node to its k nearest — an O(n²) pass, fine at these counts
  // and it produces a far more web-like graph than random pairing.
  const edges = [];
  const seen = new Set();
  for (let i = 0; i < N.length; i++) {
    const order = N.map((p, j) => [j, N[i].distanceTo(p)])
      .filter(([j]) => j !== i)
      .sort((a, b) => a[1] - b[1])
      .slice(0, neighbours);
    for (const [j] of order) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([i, j]);
    }
  }

  const count = edges.length * perStrand + N.length;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const scales = new Float32Array(count);

  const cA = new THREE.Color(colorA);
  const cB = new THREE.Color(colorB);
  const cN = new THREE.Color(nodeColor);
  const tmp = new THREE.Color();
  let k = 0;

  const put = (p, c, scale) => {
    pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    seeds[k] = rand();
    scales[k] = scale;
    k++;
  };

  const tmpV = new THREE.Vector3();
  for (const [i, j] of edges) {
    for (let s = 0; s < perStrand; s++) {
      // beta-ish bias toward the endpoints: matter piles up at the nodes
      const raw = rand();
      const t = raw < 0.5 ? 0.5 * (2 * raw) ** 1.6 : 1 - 0.5 * (2 * (1 - raw)) ** 1.6;
      tmpV.copy(N[i]).lerp(N[j], t);
      tmpV.x += gaussian(rand) * jitterAlongStrand;
      tmpV.y += gaussian(rand) * jitterAlongStrand;
      tmpV.z += gaussian(rand) * jitterAlongStrand;
      tmp.copy(cA).lerp(cB, rand());
      put(tmpV, tmp, 0.5 + rand() ** 2 * 1.4);
    }
  }
  for (const n of N) put(n, cN, 2.4 + rand() * 2.0);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);

  const mat = pointsMaterial({ size, maxSize: 14, twinkle: 0.18 });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  // Faint strand lines under the beads — they read as the gas bridging the
  // galaxies and stop sparse strands looking like random noise.
  const lp = new Float32Array(edges.length * 6);
  edges.forEach(([i, j], e) => {
    lp.set([N[i].x, N[i].y, N[i].z, N[j].x, N[j].y, N[j].z], e * 6);
  });
  const lgeo = new THREE.BufferGeometry();
  lgeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const lmat = new THREE.LineBasicMaterial({
    color: 0x2c4a86,
    transparent: true,
    opacity: strandOpacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(lgeo, lmat);
  lines.frustumCulled = false;

  const group = new THREE.Group();
  group.add(lines, points);

  return {
    group,
    update({ u, local, rebase, t }) {
      const meters = typeof radiusMeters === 'function'
        ? radiusMeters({ u, local, rebase })
        : radiusMeters ?? rebase.frameMeters();
      group.scale.setScalar(rebase.toWorld(meters));
      if (spin) group.rotation.y = t * spin;
      const o = opacity({ u, local, rebase }) * (respectBand ? rebase.weight(meters) : 1);
      mat.uniforms.uTime.value = t;
      mat.uniforms.uOpacity.value = o;
      lmat.opacity = strandOpacity * o;
      group.visible = o > 0.002;
    },
    dispose() {
      geo.dispose(); mat.dispose();
      lgeo.dispose(); lmat.dispose();
    },
  };
}

function onSphere(rand) {
  let a, b, s;
  do {
    a = rand() * 2 - 1;
    b = rand() * 2 - 1;
    s = a * a + b * b;
  } while (s >= 1 || s === 0);
  const f = 2 * Math.sqrt(1 - s);
  return [a * f, b * f, 1 - 2 * s];
}
