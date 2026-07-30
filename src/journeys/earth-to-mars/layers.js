import {
  particleField, glowSphere, planet, terrain, blocks, backdrop, silhouette,
  panel, vehicle, trajectory, blob, rocks,
} from '../../archetypes/index.js';
import { R_EARTH, R_MARS, MARS_D, AU, MARS_AU, walked } from './distance.js';
import { band, plin, clamp01, mixHex } from './curve.js';

// THE ORIGIN IS THE SPACECRAFT, same convention earth-to-moon establishes:
// Earth's centre sits at y = -(R_EARTH + d), Mars' centre at
// y = +(MARS_D - R_MARS - d), both derived from the axis value every frame.
// Azimuth is free for the same reason (both bodies lie ON the rotation axis)
// EXCEPT for the two subjects this journey adds that are deliberately NOT on
// that axis — the Sun during "a dimmer sun", and Earth during "an evening
// star" — which is exactly why LOOK_X and src/kit/camrig.js exist; see
// index.js and DESIGN.md §4.
export function makeLayers(uAt, dAt) {
  const L = (id, fromD, toD, build) => ({ id, from: uAt(fromD), to: uAt(toD), build });

  const frames = (rebase, lo, hi) => {
    const f = rebase.frameMeters();
    return clamp01((f - lo) / (lo * 0.8)) * clamp01((hi - f) / (hi * 0.35));
  };

  // Air fraction, same shape as earth-to-moon's — 1 at the pad, 0 by ~40 km.
  const airAt = (d) => clamp01(plin([[0, 1], [8e3, 0.9], [2.0e4, 0.45], [4.0e4, 0.06], [7e4, 0]], d));
  const skyAt = (d) => {
    const air = airAt(d);
    return {
      air,
      top: mixHex(0x02040a, 0x1d4f95, air),
      horizon: mixHex(0x05101f, 0xc08a52, air),
      bottom: mixHex(0x02040a, 0x1a1a20, air),
      bandLift: 0.12 + air * 0.5,
      sunGain: 0.25 + air * 0.5,
      light: mixHex(0xdfe8ff, 0xffc487, air),
      haze: mixHex(0x04060c, 0x8c7a68, air),
    };
  };

  // Altitude above Mars' surface. Negative once the walk begins.
  const marsAlt = (d) => MARS_D - d;
  const marsDrop = (d) => -Math.max(0, marsAlt(d));

  // Real solar flux ratio, 1/r² in AU, clamped so the pad and the ascent
  // (still effectively at Earth's distance) are not affected: this is the
  // quantity "a dimmer sun" is actually about, and it drives the Sun's drawn
  // size AND its brightness together, the same way vehicle.js drives plume
  // length/width/gain together rather than letting one drift alone.
  const fluxAt = (d) => {
    const rAU = clamp01(d / MARS_AU) * (MARS_AU / AU) + 1; // 1 at Earth, ~1.524 near Mars
    // Actually derive directly from distance travelled along a roughly radial
    // cruise: treat d (beyond 1 AU worth of travel) as pushing the Sun
    // distance from 1 AU toward 1.524 AU.
    const sunDistAU = 1 + clamp01((d - AU * 0.2) / (MARS_AU - AU * 0.2)) * (MARS_AU / AU - 1);
    return 1 / (sunDistAU * sunDistAU);
  };

  const SUN_DIR = [0.72, 0.12, 0.62]; // load-bearing +z, same reasoning as earth-to-moon

  return [
    // --- the sky over Florida ------------------------------------------------
    L('sky', 1, 2.2e5, () =>
      backdrop({
        radiusFrames: 8,
        sunDir: [0.82, 0.16, -0.42],
        sunSize: 0.9992,
        sunSoft: 0.006,
        drive: ({ u }) => {
          const s = skyAt(dAt(u));
          return { top: s.top, horizon: s.horizon, bottom: s.bottom, bandLift: s.bandLift, sunGain: s.sunGain };
        },
        opacity: ({ rebase }) => clamp01((8.0e4 - rebase.frameMeters()) / 5.5e4),
      })),

    L('stars', 1.0e4, walked(95), () =>
      particleField({
        count: 2200,
        distribution: 'ball',
        seed: 21,
        colorA: 0xffffff,
        colorB: 0xf0d8c0,
        colorMode: 'random',
        size: 1.2,
        maxSize: 4,
        twinkle: 0.35,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 4,
        opacity: ({ u }) => clamp01((dAt(u) - 1.2e4) / 2.4e4) * 0.5,
      })),

    // --- the pad ---------------------------------------------------------
    L('pad-ground', 1, 3.0e3, () =>
      terrain({
        radiusMeters: 2.5e3, ampMeters: 4, featureMeters: 220, flattenMeters: 700,
        seed: 8, rock: 0x3b3a36, dry: 0x5a5443, lightDir: [0.8, 0.4, -0.3],
        offsetMeters: ({ u }) => [0, -dAt(u), 0],
        surface: ({ u }) => { const s = skyAt(dAt(u)); return { haze: s.haze, lightColor: s.light, sun: 0.55 * s.air + 0.05, cover: 0.45, fields: 0, urban: 0.25 }; },
        opacity: ({ rebase }) => frames(rebase, 60, 620),
      })),
    L('coast-ground', 60, 4.0e4, () =>
      terrain({
        radiusMeters: 2.0e4, ampMeters: 30, featureMeters: 1400, flattenMeters: 4.0e3,
        seed: 12, rock: 0x35362f, dry: 0x4c4a36, lightDir: [0.8, 0.4, -0.3],
        offsetMeters: ({ u }) => [0, -dAt(u), 0],
        surface: ({ u }) => { const s = skyAt(dAt(u)); return { haze: s.haze, lightColor: s.light, sun: 0.6 * s.air + 0.04, cover: 0.5, fields: 0.35, urban: 0 }; },
        opacity: ({ rebase }) => frames(rebase, 380, 3.4e3),
      })),
    L('region-ground', 600, 1.2e5, () =>
      terrain({
        radiusMeters: 1.5e5, ampMeters: 260, featureMeters: 1.0e4, flattenMeters: 2.0e4,
        seed: 14, rock: 0x2b3238, dry: 0x3e4636, lightDir: [0.8, 0.4, -0.3],
        offsetMeters: ({ u }) => [0, -dAt(u), 0],
        surface: ({ u }) => { const s = skyAt(dAt(u)); return { haze: s.haze, lightColor: s.light, sun: 0.6 * s.air + 0.04, cover: 0.55, fields: 0.2, urban: 0 }; },
        opacity: ({ rebase }) => frames(rebase, 2.4e3, 2.6e4),
      })),
    L('continent-ground', 6.0e3, 2.0e5, () =>
      terrain({
        radiusMeters: 3.0e6, ampMeters: 2.0e3, featureMeters: 1.4e5, flattenMeters: 3.0e5,
        seed: 18, rock: 0x223038, dry: 0x33402f, lightDir: [0.8, 0.4, -0.3],
        offsetMeters: ({ u }) => [0, -dAt(u), 0],
        surface: ({ u }) => { const s = skyAt(dAt(u)); return { haze: mixHex(0x060a12, s.haze, 0.5), lightColor: 0xdfe6ff, sun: 0.55, cover: 0.5, fields: 0, urban: 0 }; },
        opacity: ({ rebase }) => frames(rebase, 1.8e4, 3.6e5),
      })),

    L('complex', 1, 1.2e3, () =>
      blocks({
        count: 5, areaMeters: 240, clearMeters: 100, spacingMeters: 78,
        heightMeters: [4, 13], footprint: 0.45, seed: 24, color: 0x4a4d52,
        lightDir: [0.8, 0.4, -0.3], sun: () => 0.45, night: () => 0.1, respectBand: false,
        opacity: ({ u, rebase }) => frames(rebase, 70, 900) * clamp01((1.6e3 - dAt(u)) / 1.2e3),
      })),
    L('service-tower', 1, 900, () =>
      blocks({
        count: 1, areaMeters: 36, clearMeters: 27, spacingMeters: 24,
        heightMeters: [96, 104], footprint: 0.34, seed: 72, color: 0x33363c,
        lightDir: [0.8, 0.4, -0.3], sun: () => 0.45, night: () => 0, respectBand: false,
        opacity: ({ u, rebase }) => frames(rebase, 55, 700) * clamp01((1.1e3 - dAt(u)) / 800),
      })),
    L('complex-lights', 1, 1.2e3, () =>
      particleField({
        count: 90, distribution: 'cloud', clumps: 14, clumpSpread: 0.2, flattenY: 0.12,
        seed: 30, colorA: 0xffd9a0, colorB: 0xfff2d8, colorMode: 'random',
        size: 2.6, maxSize: 7, twinkle: 0.3, radiusMeters: 200,
        offsetMeters: ({ u }) => [0, -dAt(u) + 10, 0], respectBand: false,
        opacity: ({ u, rebase }) => frames(rebase, 70, 1.6e3) * clamp01((2.2e3 - dAt(u)) / 1.6e3) * 0.45,
      })),

    // --- the launch vehicle / cruise stage -------------------------------
    // One vehicle from the pad through Mars orbit insertion, shedding twice:
    // first stage at staging, and the panels deploying (not shedding — see
    // `panels`/`deploy` below) at beat 14. The transfer stage keeps flying
    // the whole cruise, which is why it is one `vehicle` rather than several.
    L('transfer-stack', 1, 5.55e11, () =>
      vehicle({
        lengthMeters: ({ rebase }) => Math.max(130, rebase.frameMeters() * 0.20),
        bands: 6,
        bandDepth: 0.55,
        lightDir: SUN_DIR,
        stages: [
          {
            span: 0.40, r: 0.050, color: 0xe8ebef, nozzles: 6, nozzleR: 0.015,
            shed: ({ u }) => plin([[6.4e4, 0], [7.6e4, 0.5], [9.5e4, 1]], dAt(u)),
          },
          {
            span: 0.22, r: 0.050, color: 0xdfe3e8, nozzles: 3, nozzleR: 0.014,
            shed: ({ u }) => plin([[1.9e5, 0], [2.05e5, 0.5], [2.2e5, 1]], dAt(u)),
          },
          // The cruise stage: fires TMI, carries the panels, fires the course
          // correction, and is still attached at Mars arrival.
          { span: 0.24, r: 0.034, color: 0xd6dbe2, nozzles: 1, nozzleR: 0.017 },
        ],
        capsule: { span: 0.10, r: 0.026, color: 0xc9a25e, cone: 1 },
        panels: {
          count: 2, span: 0.9, width: 0.34, at: 0.55, color: 0x18234a,
          deploy: ({ u }) => plin([[1.9e11, 0], [2.2e11, 1]], dAt(u)),
        },
        plume: {
          span: 0.85, r: 0.052, core: 0xfff4d8, edge: 0xff8a2e, gain: 1.0,
          smoke: 0x33302c, smokeEdge: 0x121110, smokeGain: 0.5, soft: 1.5,
          throttle: ({ u }) => plin([
            [1, 0], [4, 1], [1.0e4, 1], [1.4e4, 0.7], [2.4e4, 1],
            [6.4e4, 1], [6.6e4, 0], [7.2e4, 0.85], [1.85e5, 0.85], [1.9e5, 0],
            [2.02e5, 0], [2.2e5, 1], [1.0e7, 1], [1.3e7, 0], // TMI
            [3.55e11, 0], [3.6e11, 0.4], [3.65e11, 0], // course correction
          ], dAt(u)),
        },
        attitude: ({ u }) => {
          const d = dAt(u);
          return [
            plin([[130, 0], [1.4e4, 0.35], [6.5e4, 0.9], [2.0e5, 1.4]], d),
            0,
            plin([[130, 0], [1.2e3, -0.5], [1.0e4, -0.55]], d),
          ];
        },
        offsetMeters: ({ u, rebase }) => {
          const s = plin([[5.30e11, 0], [5.55e11, 1]], dAt(u));
          return [0, -rebase.frameMeters() * 0.55 * s, 0];
        },
        opacity: ({ u }) => plin([[5.30e11, 1], [5.50e11, 0]], dAt(u)),
        respectBand: false,
      })),

    // Staging debris and retro flash — the middle phase of the staging event.
    L('stage-debris', 6.2e4, 1.5e5, () =>
      particleField({
        count: 1400, distribution: 'disk', innerRadius: 0.15, thickness: 0.5,
        seed: 32, blending: 'normal', colorA: 0xb9c2cc, colorB: 0x585f68, colorMode: 'random',
        size: 2.4, maxSize: 7, jitter: 0.02,
        radiusMeters: ({ u, rebase }) => rebase.frameMeters() * plin([[6.5e4, 0.05], [9.5e4, 0.5], [1.4e5, 0.9]], dAt(u)),
        offsetMeters: ({ rebase }) => [0, -rebase.frameMeters() * 0.28, 0],
        respectBand: false,
        opacity: ({ u }) => plin([[6.4e4, 0], [7.0e4, 0.85], [1.1e5, 0.4], [1.5e5, 0]], dAt(u)),
      })),
    L('retro-flash', 6.4e4, 1.0e5, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.06,
        offsetMeters: ({ rebase }) => [0, -rebase.frameMeters() * 0.2, 0],
        color: 0xfff0d0, haloColor: 0xffc98a, haloScale: 5, respectBand: false,
        opacity: ({ u }) => plin([[6.5e4, 0], [7.1e4, 1], [8.2e4, 0]], dAt(u)),
      })),

    // --- the cloud deck ------------------------------------------------------
    L('clouds', 200, 2.0e5, () =>
      particleField({
        count: 3000, distribution: 'cloud', clumps: 70, clumpSpread: 0.09, flattenY: 0.035,
        seed: 38, blending: 'normal', colorA: 0xf2f4f8, colorB: 0x9aa6b4, colorMode: 'random',
        size: 14, maxSize: 34,
        radiusMeters: ({ rebase }) => Math.min(4.0e4, rebase.frameMeters() * 1.6),
        offsetMeters: ({ u }) => [0, 2.0e3 - dAt(u), 0],
        respectBand: false,
        opacity: ({ u, rebase }) => {
          const f = rebase.frameMeters();
          return clamp01((f - 900) / 900) * clamp01((7.0e4 - f) / 4.0e4) * airAt(dAt(u)) * 0.5;
        },
      })),

    // --- Earth ---------------------------------------------------------------
    L('earth', 2.0e4, 2.5e11, () =>
      planet({
        radiusMeters: R_EARTH,
        offsetMeters: ({ u }) => [0, -(R_EARTH + dAt(u)), 0],
        lightDir: SUN_DIR, rock: 0x5b5140, atmosphere: 0x67b0ff, atmosphereScale: 1.014,
        spin: 0.004, segments: 128, respectBand: false,
        surface: () => ({ magma: 0, seaLevel: 0.5, green: 0.85, ice: 0.5, night: 1, atmosphere: 1 }),
        opacity: ({ rebase }) => clamp01((rebase.frameMeters() - 6.0e4) / 7.0e4) *
          clamp01((3.0e8 - rebase.frameMeters()) / 2.0e8),
      })),

    // Mars as a point of light, before the planet mesh is large enough to be
    // more than a sub-pixel triangle. A solid mesh sphere simply vanishes
    // once its screen footprint drops below a pixel — the same reason stars
    // and distant bodies elsewhere in this project are drawn as sprite
    // points rather than geometry. Bridges beats 16–18, handing off to the
    // real `mars` planet layer once its own opacity ramp takes over.
    // Same fix as `sun` above: placed along the camera's own boresight for
    // beats 16–18 (CAM ≈ [0,~0.1,6.2], aimed at LOOK_Y ≈ 4.0–4.6) rather than
    // at an independently-authored direction.
    L('mars-point', 4.9e11, 5.60e11, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.02,
        offsetMeters: ({ rebase }) => {
          const f = rebase.frameMeters();
          return [0, f * 1.32, -f * 1.82];
        },
        color: 0xffcf9a, haloColor: 0xff9a52, haloScale: 5,
        solid: true, solidColor: 0xffe0b8, segments: 16, respectBand: false,
        opacity: ({ u }) => band(dAt(u), 4.9e11, 5.05e11, 5.55e11, 5.60e11),
      })),

    // --- Mars ------------------------------------------------------------
    // seaLevel below zero (no oceans), ice drives the polar cap, rock is the
    // rust colour the whole journey is named for.
    L('mars', 3.0e11, walked(95), () =>
      planet({
        radiusMeters: R_MARS,
        offsetMeters: ({ u }) => [0, MARS_D - R_MARS - dAt(u), 0],
        lightDir: SUN_DIR, rock: 0xb3542a, atmosphere: 0xcf8a5a, atmosphereScale: 1.006,
        spin: 0.003, segments: 128, respectBand: false,
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0.22, night: 0, atmosphere: 0.25 }),
        opacity: ({ rebase }) => clamp01((rebase.frameMeters() - 8.0e4) / 8.0e4),
      })),

    // --- the Sun, shrinking and dimming -----------------------------------
    // The subject earth-to-moon cannot offer. Radius and brightness both
    // track the real 1/r² falloff via fluxAt(), same "drive length, radius
    // and brightness together" discipline vehicle.js's plume uses — a dimmer
    // sun that stayed the same SIZE would look like a lighting bug, not a
    // fact about distance.
    // Placed directly along the camera's own boresight for this beat (CAM ≈
    // [0,0,6.4], aimed at LOOK_X≈2.6/LOOK_Y≈0 — see index.js), at a fixed
    // world-unit distance, rather than at an independently-chosen offset: two
    // authored directions (the camera's aim and this layer's placement) that
    // are meant to coincide drifted apart by 70°+ in the first pass — this is
    // the fix, not a tuning nudge.
    L('sun', 1.0e9, 5.0e11, () =>
      glowSphere({
        radiusMeters: ({ u, rebase }) => rebase.frameMeters() * 0.16 * Math.sqrt(fluxAt(dAt(u))),
        offsetMeters: ({ rebase }) => {
          const f = rebase.frameMeters();
          return [f * 0.85, 0, -f * 2.08];
        },
        color: 0xfff2d8, haloColor: 0xffcf8a, haloScale: 4.5,
        solid: true, solidColor: 0xfff6e6, segments: 20,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), 1.0e9, 4.0e9, 4.6e11, 5.0e11) * (0.6 + 0.4 * fluxAt(dAt(u))),
      })),

    // --- the transfer trajectory -------------------------------------------
    // The actual Hohmann arc, not a straight line — the harder case
    // trajectory.js was built to cover. Parameterised as a half-ellipse from
    // Earth's position to Mars', in the plane the camera already looks along.
    L('transfer-path', 5.0e6, MARS_D - 2.0e4, () =>
      trajectory({
        path: (s) => {
          const a = Math.PI * s; // 0 → π across the half-ellipse
          const x = Math.sin(a) * 0.12; // a gentle bow, mostly a straight run
          const y = (s - 0.5) * MARS_D;
          return [x * MARS_D, y, 0];
        },
        samples: 320,
        ticks: 20,
        tickSize: 3.4,
        color: 0xffb27a,
        colorAhead: 0x6a4a34,
        aheadOpacity: 0.28,
        offsetMeters: ({ u }) => [0, MARS_D / 2 - (R_EARTH + dAt(u)), 0],
        progress: ({ u }) => (R_EARTH + dAt(u)) / MARS_D,
        opacity: ({ u }) => band(dAt(u), 5.0e6, 1.0e7, 5.4e11, 5.598e11) * 0.5,
      })),

    // Earth's own orbital path, a faint ring the ship's trajectory visibly
    // crosses at beat 13 — one of the two concrete "events" that break up the
    // empty cruise.
    L('earth-orbit-ring', 1.2e11, 1.9e11, () =>
      trajectory({
        path: (s) => [Math.cos(s * Math.PI * 2) * AU, 0, Math.sin(s * Math.PI * 2) * AU],
        samples: 220,
        color: 0x6fa0ff,
        colorAhead: 0x6fa0ff,
        aheadOpacity: 1,
        progress: () => 1,
        offsetMeters: ({ u }) => [0, AU - (R_EARTH + dAt(u)), 0],
        opacity: ({ u }) => band(dAt(u), 1.2e11, 1.4e11, 1.7e11, 1.9e11) * 0.35,
        respectBand: false,
      })),

    // Mars' own orbital path, crossed at beat 16.
    L('mars-orbit-ring', 4.5e11, 5.2e11, () =>
      trajectory({
        path: (s) => [Math.cos(s * Math.PI * 2) * MARS_AU, 0, Math.sin(s * Math.PI * 2) * MARS_AU],
        samples: 220,
        color: 0xe8763c,
        colorAhead: 0xe8763c,
        aheadOpacity: 1,
        progress: () => 1,
        offsetMeters: ({ u }) => [0, MARS_D - MARS_AU - dAt(u), 0],
        opacity: ({ u }) => band(dAt(u), 4.5e11, 4.8e11, 5.0e11, 5.2e11) * 0.35,
        respectBand: false,
      })),

    // --- Mars terrain, far to close ----------------------------------------
    L('mars-far', 5.596e11, walked(95), () =>
      terrain({
        radiusMeters: 1.2e6, ampMeters: 9.0e3, featureMeters: 9.0e4, flattenMeters: 1.0e5,
        seed: 42, haze: 0x7a4a2c, rock: 0xa8552c, dry: 0xc07444, lightDir: SUN_DIR, lightColor: 0xffdcb0,
        offsetMeters: ({ u }) => [0, marsDrop(dAt(u)), 0],
        surface: () => ({ sun: 0.85, cover: 0, fields: 0, urban: 0 }),
        opacity: ({ rebase }) => frames(rebase, 1.4e4, 2.2e5),
      })),
    L('mars-mid', MARS_D - 5.0e4, walked(95), () =>
      terrain({
        radiusMeters: 1.0e5, ampMeters: 900, featureMeters: 7.0e3, flattenMeters: 1.0e4,
        seed: 44, haze: 0x7a4a2c, rock: 0xac5a30, dry: 0xc47a4a, lightDir: SUN_DIR, lightColor: 0xffdcb0,
        offsetMeters: ({ u }) => [0, marsDrop(dAt(u)), 0],
        surface: () => ({ sun: 0.85, cover: 0, fields: 0, urban: 0 }),
        opacity: ({ rebase }) => frames(rebase, 1.6e3, 1.7e4),
      })),
    L('mars-near', MARS_D - 1.2e4, walked(95), () =>
      terrain({
        radiusMeters: 6.0e3, ampMeters: 40, featureMeters: 340, flattenMeters: 600,
        seed: 48, haze: 0x7a4a2c, rock: 0xaf5f36, dry: 0xc87f4e, lightDir: SUN_DIR, lightColor: 0xffdcb0,
        offsetMeters: ({ u }) => [0, marsDrop(dAt(u)), 0],
        surface: () => ({ sun: 0.85, cover: 0, fields: 0, urban: 0 }),
        opacity: ({ rebase }) => frames(rebase, 110, 2.0e3),
      })),
    L('mars-close', MARS_D - 900, walked(95), () =>
      terrain({
        radiusMeters: 420, ampMeters: 3.0, featureMeters: 26, flattenMeters: 60,
        seed: 54, haze: 0x7a4a2c, rock: 0xb2643c, dry: 0xcc8556, lightDir: SUN_DIR, lightColor: 0xffdcb0,
        offsetMeters: ({ u }) => [0, marsDrop(dAt(u)), 0],
        surface: () => ({ sun: 0.85, cover: 0, fields: 0, urban: 0 }),
        opacity: ({ rebase }) => frames(rebase, 7, 140),
      })),
    L('mars-micro', walked(1), walked(95), () =>
      terrain({
        radiusMeters: 26, ampMeters: 0.014, featureMeters: 0.22, flattenMeters: 2,
        seed: 60, haze: 0x7a4a2c, rock: 0xb56a42, dry: 0xd08e5c, lightDir: SUN_DIR, lightColor: 0xffdcb0,
        surface: () => ({ sun: 0.85, cover: 0, fields: 0, urban: 0 }),
        opacity: ({ rebase }) => frames(rebase, 0.35, 8),
      })),

    // Martian dusk/dawn sky — rust near the sun, butterscotch at the horizon.
    // Never full black: even at peak heating there is a thin CO2 atmosphere,
    // and beats 26–28 are specifically about a coloured sky, unlike the
    // Moon's.
    L('mars-sky', MARS_D - 3.0e5, walked(95), () =>
      backdrop({
        radiusFrames: 8,
        top: 0x2a1710, horizon: 0xd79a5a, bottom: 0x1b0f0a,
        sunColor: 0xfff2d8,
        sunDir: [0.62, 0.22, -0.56],
        sunSize: 0.9985, sunSoft: 0.0025, sunGain: 1.6, bandLift: 0.22,
        opacity: ({ rebase }) => clamp01((3.4e5 - rebase.frameMeters()) / 2.0e5),
      })),

    // --- entry, descent and landing ----------------------------------------
    // The plasma sheath. Additive core (the glow) plus a NORMAL-blended dark
    // trailing streamer — additive alone cannot draw the dark contrail behind
    // the capsule, the same lesson vehicle.js's plume collar encodes.
    L('entry-glow', MARS_D - 1.4e5, MARS_D - 3.0e4, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.09,
        offsetMeters: ({ rebase }) => [0, -rebase.frameMeters() * 0.05, rebase.frameMeters() * 0.02],
        color: 0xfff0c8, haloColor: 0xff9a4a, haloScale: 3.4, respectBand: false,
        opacity: ({ u }) => band(dAt(u), MARS_D - 1.25e5, MARS_D - 1.1e5, MARS_D - 4.5e4, MARS_D - 2.5e4),
      })),
    L('entry-streamer', MARS_D - 1.25e5, MARS_D - 2.0e4, () =>
      particleField({
        count: 1600, distribution: 'disk', innerRadius: 0.05, thickness: 0.6, flattenY: 0.5,
        seed: 62, blending: 'normal', colorA: 0x3a2016, colorB: 0x140a06, colorMode: 'random',
        size: 4, maxSize: 12,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.35,
        offsetMeters: ({ rebase }) => [0, -rebase.frameMeters() * 0.15, -rebase.frameMeters() * 0.05],
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), MARS_D - 1.2e5, MARS_D - 9.0e4, MARS_D - 4.0e4, MARS_D - 2.0e4) * 0.5,
      })),

    // The parachute. A wide, near-camera disc rather than fabric geometry —
    // legible at any scale is the point (lights read at any scale; geometry
    // does not), so it is drawn as a bright rim with a dark canopy body.
    L('parachute-canopy', MARS_D - 1.15e4, MARS_D - 1.6e3, () =>
      blob({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.22,
        offsetMeters: ({ rebase }) => [0, rebase.frameMeters() * 0.32, 0],
        fill: 0xd8d2c0,
        rim: 0xece6d4,
        fillAlpha: 0.85,
        wobble: 0.03,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), MARS_D - 1.1e4, MARS_D - 9.0e3, MARS_D - 2.4e3, MARS_D - 1.6e3) * 0.7,
      })),

    // --- the lander ----------------------------------------------------------
    L('lander', MARS_D - 5.0e4, walked(95), () =>
      vehicle({
        lengthMeters: ({ rebase }) => Math.max(6, rebase.frameMeters() * 0.14),
        lightDir: SUN_DIR, ambient: 0.14,
        stages: [{ span: 0.42, r: 0.30, color: 0xc9a25e, nozzles: 1, nozzleR: 0.09 }],
        capsule: { span: 0.36, r: 0.26, color: 0xc8ccd2, cone: 0 },
        legs: { count: 4, span: 0.55, spread: 0.72, footR: 0.07, color: 0xa8aeb6 },
        plume: {
          span: 0.9, r: 0.10, core: 0xffe0b0, edge: 0xff8a3a, gain: 0.6,
          smoke: 0x1a1410, smokeEdge: 0x0a0806, smokeGain: 0.2, soft: 1.1,
          throttle: ({ u }) => plin([
            [MARS_D - 1.6e3, 0], [MARS_D - 1.4e3, 1], [MARS_D - 300, 0.7],
            [MARS_D - 20, 0.3], [MARS_D, 0],
          ], dAt(u)),
        },
        attitude: ({ u }) => [
          plin([[MARS_D - 5.0e4, 0], [MARS_D - 1.4e3, 0], [MARS_D, 0]], dAt(u)),
          0.5, 0,
        ],
        offsetMeters: ({ u, rebase }) => {
          const d = dAt(u);
          const grounded = clamp01(1 - Math.max(0, MARS_D - d) / 30);
          const len = Math.max(6, rebase.frameMeters() * 0.14);
          const walkedM = Math.max(0, d - MARS_D);
          return [-(walkedM * 0.8) - grounded * 5, grounded * len * 0.42, walkedM * 0.4];
        },
        opacity: ({ u }) => band(dAt(u), MARS_D - 5.0e4, MARS_D - 3.0e4),
        respectBand: false,
      })),

    // The retropropulsion dust plume — NORMAL blended, dark, a sheet not a
    // haze: regolith kicked in a thin atmosphere is lit grey material, not
    // light, and it settles almost as fast as it rises once the engine stops.
    L('landing-dust', MARS_D - 1.6e3, walked(30), () =>
      particleField({
        count: 4600, distribution: 'disk', innerRadius: 0.06, thickness: 0.3, flattenY: 0.18,
        seed: 64, blending: 'normal', colorA: 0xa06a44, colorB: 0x4a3020, colorMode: 'random',
        size: 6, maxSize: 20, spin: 0.4,
        radiusMeters: ({ u }) => 20 + Math.max(0, 100 - marsAlt(dAt(u))) * 0.5,
        offsetMeters: ({ u }) => [0, marsDrop(dAt(u)) + 1.0, 0],
        respectBand: false,
        opacity: ({ u }) => {
          const d = dAt(u); const alt = marsAlt(d);
          if (d >= MARS_D) return 0;
          return clamp01((1.5e3 - alt) / 1.2e3) * 0.85;
        },
      })),

    // --- the first frame ------------------------------------------------------
    // "Rocks in the foreground" — an earlier version reused `panel`'s
    // `bootprint` kind here, tilted upright, and it rendered as two vertical
    // grid-textured slabs, not rocks: the wrong archetype for the subject
    // (panel draws a flat MARKED surface; this needed a solid lump), so the
    // beat shipped leaning on `mars-micro` terrain relief alone. The `rocks`
    // archetype (built for this gap, see src/archetypes/rocks.js) now gives
    // the foreground actual boulders: a near cluster enclosing the camera
    // (small `centreClear`, `areaMeters` sized to the frame) plus a wider,
    // sparser field reaching toward the horizon.
    L('foreground-rocks', walked(2), walked(95), () =>
      rocks({
        count: 26, seed: 91, sizeMeters: [0.12, 0.55], areaMeters: 4.2,
        centreClear: 0.6, buryFraction: 0.32, angularity: 0.36,
        rock: 0x6a3a24, dry: 0x8a5638, ambient: 0x2a1c14, lightDir: SUN_DIR,
        offsetMeters: ({ u }) => [1.1, marsDrop(dAt(u)), -1.4],
        respectBand: false,
        opacity: ({ rebase }) => frames(rebase, 0.8, 40),
      })),
    L('field-rocks', walked(2), walked(95), () =>
      rocks({
        count: 30, seed: 92, sizeMeters: [0.3, 1.1], areaMeters: 14,
        centreClear: 3, buryFraction: 0.35, angularity: 0.3,
        rock: 0x653620, dry: 0x855234, ambient: 0x241812, lightDir: SUN_DIR,
        offsetMeters: ({ u }) => [0, marsDrop(dAt(u)), 0],
        respectBand: false,
        opacity: ({ rebase }) => frames(rebase, 4, 120),
      })),

    L('crew', walked(20), walked(95), () =>
      silhouette({
        kind: 'figure', count: 2, variants: 4, seed: 74, areaMeters: 9,
        heightMeters: [1.75, 1.95], aspect: 0.72, centreClear: 5, nearFadeMeters: 3.5,
        offsetMeters: [5, 0, -4],
        color: 0xd8b48c, rim: 0xffd9a8, respectBand: false,
        opacity: ({ rebase }) => frames(rebase, 9, 160),
      })),

    // Earth as an evening star. NOT drawn at true angular size (~10 arcsec —
    // sub-pixel at any reasonable frame): a point of light is what the beat
    // is about, so it is a small, bright, near-camera glow at a LOW,
    // off-axis position — this is the beat LOOK_X exists for.
    L('earth-evening-star', walked(12), walked(95), () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.006,
        offsetMeters: ({ rebase }) => {
          const r = rebase.frameMeters() * 3;
          return [-r * 0.55, r * 0.18, -r * 0.7];
        },
        color: 0xbcd4ff, haloColor: 0x6fa0e0, haloScale: 2.4,
        solid: true, solidColor: 0xdcecff, segments: 16, respectBand: false,
        opacity: ({ rebase }) => frames(rebase, 4, 200),
      })),
  ];
}
