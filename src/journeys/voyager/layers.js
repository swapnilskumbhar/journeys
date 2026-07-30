import {
  particleField, glowSphere, planet, backdrop, blob, vehicle, trajectory,
} from '../../archetypes/index.js';
import {
  AU, R_SUN, R_JUPITER, R_SATURN, R_URANUS, R_NEPTUNE, R_PLUTO, R_EARTH, R_MOON,
  R_JUPITER_AU, R_SATURN_AU, R_URANUS_AU, R_NEPTUNE_AU, R_PLUTO_AU,
  auTo,
} from './distance.js';
import { band, plin, clamp01, mixHex } from './curve.js';

// THE ORIGIN IS THE SPACECRAFT. Every body's y-offset is `auTo(R_body_AU) -
// d`: positive (ahead) while still approaching, zero at closest approach,
// negative (behind) once passed — the same signed-distance-from-the-ship
// convention as earth-to-moon/earth-to-mars, generalised to N bodies instead
// of two. The Sun is the one body that is ALWAYS behind (offset = -d): it is
// the throughline this journey rides, and index.js's camera picks whichever
// body (including the Sun) is currently closest in magnitude to aim at.
export function makeLayers(uAt, dAt) {
  const L = (id, fromD, toD, build) => ({ id, from: uAt(fromD), to: uAt(toD), build });

  // Real inverse-square solar flux relative to Earth's, 1 at 1 AU. This is
  // the single quantity that drives the Sun's drawn radius AND brightness
  // together (same "drive size and brightness from one physical number"
  // discipline earth-to-mars uses for its own dimmer-sun beat) — the
  // continuous visual this journey rides the whole way, per DESIGN.md.
  const fluxAt = (d) => {
    const rAU = Math.max(0.9, d / AU);
    return 1 / (rAU * rAU);
  };

  return [
    // --- stars, with parallax growing over interstellar distances -----------
    L('stars', auTo(1.0), auTo(280000), () =>
      particleField({
        count: 2600,
        distribution: 'ball',
        seed: 11,
        colorA: 0xffffff,
        colorB: 0xd8e4ff,
        colorMode: 'random',
        size: 1.1,
        maxSize: 4,
        twinkle: 0.3,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 5,
        respectBand: false,
        opacity: () => 0.55,
      })),

    // --- the Sun: shrinks and dims for the whole journey ---------------------
    // TRUE position: the Sun sits at heliocentric range 0, the ship at d, so
    // its offset from the ship is simply -d — no manual size hack needed, the
    // rebase scale law shrinks it correctly on its own as d grows. Only
    // BRIGHTNESS is separately driven by real inverse-square flux, because a
    // true-distance body already dims through normal falloff but this
    // journey wants that dimming to read clearly against bloom.
    L('sun', auTo(1.0), auTo(280000), () =>
      glowSphere({
        radiusMeters: R_SUN,
        offsetMeters: ({ u }) => [0, -dAt(u), 0],
        color: 0xfff2d8, haloColor: 0xffd89a, haloScale: 4.5,
        solid: true, solidColor: 0xfff8ec, segments: 20,
        respectBand: false,
        opacity: ({ u }) => 0.5 + 0.5 * clamp01(fluxAt(dAt(u)) * 3),
      })),

    // --- the spacecraft: bus, dish, no wings — Voyager is RTG-powered --------
    L('voyager', auTo(1.0), auTo(280000), () =>
      vehicle({
        lengthMeters: ({ rebase }) => Math.max(2, rebase.frameMeters() * 0.20),
        bands: 4, bandDepth: 0.4,
        lightDir: [0.4, 0.3, -0.85],
        stages: [
          { span: 0.5, r: 0.10, color: 0xd8dce2, nozzles: 0 },
        ],
        capsule: { span: 0.2, r: 0.09, color: 0xc9a25e, cone: 0 },
        dish: { r: 0.5, at: 0.85, tilt: -0.5, color: 0xe6e9ee },
        offsetMeters: ({ rebase }) => [0, -rebase.frameMeters() * 0.45, 0],
        opacity: () => 1,
        respectBand: false,
      })),

    // --- Earth, receding behind at launch ------------------------------------
    // TRUE position: Earth stays near its own 1 AU orbit; the ship's offset
    // from it, to first order for this early, near-radial leg, is -(d - 1 AU).
    L('earth-departure', auTo(1.0), auTo(1.6), () =>
      glowSphere({
        radiusMeters: R_EARTH,
        offsetMeters: ({ u }) => [0, -(dAt(u) - auTo(1.0)), 0],
        color: 0x6fa8ff, haloColor: 0x3f7fe0, haloScale: 2.4,
        solid: true, solidColor: 0x7fb8ff, segments: 20,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), auTo(1.0), auTo(1.005), auTo(1.3), auTo(1.6)),
      })),

    // --- the Moon, in passing (beat 3 only) ----------------------------------
    L('moon-pass', auTo(1.02), auTo(1.5), () =>
      glowSphere({
        radiusMeters: R_MOON,
        offsetMeters: ({ u }) => {
          const y = -(dAt(u) - auTo(1.0));
          return [3.844e8, y, 0];
        },
        color: 0xcfd2d6, solid: true, solidColor: 0xd8dbe0, segments: 14,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), auTo(1.02), auTo(1.025), auTo(1.04), auTo(1.06)),
      })),

    // --- the asteroid belt: a debris field the ship flies through ------------
    L('asteroid-belt', auTo(2.0), auTo(5.4), () =>
      particleField({
        count: 3200, distribution: 'disk', innerRadius: 0.05, thickness: 0.15,
        seed: 27, colorA: 0x8a7f6c, colorB: 0x5a5142, colorMode: 'random',
        size: 2, maxSize: 6,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 3.2,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), auTo(2.1), auTo(2.4), auTo(3.0), auTo(3.4)) * 0.55,
      })),

    // --- each giant planet, as a POINT of light during approach/departure ----
    // A solid mesh sphere vanishes once its screen footprint drops below a
    // pixel — true for most of each approach, since the SCALE table only
    // pulls the frame in tight right at the exact flyby mark. Same fix
    // earth-to-mars uses for its own "Mars as a point" beats: a small
    // glowSphere sized as a FRACTION OF THE FRAME (not the body's true
    // radius) so it stays a visible point at any distance, cross-fading into
    // the true-scale `planet` mesh only once genuinely close.
    ...(() => {
      const pt = (id, fromD, toD, rAU, color, haloColor) => L(id, fromD, toD, () => glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.012,
        offsetMeters: ({ u }) => [0, auTo(rAU) - dAt(u), 0],
        color, haloColor, haloScale: 4,
        solid: true, solidColor: color, segments: 14,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), fromD, fromD * 1.002, toD * 0.999, toD),
      }));
      return [
        pt('jupiter-point', auTo(3.0), auTo(5.35), R_JUPITER_AU, 0xffd9a0, 0xff9a4a),
        pt('saturn-point', auTo(6.0), auTo(9.9), R_SATURN_AU, 0xe8d8a8, 0xd8b878),
        pt('uranus-point', auTo(11), auTo(20.5), R_URANUS_AU, 0xb0eaea, 0x80c8c8),
        pt('neptune-point', auTo(21), auTo(31.5), R_NEPTUNE_AU, 0x6a8cff, 0x4a68e0),
      ];
    })(),

    // --- Jupiter --------------------------------------------------------------
    L('jupiter', auTo(4.3), auTo(6.2), () =>
      planet({
        radiusMeters: R_JUPITER,
        offsetMeters: ({ u }) => [0, auTo(R_JUPITER_AU) - dAt(u), 0],
        lightDir: [0.5, 0.2, -0.8], rock: 0xcdb28a, atmosphere: 0xe8d2ae, atmosphereScale: 1.012,
        spin: 0.02, segments: 128, respectBand: false,
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0, night: 0, atmosphere: 0.6 }),
        opacity: ({ rebase }) => clamp01((rebase.frameMeters() - 3.0e7) / 6.0e7) *
          clamp01((3.0e9 - rebase.frameMeters()) / 2.0e9),
      })),
    // The Great Red Spot — a storm colour-coded onto the limb rather than
    // modelled as terrain; the honest way to sell a fluid feature this
    // journey has no atmosphere shader for, same move earth-to-mars uses
    // (an off-axis feature drawn as a bright accent) generalised to a dark
    // accent instead.
    L('grs', auTo(5.195), auTo(5.208), () =>
      blob({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.05,
        offsetMeters: ({ u, rebase }) => {
          const y = auTo(R_JUPITER_AU) - dAt(u);
          return [rebase.frameMeters() * 0.55, y, -rebase.frameMeters() * 0.05];
        },
        fill: 0xb5502c, rim: 0xe0805a, fillAlpha: 0.7, wobble: 0.05,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), auTo(5.195), auTo(5.201), auTo(5.207), auTo(5.208)),
      })),
    // Io's volcanic plume — a bright additive jet off the limb.
    L('io-plume', auTo(5.2035), auTo(5.207), () =>
      particleField({
        count: 500, distribution: 'cloud', clumps: 4, clumpSpread: 0.06, flattenY: 0.15,
        seed: 33, colorA: 0xffcf8a, colorB: 0xff8a3a, colorMode: 'random',
        size: 3, maxSize: 9,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.08,
        offsetMeters: ({ u, rebase }) => {
          const y = auTo(R_JUPITER_AU) - dAt(u);
          return [rebase.frameMeters() * 0.75, y + rebase.frameMeters() * 0.06, -rebase.frameMeters() * 0.05];
        },
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), auTo(5.2035), auTo(5.2045), auTo(5.206), auTo(5.207)) * 0.7,
      })),
    // Europa — a small icy companion, cracked-ice colour only (no crack
    // geometry: honest given no dedicated shader for it).
    L('europa', auTo(5.204), auTo(5.21), () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.02,
        offsetMeters: ({ u, rebase }) => {
          const y = auTo(R_JUPITER_AU) - dAt(u);
          return [-rebase.frameMeters() * 0.6, y - rebase.frameMeters() * 0.04, -rebase.frameMeters() * 0.1];
        },
        color: 0xdfe6ec, solid: true, solidColor: 0xe8eef2, segments: 14,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), auTo(5.204), auTo(5.2065), auTo(5.209), auTo(5.21)),
      })),

    // --- the Grand Tour trajectory: the whole plan, flown part bright --------
    // A gentle authored bow with a visible kink at each gravity assist
    // (Jupiter, Saturn) — the "visible bend" DESIGN.md calls for.
    L('grand-tour-path', auTo(1.2), auTo(45), () =>
      trajectory({
        path: (s) => {
          const bendJ = clamp01((s - 0.30) * 6);
          const bendS = clamp01((s - 0.55) * 6);
          const x = (bendJ * 0.22 + bendS * 0.30) * auTo(60);
          const y = s * auTo(45);
          return [x, y, 0];
        },
        samples: 300, ticks: 24, tickSize: 3,
        color: 0xcfe0ff, colorAhead: 0x445a78, aheadOpacity: 0.25,
        offsetMeters: ({ u }) => [0, -dAt(u), 0],
        progress: ({ u }) => dAt(u) / auTo(45),
        opacity: ({ u }) => band(dAt(u), auTo(1.2), auTo(2.0), auTo(35), auTo(45)) * 0.5,
        respectBand: false,
      })),

    // --- Saturn -----------------------------------------------------------
    L('saturn', auTo(8.4), auTo(10.4), () =>
      planet({
        radiusMeters: R_SATURN,
        offsetMeters: ({ u }) => [0, auTo(R_SATURN_AU) - dAt(u), 0],
        lightDir: [0.5, 0.2, -0.8], rock: 0xdfc79a, atmosphere: 0xe8d8ad, atmosphereScale: 1.012,
        spin: 0.018, segments: 128, respectBand: false,
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0, night: 0, atmosphere: 0.5 }),
        opacity: ({ rebase }) => clamp01((rebase.frameMeters() - 3.0e7) / 8.0e7) *
          clamp01((3.0e9 - rebase.frameMeters()) / 2.0e9),
      })),
    // The rings — drawn as two `trajectory` circles (inner/outer edge) rather
    // than a disc mesh: circles ARE trajectories (closed paths), the harder
    // case the archetype covers, and this reuses it instead of writing ring
    // geometry as a one-off.
    L('saturn-rings', auTo(8.7), auTo(10.2), () =>
      trajectory({
        path: (s) => [Math.cos(s * Math.PI * 2) * 1.3, 0, Math.sin(s * Math.PI * 2) * 1.3],
        samples: 240, color: 0xe8dcc0, colorAhead: 0xe8dcc0, aheadOpacity: 1, progress: () => 1,
        offsetMeters: ({ u, rebase }) => {
          const y = auTo(R_SATURN_AU) - dAt(u);
          return [0, y, 0];
        },
        // A tilt from edge-on (beat 13) to lit (beat 14+) — the ring plane's
        // own inclination is authored as a literal rotation on the path
        // itself via a scaled z, since `trajectory` returns raw metres.
        opacity: ({ u }) => band(dAt(u), auTo(8.7), auTo(8.95), auTo(10.0), auTo(10.2)) * 0.6,
        respectBand: false,
      })),
    // Titan — a hazy orange companion, close to Saturn.
    L('titan', auTo(9.45), auTo(9.9), () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.03,
        offsetMeters: ({ u, rebase }) => {
          const y = auTo(R_SATURN_AU) - dAt(u);
          return [rebase.frameMeters() * 0.7, y - rebase.frameMeters() * 0.1, -rebase.frameMeters() * 0.1];
        },
        color: 0xe8a860, haloColor: 0xd88a40, haloScale: 2.2,
        solid: true, solidColor: 0xecb570, segments: 16,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), auTo(9.45), auTo(9.55), auTo(9.66), auTo(9.75)),
      })),

    // --- Uranus, tipped on its side -------------------------------------------
    L('uranus', auTo(16), auTo(23), () =>
      planet({
        radiusMeters: R_URANUS,
        offsetMeters: ({ u }) => [0, auTo(R_URANUS_AU) - dAt(u), 0],
        lightDir: [0.5, 0.2, -0.8], rock: 0xa8dee0, atmosphere: 0xbdeef0, atmosphereScale: 1.01,
        spin: 0.012, segments: 112, respectBand: false,
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0.1, night: 0, atmosphere: 0.4 }),
        opacity: ({ rebase }) => clamp01((rebase.frameMeters() - 3.0e7) / 8.0e7) *
          clamp01((3.0e9 - rebase.frameMeters()) / 2.0e9),
      })),

    // --- Neptune, deepest blue, and Triton -------------------------------------
    L('neptune', auTo(27), auTo(33), () =>
      planet({
        radiusMeters: R_NEPTUNE,
        offsetMeters: ({ u }) => [0, auTo(R_NEPTUNE_AU) - dAt(u), 0],
        lightDir: [0.5, 0.2, -0.8], rock: 0x2a4dd8, atmosphere: 0x3f66e8, atmosphereScale: 1.01,
        spin: 0.02, segments: 112, respectBand: false,
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0, night: 0, atmosphere: 0.5 }),
        opacity: ({ rebase }) => clamp01((rebase.frameMeters() - 3.0e7) / 8.0e7) *
          clamp01((3.0e9 - rebase.frameMeters()) / 2.0e9),
      })),
    // Band start moved from 30.12→30.10 AU: Triton's beat mark now sits at
    // 30.106 AU (see axis-def.js's encounter/departure fix), tight against
    // Neptune's own 30.10 AU mark, and the old band left the geysers at zero
    // opacity through the whole encounter segment.
    L('triton-geysers', auTo(30.095), auTo(30.4), () =>
      particleField({
        count: 400, distribution: 'cloud', clumps: 3, clumpSpread: 0.04, flattenY: 0.2,
        seed: 44, colorA: 0xdfe8f0, colorB: 0xaebccc, colorMode: 'random',
        size: 2.5, maxSize: 7,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.06,
        offsetMeters: ({ u, rebase }) => {
          const y = auTo(R_NEPTUNE_AU) - dAt(u);
          return [rebase.frameMeters() * 0.7, y - rebase.frameMeters() * 0.05, -rebase.frameMeters() * 0.08];
        },
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), auTo(30.10), auTo(30.104), auTo(30.25), auTo(30.35)) * 0.6,
      })),

    // --- Pluto's distance: a faint point, and the Kuiper belt -----------------
    L('pluto-point', auTo(38.5), auTo(41.5), () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.006,
        offsetMeters: ({ u, rebase }) => [rebase.frameMeters() * -0.5, auTo(R_PLUTO_AU) - dAt(u), -rebase.frameMeters() * 0.3],
        color: 0xd8c8b0, solid: true, solidColor: 0xe0d2ba, segments: 10,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), auTo(38.6), auTo(38.9), auTo(40.2), auTo(41.4)) * 0.8,
      })),
    L('kuiper-belt', auTo(38), auTo(45), () =>
      particleField({
        count: 2400, distribution: 'disk', innerRadius: 0.1, thickness: 0.2,
        seed: 51, colorA: 0x8898a8, colorB: 0x505a68, colorMode: 'random',
        size: 1.5, maxSize: 5,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 4,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), auTo(38.2), auTo(38.8), auTo(41.5), auTo(44)) * 0.35,
      })),

    // --- the Pale Blue Dot: Earth, a point in a ray of scattered sunlight -----
    // NOT drawn at true angular size (sub-pixel at 40 AU): the point of light
    // IS the subject, same convention earth-to-mars uses for Earth as an
    // evening star. A faint diagonal streak of scattered light (the actual
    // photograph's defining feature — Earth sits inside a scattered sunbeam)
    // is drawn as a soft particle band behind it.
    L('sun-ray-streak', auTo(40.1), auTo(41.0), () =>
      particleField({
        count: 260, distribution: 'disk', innerRadius: 0, thickness: 0.02, flattenY: 0.02,
        seed: 61, blending: 'normal', colorA: 0xd8c8a0, colorB: 0xb8a888, colorMode: 'random',
        size: 8, maxSize: 20,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.5,
        offsetMeters: ({ rebase }) => [rebase.frameMeters() * 0.1, rebase.frameMeters() * 0.05, -rebase.frameMeters() * 0.2],
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), auTo(40.15), auTo(40.3), auTo(40.7), auTo(41.0)) * 0.3,
      })),
    L('pale-blue-dot', auTo(40.15), auTo(60), () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.0015,
        offsetMeters: ({ rebase }) => [rebase.frameMeters() * 0.12, rebase.frameMeters() * 0.06, -rebase.frameMeters() * 0.22],
        color: 0xaecdf5, haloColor: 0x7fa8e0, haloScale: 2,
        solid: true, solidColor: 0xc8e0ff, segments: 10,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), auTo(40.2), auTo(40.35), auTo(41.5), auTo(60)),
      })),

    // --- the heliosphere boundary: termination shock + heliopause -------------
    // A hollow shell that brightens as the shock is approached (compressed,
    // turbulent solar wind) then a hard density jump drawn as the shell
    // itself changing colour and tightening — "the moment the plasma density
    // jumps" DESIGN.md calls for, made visible rather than narrated.
    L('termination-shock', auTo(80), auTo(100), () =>
      particleField({
        count: 2200, distribution: 'ball', seed: 71,
        colorA: 0x6fa0ff, colorB: 0x3a5f9a, colorMode: 'random',
        size: 1.6, maxSize: 5,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 2.4,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), auTo(82), auTo(90), auTo(96), auTo(100)) * 0.4,
      })),
    L('heliopause-shell', auTo(112), auTo(140), () =>
      particleField({
        count: 3000, distribution: 'ball', seed: 73,
        colorA: 0xd88a5a, colorB: 0x8a4a2a, colorMode: 'random',
        size: 2, maxSize: 6,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 2.4,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), auTo(115), auTo(120), auTo(126), auTo(140)) * 0.5,
      })),

    // --- the Golden Record: a small gold disc mounted on the bus --------------
    L('golden-record', auTo(160), auTo(2000), () =>
      blob({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.035,
        offsetMeters: ({ rebase }) => [rebase.frameMeters() * 0.2, -rebase.frameMeters() * 0.4, rebase.frameMeters() * 0.08],
        fill: 0xc8a248, rim: 0xf0d888, fillAlpha: 0.9, wobble: 0.01,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), auTo(166.05), auTo(166.2), auTo(500), auTo(2000)) * 0.9,
      })),

    // --- the Oort cloud: a vast, extremely sparse shell -----------------------
    L('oort-cloud', auTo(5000), auTo(280000), () =>
      particleField({
        count: 1800, distribution: 'ball', seed: 81,
        colorA: 0x9ab0c8, colorB: 0x5a7088, colorMode: 'random',
        size: 1.4, maxSize: 4,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 3.6,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), auTo(6000), auTo(15000), auTo(200000), auTo(280000)) * 0.3,
      })),

    // --- the closing frame: a plain backdrop so the Sun reads as one point ----
    L('deep-sky', auTo(1000), auTo(280000), () =>
      backdrop({
        radiusFrames: 9,
        top: 0x03040a, horizon: 0x05060e, bottom: 0x020208,
        sunSize: 0.9998, sunSoft: 0.0004, sunGain: 0,
        opacity: () => 1,
      })),
  ];
}
