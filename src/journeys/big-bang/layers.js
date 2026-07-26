import { particleField, glowSphere, filaments, planet } from '../../archetypes/index.js';
import { AGE, YR, ago, after } from './time.js';
import { band, plin, plog, smooth, clamp01 } from './curve.js';

// The visual stack. Every entry is an archetype plus parameters — no bespoke
// Three.js anywhere in this file, which is rule 2 doing its job.
//
// Layers are bounded by REAL TIMES converted through `uAt`, so re-pacing the
// axis (changing a segment weight) moves the visuals with the story instead of
// desynchronising them. Bounds overlap generously: two adjacent layers
// cross-fade through their `band` envelopes, and the streamer keeps both
// mounted through the overlap.

export function makeLayers(uAt, tAt) {
  // years-before-present at a given u — the natural unit for the Earth phase
  const yaAt = (u) => (AGE - tAt(u)) / YR;

  const L = (id, fromT, toT, build) => ({ id, from: uAt(fromT), to: uAt(toT), build });

  return [
    // --- the first instants ------------------------------------------------
    // The initial point, shrinking against a frame that is inflating around it.
    // Sized as a FRACTION of the frame rather than pinned in metres: the scale
    // law covers 33 decades in the first 12% of the scroll, so anything with a
    // fixed metre size is sub-pixel before the first beat has finished being
    // read. The shrink still reads as expansion, and stays on screen.
    L('singularity', 1e-44, 1e-26, () =>
      glowSphere({
        radiusMeters: ({ local, rebase }) =>
          rebase.frameMeters() * plin([[0, 0.30], [0.55, 0.06], [1, 0.012]], local),
        color: 0xfff4e2,
        haloColor: 0xffc888,
        haloScale: 5,
        opacity: ({ local }) => band(local, 0, 0.015, 0.45, 0.82) * 0.9,
      })),

    // Inflation: a shell sweeping outward through a frame that is itself
    // inflating, so it leaves the field of view fast.
    L('inflation', 1e-38, 1e-24, () =>
      particleField({
        count: 9000,
        distribution: 'shell',
        seed: 11,
        colorA: 0xfff0d8,
        colorB: 0xff9a4a,
        colorMode: 'random',
        size: 2.4,
        maxSize: 9,
        twinkle: 0.25,
        radiusMeters: ({ local, rebase }) => rebase.frameMeters() * (0.05 + smooth(local) * 1.5),
        opacity: ({ local }) => band(local, 0.02, 0.12, 0.4, 0.72) * 0.8,
      })),

    // --- the hot soup ------------------------------------------------------
    L('quark-soup', 1e-36, 1e-3, () =>
      particleField({
        count: 24000,
        distribution: 'ball',
        seed: 3,
        colorA: 0xffffff,
        colorB: 0x9ecbff,
        size: 1.9,
        maxSize: 8,
        jitter: 0.02,
        twinkle: 0.3,
        // Held INSIDE the camera distance (~5 units) so the soup reads as a
        // luminous body seen from outside. Filling the frame instead put the
        // camera inside 24,000 additive sprites, which is physically true and
        // visually a white rectangle.
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.72,
        // Holds longer than it looks like it should: this layer spans 33
        // decades, so an early fade-out leaves the electroweak beat at 1e-12 s
        // sitting in the tail of the ramp with nothing else mounted yet.
        opacity: ({ local }) => band(local, 0.06, 0.18, 0.78, 0.96) * 0.55,
      })),

    // Confinement: fewer, heavier, cooler objects. The count drop from 24k to
    // 9k across the cross-fade is the visual of quarks binding into threes.
    L('hadrons', 1e-8, 1e4, () =>
      particleField({
        count: 9000,
        distribution: 'ball',
        seed: 5,
        colorA: 0xfff0cc,
        colorB: 0xff7a3c,
        size: 3.2,
        maxSize: 10,
        jitter: 0.012,
        twinkle: 0.2,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.7,
        opacity: ({ local }) => band(local, 0.05, 0.22, 0.6, 0.9) * 0.6,
      })),

    // Nucleosynthesis: clumped, not uniform — nuclei, not free particles.
    L('nuclei', 0.2, 1e8, () =>
      particleField({
        count: 7000,
        distribution: 'cloud',
        clumps: 260,
        clumpSpread: 0.035,
        seed: 17,
        colorA: 0xfff6dd,
        colorB: 0xffb066,
        size: 3.6,
        maxSize: 11,
        twinkle: 0.18,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.68,
        opacity: ({ local }) => band(local, 0.04, 0.18, 0.55, 0.85) * 0.7,
      })),

    // --- the opaque era ----------------------------------------------------
    // Two overlapping fields, hot cross-fading into cool, is how the plasma
    // cools without needing per-particle colour animation.
    L('plasma-hot', 1e2, 4e12, () =>
      particleField({
        count: 20000,
        distribution: 'ball',
        seed: 23,
        colorA: 0xfff2e0,
        colorB: 0xff8a3a,
        size: 4.2,
        maxSize: 12,
        jitter: 0.006,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.74,
        opacity: ({ local }) => band(local, 0, 0.15, 0.55, 0.95) * 0.5,
      })),
    L('plasma-cool', 1e9, 1.6e13, () =>
      particleField({
        count: 16000,
        distribution: 'ball',
        seed: 29,
        colorA: 0xff7a4a,
        colorB: 0x8e2a2a,
        size: 5.0,
        maxSize: 13,
        jitter: 0.004,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.74,
        opacity: ({ local }) => band(local, 0.05, 0.35, 0.62, 0.92) * 0.55,
      })),
    L('fireball-glow', 1e2, 1.4e13, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.55,
        color: 0xff9a5c,
        haloScale: 1.7,
        opacity: ({ local }) => band(local, 0, 0.12, 0.6, 0.9) * 0.22,
      })),

    // Recombination: one flash as the fog clears and the light leaves.
    L('recombination-flash', 6e12, 4e13, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.35,
        color: 0xffffff,
        haloColor: 0xffe9c8,
        haloScale: 9,
        opacity: ({ local }) => band(local, 0.18, 0.3, 0.34, 0.62) * 0.5,
      })),

    // The last-scattering surface, seen from inside — which is where we are.
    // Random hot/cold colouring is the CMB's famous mottling; the real
    // anisotropy is 1 part in 100,000, exaggerated here as every published map
    // of it also does.
    L('cmb-shell', 8e12, 6e14, () =>
      particleField({
        count: 30000,
        distribution: 'shell',
        seed: 41,
        colorA: 0xff7a5a,
        colorB: 0x5f8cff,
        colorMode: 'random',
        size: 6.0,
        maxSize: 11,
        // Deliberately WIDER than the camera distance, so the last-scattering
        // surface wraps around the viewer — which is the honest geometry. We
        // are inside this sphere and always will be; it is the wall at the edge
        // of the observable universe in every direction.
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 1.7,
        opacity: ({ local }) => band(local, 0.22, 0.34, 0.55, 0.85) * 0.7,
      })),

    // --- dark ages ---------------------------------------------------------
    L('dark-ages', 3e13, 4e16, () =>
      particleField({
        count: 12000,
        distribution: 'cloud',
        clumps: 30,
        clumpSpread: 0.2,
        seed: 53,
        colorA: 0x22375f,
        colorB: 0x0d1730,
        size: 9,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 1.3,
        opacity: ({ local }) => band(local, 0.05, 0.25, 0.6, 0.95) * 0.8,
      })),

    // --- structure ---------------------------------------------------------
    L('first-stars', 1.5e15, 8e16, () =>
      particleField({
        count: 1400,
        distribution: 'cloud',
        clumps: 40,
        clumpSpread: 0.11,
        seed: 61,
        colorA: 0xffffff,
        colorB: 0x9fc4ff,
        size: 5.5,
        twinkle: 0.4,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 1.2,
        opacity: ({ local }) => band(local, 0.05, 0.28, 0.7, 1),
      })),

    L('cosmic-web', 1.2e16, 2.88e17, () =>
      filaments({
        nodes: 110,
        perStrand: 60,
        neighbours: 2,
        seed: 71,
        size: 3.0,
        spin: 0.008,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 1.05,
        opacity: ({ local }) => band(local, 0.04, 0.22, 0.72, 0.98),
      })),

    // A persistent faint backdrop so nothing after first light sits in a void.
    // Pinned at 3× the frame, so it is always "far away" whatever the scale.
    // Sparse and small on purpose. At 4,200 points inside three frame-widths
    // the backdrop read as falling confetti and competed with the subject —
    // a starfield's job is depth, not texture.
    L('starfield', 1e15, AGE, () =>
      particleField({
        count: 1700,
        distribution: 'ball',
        seed: 83,
        colorA: 0xffffff,
        colorB: 0x8fa8d8,
        colorMode: 'random',
        size: 1.15,
        maxSize: 4,
        twinkle: 0.5,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 4,
        opacity: ({ local }) => band(local, 0, 0.06) * 0.45,
      })),

    // --- the Milky Way -----------------------------------------------------
    // Real size: the disc is about 100,000 light years across, ~9.5e20 m.
    // Fixed in metres, so the dive through 12 decades of scale genuinely
    // approaches it rather than faking a zoom.
    L('milky-way', 2.70e17, 2.905e17, () =>
      particleField({
        count: 46000,
        distribution: 'disk',
        spiralArms: 2,
        spiralWinding: 4.1,
        armSpread: 0.19,
        thickness: 0.035,
        seed: 97,
        colorA: 0xfff0cf,
        colorB: 0x8fb8ff,
        size: 1.7,
        maxSize: 6,
        twinkle: 0.25,
        spin: 0.012,
        radiusMeters: 4.7e20, // ~100,000 light years across
        opacity: ({ local }) => band(local, 0.02, 0.18, 0.72, 0.94) * 0.55,
      })),
    L('milky-way-core', 2.70e17, 2.90e17, () =>
      glowSphere({
        radiusMeters: 3e19,
        color: 0xffd9a0,
        haloScale: 4,
        opacity: ({ local }) => band(local, 0.02, 0.18, 0.7, 0.92) * 0.45,
      })),

    // --- the solar system --------------------------------------------------
    // The protoplanetary disc: ~70 AU of gas and dust around the young Sun.
    L('protoplanetary', ago(4.63e9), ago(4.50e9), () =>
      particleField({
        count: 15000,
        distribution: 'disk',
        thickness: 0.05,
        seed: 103,
        colorA: 0xffdcae,
        colorB: 0x9a6a4a,
        size: 2.0,
        maxSize: 7,
        spin: 0.05,
        radiusMeters: 1.05e13, // ~70 AU
        // Wide range with a late fade; the rebaser's band check is what actually
        // removes it once the frame has zoomed inside.
        opacity: ({ local }) => band(local, 0.04, 0.15, 0.78, 0.96) * 0.5,
      })),
    // The bright inner disc, NOT the Sun's photosphere. At a frame 200 AU wide
    // the actual Sun is 0.005 AU across — a sub-pixel dot. Rendering the hot
    // inner region instead is both visible and true; a Sun scaled up to look
    // right here would be forty times too big.
    L('disc-core', ago(4.63e9), ago(4.50e9), () =>
      glowSphere({
        radiusMeters: 5e11,
        color: 0xfff2d0,
        haloColor: 0xffc46a,
        haloScale: 7,
        opacity: ({ local }) => band(local, 0.04, 0.15, 0.78, 0.96),
      })),

    // --- Earth -------------------------------------------------------------
    // One planet, driven through 4.5 billion years of surface history by
    // uniforms. Every drive below is written in years-before-present so it can
    // be checked against the beat it illustrates.
    L('earth', ago(4.55e9), AGE, () =>
      planet({
        radiusMeters: 6.371e6,
        // Aimed so the terminator crosses the visible disc rather than sitting
        // on the limb. A fully lit face hides the night side, and the night
        // side is where four billion years of the story pays off in one image:
        // city lights.
        lightDir: [0.78, 0.16, 0.6],
        atmosphere: 0x5fa8ff,
        spin: 0.035,
        opacity: ({ local }) => band(local, 0.0, 0.06),
        surface: ({ u }) => {
          const ya = yaAt(u);
          return {
            // Molten after accretion and the Moon-forming impact, crusting over
            // through the Hadean. Must be gone by the 4.4 Gyr "Oceans" beat —
            // a magma ocean and liquid water cannot share a frame.
            magma: plin([[4.55e9, 1], [4.47e9, 0.9], [4.42e9, 0.25], [4.38e9, 0]], ya),
            // a global ocean first; continents emerge and grow through the
            // Archean and Proterozoic
            seaLevel: plin([[4.4e9, 0.72], [2.5e9, 0.58], [6e8, 0.52], [0, 0.5]], ya),
            // land stays bare until plants colonise it ~470 Mya
            green: plin([[4.8e8, 0], [3.6e8, 0.55], [3e7, 0.9], [0, 0.85]], ya),
            // polar caps after the Great Oxidation and the Cryogenian
            ice: plin([[2.5e9, 0], [2.2e9, 0.35], [7e8, 0.75], [2e6, 0.55], [0, 0.5]], ya),
            // city lights, only in the final couple of centuries
            night: clamp01(plin([[300, 0], [120, 0.35], [40, 1]], ya)),
            atmosphere: plin([[4.5e9, 0.35], [4.3e9, 1]], ya),
          };
        },
      })),

    // The Moon, from the impact onward — real radius at a real distance, which
    // is why it is only on screen briefly. It formed roughly four Earth-radii
    // out and has been receding ever since (measured today, by laser, at
    // 3.8 cm/year); the frame is still 300,000 km wide at that moment, so the
    // true Earth–Moon system fits. As the scale law closes in on Earth the Moon
    // leaves the frame on its own, which is the honest thing for it to do
    // rather than parking it at a flattering fake distance.
    // Built from the planet archetype rather than a glowing sphere: an unlit
    // basic material renders as a flat grey disc, and the Moon sharing Earth's
    // light direction — same terminator, same angle — is most of what sells the
    // two of them as one system.
    L('moon', ago(4.515e9), ago(4.25e9), () =>
      planet({
        radiusMeters: 1.737e6,
        offsetMeters: ({ u }) => plog([[4.52e9, 2.4e7], [4.2e9, 4.2e7]], yaAt(u)),
        lightDir: [0.78, 0.16, 0.6],
        rock: 0x6e6a63,
        spin: 0.01,
        segments: 48,
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0, night: 0, atmosphere: 0 }),
        opacity: ({ local }) => band(local, 0.03, 0.14, 0.6, 0.95),
      })),
  ];
}
