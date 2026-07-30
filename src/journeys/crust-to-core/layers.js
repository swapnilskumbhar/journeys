import {
  strata, rocks, particleField, glowSphere, blob, silhouette, backdrop, trajectory,
} from '../../archetypes/index.js';
import { R_EARTH, D_MOHO, D_CMB, D_ICB, D_KOLA, D_MPONENG } from './depth.js';
import { band, plin, mixHex, clamp01 } from './curve.js';

// THE CENTRAL RISK, per DESIGN.md: this journey is inside opaque solid rock
// the whole time, no sky, no horizon, no light source that belongs there.
// The single continuous device that carries the whole journey is `strata`
// (src/archetypes/strata.js) — a material shell always surrounding the
// camera — driven by ONE function of real depth, `materialAt(d)`, so colour
// and texture change continuously and truthfully with depth rather than
// jumping per-beat. `glowAt(d)` is the second continuous device: 0 (lit only
// by an authored lamp) until the D″ layer, ramping to 1 (fully self-luminous)
// crossing the core–mantle boundary — the journey's real lit-to-glowing arc,
// not a per-beat on/off switch.
//
// A THIRD device recurs across the human-scale beats specifically: a
// `trajectory` line drawn as the actual borehole shaft, the one object that
// gives the "deepest mine / deepest hole" beats a fixed, legible scale
// reference the reader can watch shrink relative to.
export function makeLayers(uAt, dAt) {
  const L = (id, fromD, toD, build) => ({ id, from: uAt(fromD), to: uAt(toD), build });

  const frames = (rebase, lo, hi) => {
    const f = rebase.frameMeters();
    return clamp01((f - lo) / (lo * 0.8)) * clamp01((hi - f) / (hi * 0.35));
  };

  // --- the one continuous material drive ------------------------------------
  // Keyed on REAL depth, not on beat index — this is what keeps 27 beats from
  // reading as the same brown wall wearing 27 different captions.
  const STOPS = [
    // [depth, bandA, bandB, bandFreq, vein, veinDensity, grain]
    [0.3, 0x241a12, 0x2e2015, 0, 0x000000, 0, 0.5],       // topsoil: dark, organic
    [8, 0x2c2418, 0x1c2a30, 0, 0x000000, 0, 0.4],         // saturated soil, cooler
    [30, 0x4a463c, 0x3a362c, 0, 0x000000, 0, 0.35],       // grey bedrock
    [D_MPONENG, 0x3a2e26, 0x2c2018, 0, 0x000000, 0, 0.45],// hot mine rock
    [D_KOLA, 0x463424, 0x2a2016, 0, 0x000000, 0, 0.4],
    [2.0e4, 0xc8b482, 0x9c8858, 5, 0xe8d8a0, 0, 0.3],     // sedimentary strata: pale, BANDED
    [3.0e4, 0x685848, 0x4a4034, 0, 0x000000, 0, 0.4],     // metamorphosed
    [D_MOHO * 0.99, 0x5a5040, 0x463c30, 0, 0x000000, 0, 0.4], // crust, right up to the Moho
    [D_MOHO * 1.02, 0x3d5236, 0x2c3e28, 0, 0x000000, 0, 0.35], // mantle: olive-green, abrupt
    [8.0e4, 0x3d5236, 0x2c3e28, 0, 0x000000, 0, 0.3],     // peridotite, held
    [1.5e5, 0x46503a, 0x333c28, 0, 0x000000, 0, 0.25],    // asthenosphere: same rock, softer grain
    [1.9e5, 0x3a4834, 0x28321f, 0, 0xbfe8ff, 0.35, 0.3],  // diamond depth: kimberlite veins
    [5.0e5, 0x4a4238, 0x36302a, 0, 0x000000, 0, 0.3],     // transition zone
    [1.2e6, 0x5a3428, 0x40241c, 0, 0x000000, 0, 0.3],     // lower mantle: bridgmanite red-brown
    [2.85e6, 0x462820, 0x2c1811, 12, 0x704030, 0.5, 0.35],// D″: streaky, patchy slab graveyard
    [D_CMB * 0.999, 0x3a2018, 0x24120c, 0, 0x000000, 0, 0.35], // right up to the CMB
    [D_CMB * 1.001, 0xff5a1e, 0xff8a3a, 0, 0x000000, 0, 0.1],  // outer core: glowing iron
    [4.0e6, 0xff6a2a, 0xffa050, 0, 0x000000, 0, 0.08],
    // Approaching the inner-core boundary: the liquid outer core's orange
    // pushed hotter/yellower, so the crossing itself (below) reads as an
    // arrival rather than a continuation of the same colour.
    [D_ICB * 0.999, 0xffa050, 0xffc878, 0, 0x000000, 0, 0.06],
    // The inner core is SOLID iron, not more of the same liquid glow — beats
    // 25–27 were the least differentiated stretch of the journey in the first
    // pass (all three converged on one pale wash after the bloom-whiteout
    // fix). The real fix is CONTRAST, not just avoiding pure white: a deep,
    // saturated bronze-amber for the newly-solid material (beat 26) is a
    // different hue and a different saturation from the liquid core's
    // orange, not just a paler version of it, and a light vein/facet pattern
    // (`veinDensity`) gives it internal structure a liquid has no business
    // having. The centre (beat 27) is brighter and hotter again — genuinely
    // the most extreme point in the journey — but still capped short of pure
    // white, with grain kept high so it reads as the hottest MATERIAL, not a
    // blown highlight.
    [D_ICB * 1.002, 0xc07830, 0x8a4e1c, 0, 0xf0c878, 0.22, 0.3],  // freshly solid: bronze-amber, faceted
    [5.8e6, 0xc8802e, 0x925018, 0, 0xf2ca80, 0.2, 0.3],           // the solid inner core, held
    [R_EARTH, 0xffe8b0, 0xffcf80, 0, 0xfff2d0, 0.1, 0.22],        // the centre: brightest, hottest, still not white
  ];
  const at = (i) => STOPS[i];
  function materialAt(d) {
    let i = 0;
    while (i < STOPS.length - 2 && d > at(i + 1)[0]) i++;
    const a = at(i);
    const b = at(i + 1);
    const t = clamp01((Math.log10(Math.max(d, 0.01)) - Math.log10(a[0])) /
      Math.max(1e-6, Math.log10(Math.max(b[0], a[0] * 1.0001)) - Math.log10(a[0])));
    return {
      bandA: mixHex(a[1], b[1], t),
      bandB: mixHex(a[2], b[2], t),
      bandFreq: a[3] + (b[3] - a[3]) * t,
      vein: mixHex(a[4] || 0x000000, b[4] || 0x000000, t),
      veinDensity: a[5] + (b[5] - a[5]) * t,
      grain: a[6] + (b[6] - a[6]) * t,
    };
  }

  // Fully lit by an authored lamp until the D″ layer; a faint self-luminous
  // HINT grows through the last of the mantle (rock this hot already glows
  // faintly under its own heat before it is molten); then a STEEP crossing
  // right at the core–mantle boundary itself — the single sharpest change in
  // the planet gets a sharp visual change, not a slow fade spread back across
  // the whole mantle, which would undersell the one boundary DESIGN.md calls
  // out as a structural event.
  const glowAt = (d) => {
    if (d < 2.83e6) return 0;
    if (d < D_CMB * 0.999) return clamp01((d - 2.83e6) / (D_CMB * 0.999 - 2.83e6)) * 0.18;
    if (d < D_CMB * 1.004) return 0.18 + 0.82 * clamp01((d - D_CMB * 0.999) / (D_CMB * 0.005));
    return 1;
  };
  const lampAt = (d) => 1 - clamp01((d - 1.0e6) / 1.8e6);

  return [
    // --- the one continuous wall ---------------------------------------------
    L('strata', 0.3, R_EARTH, () =>
      strata({
        radiusFrames: 2.6,
        drive: ({ u }) => materialAt(dAt(u)),
        glow: ({ u }) => glowAt(dAt(u)),
        lamp: ({ u }) => 0.4 + 1.4 * lampAt(dAt(u)),
        lampDir: [0.3, 0.7, 0.5],
        glowColor: 0xffb060,
        opacity: () => 1,
      })),

    // --- a glimpse of open sky, only at the very start ------------------------
    L('sky', 0.3, 4, () =>
      backdrop({
        radiusFrames: 6,
        top: 0x3a6ea8, horizon: 0x9ec4d8, bottom: 0x2a2015,
        sunDir: [0.5, 0.6, 0.4], sunSize: 0.9993, sunSoft: 0.003, sunGain: 0.9,
        opacity: ({ u }) => clamp01((3 - dAt(u)) / 2.5),
      })),
    L('grass', 0.3, 3, () =>
      silhouette({
        kind: 'reed', count: 60, variants: 5, seed: 5, areaMeters: 3,
        heightMeters: [0.15, 0.4], color: 0x1c3018, rim: 0x6a9a3c,
        offsetMeters: ({ u }) => [0, dAt(u), 0],
        respectBand: false,
        opacity: ({ rebase }) => frames(rebase, 0.4, 8),
      })),

    // --- foreground rock, present through the crust ---------------------------
    L('foreground-rocks', 25, D_MOHO, () =>
      rocks({
        count: 26, seed: 201, sizeMeters: ({ rebase }) => {
          const f = rebase.frameMeters();
          return [f * 0.05, f * 0.22];
        }, areaMeters: ({ rebase }) => rebase.frameMeters() * 1.4,
        centreClear: 0, buryFraction: 0.25, angularity: 0.4,
        rock: 0x4a4034, dry: 0x6a5c48, ambient: 0x2a241c, lightDir: [0.3, 0.7, 0.5],
        respectBand: false,
        opacity: ({ rebase }) => frames(rebase, 0.4, 4),
      })),

    // --- the borehole shaft: a recurring scale reference ----------------------
    // A vertical line, ticked every kilometre, drawn from just above Mponeng
    // through just past Kola — the fixed object the reader can watch shrink
    // relative to as the frame widens, the recurring scale reference
    // DESIGN.md calls for.
    L('borehole-shaft', 2.0e3, 3.0e4, () =>
      trajectory({
        path: (s) => [0, (s - 0.5) * 4.0e4, 0],
        samples: 60, ticks: 40, tickSize: 60,
        color: 0xcfd8e0, colorAhead: 0x38424a, aheadOpacity: 0.4,
        progress: ({ u }) => clamp01((dAt(u) - 2.0e3) / (3.0e4 - 2.0e3)),
        offsetMeters: ({ u }) => [0, 2.0e4 - dAt(u), 0],
        opacity: ({ rebase }) => frames(rebase, 30, 6.0e4) * 0.6,
        respectBand: false,
      })),

    // --- Mponeng: worked, hot rock ---------------------------------------------
    L('mine-glow', D_MPONENG * 0.5, 9.0e3, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.05,
        offsetMeters: ({ rebase }) => [rebase.frameMeters() * 0.5, 0, -rebase.frameMeters() * 0.3],
        color: 0xff8040, haloColor: 0xff5020, haloScale: 4,
        opacity: ({ u }) => band(dAt(u), D_MPONENG * 0.7, D_MPONENG, 8.0e3, 9.0e3) * 0.5,
        respectBand: false,
      })),
    L('heat-haze', D_MPONENG * 0.6, 9.5e3, () =>
      particleField({
        count: 500, distribution: 'cloud', clumps: 8, clumpSpread: 0.3, flattenY: 0.4,
        seed: 33, blending: 'normal', colorA: 0x8a5030, colorB: 0x5a3018, colorMode: 'random',
        size: 6, maxSize: 16,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.8,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), D_MPONENG * 0.6, D_MPONENG, 8.0e3, 9.5e3) * 0.25,
      })),

    // --- Kola: mineral clasts, drill-hot rock ---------------------------------
    L('kola-rubble', D_KOLA * 0.6, 2.0e4, () =>
      rocks({
        count: 20, seed: 210, sizeMeters: ({ rebase }) => [rebase.frameMeters() * 0.03, rebase.frameMeters() * 0.12],
        areaMeters: ({ rebase }) => rebase.frameMeters() * 1.2, centreClear: 0, buryFraction: 0.2, angularity: 0.5,
        rock: 0x3a2c20, dry: 0x584434, ambient: 0x241c14, lightDir: [0.3, 0.7, 0.5],
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), D_KOLA * 0.6, D_KOLA * 0.9, 1.6e4, 2.0e4) * 0.8,
      })),

    // --- sedimentary strata: the reading-time-backward beat -------------------
    L('strata-dust', 1.6e4, 3.0e4, () =>
      particleField({
        count: 300, distribution: 'disk', innerRadius: 0, thickness: 0.4, flattenY: 0.6,
        seed: 41, blending: 'normal', colorA: 0xd8c090, colorB: 0xa88860, colorMode: 'random',
        size: 3, maxSize: 8,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.7,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), 1.7e4, 1.9e4, 2.6e4, 3.0e4) * 0.3,
      })),

    // --- the Mohorovičić discontinuity: a visible seismic snap ----------------
    // A thin, bright, near-camera plane exactly at D_MOHO, drawn as a
    // squashed, near-white blob — a real event's approach → crossing →
    // aftermath, staged in envelope rather than narrated.
    L('moho-flash', D_MOHO * 0.985, D_MOHO * 1.02, () =>
      blob({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 1.3,
        offsetMeters: ({ rebase }) => [0, 0, -rebase.frameMeters() * 1.1],
        fill: 0xdfe8ff, rim: 0xffffff, fillAlpha: 0.06, wobble: 0.01,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), D_MOHO * 0.988, D_MOHO * 0.999, D_MOHO * 1.001, D_MOHO * 1.015) * 0.5,
      })),

    // --- kimberlite: the pipe that carries diamonds up ------------------------
    L('kimberlite-pipe', 1.7e5, 2.2e5, () =>
      blob({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.35,
        offsetMeters: ({ rebase }) => [rebase.frameMeters() * 0.5, rebase.frameMeters() * 1.4, -rebase.frameMeters() * 0.6],
        fill: 0x241c30, rim: 0x8a6ab0, fillAlpha: 0.5, wobble: 0.02,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), 1.75e5, 1.85e5, 2.05e5, 2.2e5) * 0.6,
      })),
    L('diamond-sparkle', 1.75e5, 2.1e5, () =>
      particleField({
        count: 90, distribution: 'cloud', clumps: 6, clumpSpread: 0.15, flattenY: 0.5,
        seed: 47, colorA: 0xffffff, colorB: 0xbfe8ff, colorMode: 'random',
        size: 3, maxSize: 9, twinkle: 0.6,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.45,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), 1.78e5, 1.85e5, 2.0e5, 2.1e5) * 0.7,
      })),

    // --- the D″ layer: the graveyard of subducted slabs -----------------------
    L('slab-graveyard', 2.4e6, 2.89e6, () =>
      blob({
        count: 5, radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.5,
        areaMeters: ({ rebase }) => rebase.frameMeters() * 1.6, seed: 55,
        fill: 0x201410, rim: 0x50302a, fillAlpha: 0.6, wobble: 0.015,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), 2.5e6, 2.7e6, 2.85e6, 2.89e6) * 0.55,
      })),

    // --- the core–mantle boundary: the sharpest change in the planet ---------
    L('cmb-flash', D_CMB * 0.996, D_CMB * 1.006, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 1.4,
        offsetMeters: ({ rebase }) => [0, 0, -rebase.frameMeters() * 1.1],
        color: 0xffb060, haloColor: 0xff7a30, haloScale: 1.6,
        opacity: ({ u }) => band(dAt(u), D_CMB * 0.997, D_CMB * 0.9995, D_CMB * 1.0015, D_CMB * 1.005) * 0.7,
        respectBand: false,
      })),

    // --- the liquid outer core: convection and the dynamo ----------------------
    L('convection', D_CMB * 1.01, 5.0e6, () =>
      particleField({
        count: 1200, distribution: 'ball', seed: 61,
        colorA: 0xff9a4a, colorB: 0xffe0a0, colorMode: 'random',
        size: 3, maxSize: 10, twinkle: 0.25,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 1.1,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), D_CMB * 1.01, 3.2e6, 4.8e6, 5.0e6) * 0.35,
      })),

    // --- the inner-core boundary: liquid gives way to solid --------------------
    // Beats 25–27 (the ICB crossing through the centre) were the least
    // differentiated stretch of the journey even after the bloom-whiteout
    // fix — three beats that should be the most dramatic in the journey
    // (iron solid at the Sun's surface temperature, held solid by pressure
    // alone) instead converged on one pale wash. Two structural events
    // (the Moho, the CMB) already got their own flash marker; the ICB had
    // none — a real gap, not a tuning problem. A cooler, whiter flash (in
    // contrast to the CMB's warm orange one) marks the crossing itself:
    // liquid iron does not merely get hotter here, it changes STATE.
    L('icb-flash', D_ICB * 0.997, D_ICB * 1.006, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 1.3,
        offsetMeters: ({ rebase }) => [0, 0, -rebase.frameMeters() * 1.1],
        color: 0xfff4e0, haloColor: 0xffe0a8, haloScale: 1.7,
        opacity: ({ u }) => band(dAt(u), D_ICB * 0.998, D_ICB * 0.9995, D_ICB * 1.002, D_ICB * 1.006) * 0.75,
        respectBand: false,
      })),

    // --- the inner core: solid, and the growing target ahead --------------------
    // Colour now tracks the same bronze-amber → bright-gold arc as the
    // `strata` material itself (see STOPS above), rather than one flat tint
    // held across beats 24–27 — the earlier version of this layer was ITSELF
    // part of why the last three beats looked alike: the wall changed colour
    // but the one object every one of those beats shares did not.
    L('inner-core-ahead', 4.6e6, R_EARTH, () =>
      glowSphere({
        radiusMeters: ({ u, rebase }) => {
          const d = dAt(u);
          const remaining = Math.max(1e3, R_EARTH - d);
          return Math.min(rebase.frameMeters() * 1.2, remaining * 1.3);
        },
        offsetMeters: ({ rebase }) => [0, 0, -rebase.frameMeters() * 2.2],
        color: ({ u }) => mixHex(0xc07830, 0xffe8b0, clamp01((dAt(u) - D_ICB) / (R_EARTH - D_ICB))),
        haloColor: ({ u }) => mixHex(0x8a4e1c, 0xffcf80, clamp01((dAt(u) - D_ICB) / (R_EARTH - D_ICB))),
        haloScale: 1.6,
        solid: true,
        solidColor: ({ u }) => mixHex(0xc8802e, 0xffe8b0, clamp01((dAt(u) - D_ICB) / (R_EARTH - D_ICB))),
        segments: 20,
        opacity: ({ u }) => band(dAt(u), 4.7e6, 5.0e6, Infinity, Infinity) * clamp01(glowAt(dAt(u))) * 0.6,
        respectBand: false,
      })),
  ];
}
