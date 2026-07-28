import {
  particleField, glowSphere, filaments, planet, terrain, blocks, backdrop, silhouette,
  water, blob,
} from '../../archetypes/index.js';
import { AGE, YR, ago, after } from './time.js';
import { band, plin, plog, smooth, clamp01, mixHex, scaleHex } from './curve.js';

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

  // Daylight through the surface era: 0 = night, 1 = noon. Defined ONCE and
  // shared by the sky dome and the ground's own lighting, because the two
  // disagreeing is the most illusion-breaking thing this era can do — and for
  // a long time it did, since the ground was lit to 0.8 while there was no sky
  // at all and every daylight beat rendered as midnight.
  //
  // The dips are editorial and deliberate: fire and the first lamps only read
  // at low sun, and Out of Africa is a beat about firelight spreading across a
  // dark continent, so it is the one that goes properly to night.
  const dayAt = (ya) => clamp01(plin([
    [58e6, 0.5], [30e6, 0.85], [2.4e6, 0.75], [1.9e6, 0.38],
    [300e3, 0.42], [65e3, 0.06], [20e3, 0.55], [12e3, 0.92],
    // The wheel and writing drop toward dusk: hearth- and lamplight are what
    // say "inhabited" at settlement scale, and neither reads at noon.
    [6.5e3, 0.58], [5.2e3, 0.42], [600, 0.6], [260, 0.5], [1, 0.55],
  ], ya));

  // The Permian–Mesozoic sky, on the same contract as skyAt below: the eruption
  // clears, the world recovers for eighty million years, then the K–Pg snaps it
  // dark again in what is, at this scale, an instant.
  const trapsSkyAt = (ya) => {
    const clear = clamp01(plin([[240e6, 0], [170e6, 1], [66.6e6, 1], [66.0e6, 0.1]], ya));
    // Recovered, not cheerful — a bright horizon over a lit plain reads as an
    // overexposed desert, which is the wrong note for the aftermath of the
    // largest extinction there has been.
    const horizon = mixHex(0x5a3320, 0x3d5460, clear);
    return {
      clear,
      horizon,
      top: mixHex(0x140f0c, 0x0e1b2e, clear),
      bottom: scaleHex(horizon, 0.85),
      seam: scaleHex(horizon, 0.85),
      sunGain: 0.24 + clear * 0.16,
      bandLift: 0.34 - clear * 0.16,
    };
  };

  // The sky, as ONE function. The dome reads it, and so does every terrain's
  // horizon haze — because a terrain is a finite disc, and where its rim ends
  // it must have already become the colour of the sky behind it. Left to a
  // constant, that rim draws a bright curved arc across the frame: a false
  // horizon, sitting above the real one, which is exactly what appeared the
  // moment this era stopped being rendered against black.
  const skyAt = (ya) => {
    const day = dayAt(ya);
    // Coal. The copy for "Machines" is about burning it at scale, and a brown
    // horizon is what that looked like from inside the city.
    const smog = clamp01(plin([[400, 0], [180, 0.75], [60, 0.6], [1, 0.4]], ya));
    const horizon = mixHex(mixHex(0x131a28, 0xc7a479, day), 0x8d6a44, smog * 0.7);
    const bandLift = 0.16 + day * 0.14;
    return {
      day,
      horizon,
      bandLift,
      top: mixHex(mixHex(0x05070e, 0x27578f, day), 0x3b342a, smog * 0.55),
      // The dome's lower hemisphere is NOT dark, and that is deliberate. The
      // ground only ever ends where its disc runs out, which from altitude is
      // well above the true horizon — so whatever is painted below the horizon
      // is what shows in that gap. Dark there drew a bright rim against a black
      // band: a glowing dome edge across the middle of every aerial beat.
      // Ground rim and sky below it are now the same colour, so the seam has
      // nothing to show.
      bottom: scaleHex(horizon, 0.85),
      sunGain: 0.1 + day * 0.42,
      seam: scaleHex(horizon, 0.85),
      light: mixHex(0xffb277, 0xffe0b4, day),
    };
  };

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
        // Gated on the FRAME, not on u. Every night scene above ground (the
        // campfire at 260 m, the cities at 5–7 km) keeps its stars; the
        // seafloor at a 6 m frame does not, because stars underwater in
        // daylight is the single most illusion-breaking thing in the journey.
        opacity: ({ local, rebase }) => {
          const f = rebase.frameMeters();
          return band(local, 0, 0.06) * 0.45 * Math.min(1, Math.max(0, (f - 60) / 140));
        },
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
    // The cold molecular cloud the Sun condenses out of. A DARK layer: these
    // clouds are visible in the sky as holes in the Milky Way, and additive
    // blending cannot draw a hole — the first attempt was a grey glow that
    // brightened the very starfield it was supposed to blot out.
    L('molecular-cloud', ago(4.655e9), ago(4.545e9), () =>
      particleField({
        count: 5200,
        distribution: 'cloud',
        clumps: 34,
        clumpSpread: 0.19,
        seed: 109,
        blending: 'normal',
        colorA: 0x161a26,
        colorB: 0x05070c,
        size: 26,
        maxSize: 70,
        jitter: 0.01,
        // Contracts as it collapses — the beat's first sentence, as a number.
        radiusMeters: ({ local, rebase }) => rebase.frameMeters() * plin([[0, 1.5], [1, 0.55]], local),
        opacity: ({ local }) => band(local, 0.05, 0.2, 0.72, 0.95) * 0.55,
      })),
    // A dark cloud needs something to be dark AGAINST, and between the galaxy
    // leaving the band and the disc arriving there is nothing else in frame.
    // Star-forming regions really do glow — this is the emission nebula the
    // dark lanes sit in front of, and it is what keeps the dive from being a
    // black screen.
    L('cloud-glow', ago(4.655e9), ago(4.55e9), () =>
      particleField({
        count: 3400,
        distribution: 'cloud',
        clumps: 18,
        clumpSpread: 0.26,
        seed: 113,
        colorA: 0xff9a6a,
        colorB: 0x5a3ea8,
        colorMode: 'random',
        size: 16,
        maxSize: 44,
        twinkle: 0.15,
        radiusMeters: ({ local, rebase }) => rebase.frameMeters() * plin([[0, 1.3], [1, 0.5]], local),
        opacity: ({ local }) => band(local, 0.04, 0.18, 0.7, 0.94) * 0.32,
      })),

    // The knot at its centre brightening into a star.
    L('protostar', ago(4.60e9), ago(4.54e9), () =>
      glowSphere({
        radiusMeters: ({ local, rebase }) => rebase.frameMeters() * plin([[0, 0.03], [1, 0.09]], local),
        color: 0xfff0d2,
        haloColor: 0xffb267,
        haloScale: 8,
        opacity: ({ local }) => band(local, 0.1, 0.4, 0.8, 0.97) * 0.9,
      })),

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
            // Molten after accretion, crusting over, then RE-MELTED by the
            // giant impact — which is what actually happened, and gives the
            // strike a visible consequence on Earth rather than only beside it.
            // Must be gone by the 4.4 Gyr "Oceans" beat: a magma ocean and
            // liquid water cannot share a frame.
            magma: plin([
              [4.55e9, 1], [4.520e9, 0.72], [4.5045e9, 0.72], [4.5030e9, 1],
              [4.47e9, 0.92], [4.42e9, 0.25], [4.38e9, 0],
            ], ya),
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

    // --- the Moon-forming impact ---------------------------------------------
    // An EVENT, staged in three phases across its own beat, not an aftermath.
    // The beat says "a Mars-sized body strikes the young Earth… the debris
    // thrown into orbit coalesces", and what used to be on screen was a molten
    // globe with a small dark disc parked beside it — no impactor, no impact,
    // no debris, nothing that happens.
    //
    // Everything below is keyed on years-before-present rather than on layer
    // progress, so the sequence stays welded to the science even when a segment
    // weight moves. The scale law holds 4.2e7 m dead still across all of it.
    //
    //   4.5175 → 4.5045 Gyr ago   Theia closes on a collision course
    //   4.5045 → 4.5030            the strike: a flash, and the impactor is gone
    //   4.5030 → 4.4700            a debris ring contracts and becomes the Moon
    //
    // Theia is named after the Titan who mothered the Moon, and is the standard
    // name for the impactor in the giant-impact hypothesis. Radius ~0.53 Earth
    // is the Mars-sized body the models want.
    L('theia', ago(4.521e9), ago(4.500e9), () =>
      planet({
        radiusMeters: 3.4e6,
        offsetMeters: ({ u }) => plin([
          [4.5175e9, [3.75e7, 1.62e7, -1.5e7]],
          [4.5045e9, [0.98e7, 0.44e7, -0.3e7]], // contact: Earth radius + its own
        ], yaAt(u)),
        // Same light direction as Earth. Two bodies with the same terminator
        // angle read as one system; two with different ones read as a collage.
        lightDir: [0.78, 0.16, 0.6],
        rock: 0x4a3a2e,
        atmosphere: 0xff7a3a,
        spin: 0.08,
        segments: 64,
        surface: () => ({ magma: 1, seaLevel: -1, green: 0, ice: 0, night: 0, atmosphere: 0.5 }),
        // Fully gone BEFORE the flash starts rising. Overlapping them left a
        // hard dark disc in the middle of the fireball: planet writes depth
        // even at 4% opacity, so a fading impactor still punches a hole in the
        // additive flash sprite behind it.
        opacity: ({ u }) => plin([
          [4.5200e9, 0], [4.5165e9, 1], [4.5062e9, 1], [4.5050e9, 0],
        ], yaAt(u)),
      })),

    // The strike. Brief and very bright — the whole point of a flash is that it
    // is over before you have finished registering it.
    L('impact-flash', ago(4.508e9), ago(4.494e9), () =>
      glowSphere({
        radiusMeters: 1.05e7,
        offsetMeters: [0.72e7, 0.32e7, 0],
        color: 0xffffff,
        haloColor: 0xffd9a0,
        haloScale: 5,
        opacity: ({ u }) => plin([
          [4.5050e9, 0], [4.5038e9, 1], [4.5024e9, 0.3], [4.4985e9, 0],
        ], yaAt(u)),
      })),

    // The debris ring: contracting, cooling, and thinning out as its material
    // ends up in one place. Real coalescence took perhaps a century — instant
    // at this scale — so the pacing here is editorial, not physical.
    L('impact-debris', ago(4.506e9), ago(4.455e9), () =>
      particleField({
        count: 9000,
        distribution: 'disk',
        // An annulus, not a filled disc. Filled, it read as a spray blowing
        // across the frame rather than as material in ORBIT — and the orbit is
        // the whole reason the debris ends up as one body.
        innerRadius: 0.52,
        thickness: 0.09,
        seed: 137,
        colorA: 0xffd2a0,
        colorB: 0xc03a12,
        size: 2.6,
        maxSize: 8,
        twinkle: 0.3,
        spin: 0.22,
        radiusMeters: ({ u }) => plog([
          [4.5045e9, 4.4e7], [4.4900e9, 2.7e7], [4.4700e9, 2.35e7],
        ], yaAt(u)),
        opacity: ({ u }) => plin([
          [4.5048e9, 0], [4.5030e9, 0.85], [4.4880e9, 0.5], [4.4650e9, 0],
        ], yaAt(u)) * 0.8,
      })),

    // The Moon itself. Built from the planet archetype rather than a glowing
    // sphere: an unlit basic material renders as a flat grey disc, and the Moon
    // sharing Earth's light direction — same terminator, same angle — is most of
    // what sells the two of them as one system.
    //
    // It formed roughly four Earth-radii out and has been receding ever since
    // (measured today, by laser, at 3.8 cm/year). The frame is 42,000 km wide
    // here, so the true early Earth–Moon system fits with the Moon ~125 px
    // across; as the scale law closes in on Earth it leaves the frame on its
    // own, which is the honest thing for it to do rather than parking it at a
    // flattering fake distance.
    L('moon', ago(4.503e9), ago(4.25e9), () =>
      planet({
        radiusMeters: 1.737e6,
        // Starts at the debris ring's radius — the Moon condenses OUT of the
        // ring, so it must first appear where the ring is, not somewhere else.
        // plin, not plog: plog cannot interpolate a vector (it would try to
        // raise an array to a power and silently produce string concatenation).
        // 2.2e7 m is 3.45 Earth radii — the low end of the 3–5 the giant-impact
        // models give, chosen because it is also what keeps the Moon inside the
        // right edge of the frame. Both constraints are real; this satisfies
        // them without inventing a distance.
        offsetMeters: ({ u }) => plin([
          [4.4950e9, [2.50e7, 0.28e7, 0]], [4.4700e9, [2.20e7, 0.16e7, 0]], [4.2e9, [4.20e7, 0, 0]],
        ], yaAt(u)),
        lightDir: [0.78, 0.16, 0.6],
        rock: 0x6e6a63,
        spin: 0.01,
        segments: 48,
        surface: ({ u }) => ({
          // Still glowing when it forms; cooled within a few tens of Myr.
          magma: plin([[4.4950e9, 0.85], [4.4650e9, 0]], yaAt(u)),
          seaLevel: -1, green: 0, ice: 0, night: 0, atmosphere: 0,
        }),
        opacity: ({ u, local }) =>
          plin([[4.5010e9, 0], [4.4930e9, 0.3], [4.4750e9, 1]], yaAt(u)) * band(local, 0, 0.02, 0.6, 0.95),
      })),

    // --- the Hadean sea ------------------------------------------------------
    // "Oceans" opens on the globe and then falls to the water. The evidence the
    // copy cites — 4.4 Gyr zircons carrying a water signature — is evidence
    // about a SURFACE, so the beat should end on one.
    // Both gated on the FRAME, not on u — the same trick the savanna ground
    // uses. Keyed on years alone they left a black gap in the middle of the
    // beat: Earth drops off the rebase band as soon as the frame passes ~5e5 m,
    // and a sky keyed to arrive at 4.05 Gyr was still 150 Myr away.
    L('hadean-sky', ago(4.28e9), ago(3.45e9), () =>
      backdrop({
        radiusFrames: 7,
        top: 0x2a1410,
        horizon: 0x8c3a18,
        bottom: 0x140806,
        sunColor: 0xffb066,
        sunDir: [0.6, 0.22, -0.55],
        sunSize: 0.995,
        sunSoft: 0.02,
        sunGain: 0.55,
        bandLift: 0.7,
        opacity: ({ local, rebase }) =>
          band(local, 0.02, 0.08, 0.86, 0.97) * clamp01((3.0e4 - rebase.frameMeters()) / 2.4e4),
      })),
    L('hadean-sea', ago(4.28e9), ago(3.45e9), () =>
      water({
        radiusMeters: 900,
        levelMeters: 0,
        waveMeters: 0.55,
        wavelengthMeters: 14,
        deep: 0x1a0c0a,
        sky: 0x8a4020,
        sunColor: 0xffc07a,
        sunDir: [0.6, 0.22, -0.55],
        sunGain: 1.0,
        opacity: ({ local, rebase }) =>
          band(local, 0.02, 0.08, 0.86, 0.97) * clamp01((2.0e3 - rebase.frameMeters()) / 1.4e3),
      })),
    // Rain and steam. Both are point fields with NORMAL blending — additive
    // could only ever brighten the sky it is supposed to be hanging in front of.
    L('hadean-rain', ago(4.02e9), ago(3.5e9), () =>
      particleField({
        count: 2600,
        distribution: 'ball',
        seed: 151,
        blending: 'normal',
        colorA: 0x9fb0bc,
        colorB: 0x60707c,
        colorMode: 'random',
        size: 1.1,
        maxSize: 3,
        jitter: 0.04,
        radiusMeters: 150,
        offsetMeters: [0, 60, 0],
        respectBand: false,
        opacity: ({ local }) => band(local, 0.08, 0.24, 0.84, 0.96) * 0.5,
      })),
    L('hadean-steam', ago(4.02e9), ago(3.5e9), () =>
      particleField({
        count: 700,
        distribution: 'cloud',
        clumps: 22,
        clumpSpread: 0.14,
        seed: 157,
        blending: 'normal',
        colorA: 0x6e5044,
        colorB: 0x2e201c,
        size: 14,
        maxSize: 40,
        jitter: 0.02,
        radiusMeters: 210,
        offsetMeters: [0, 26, 0],
        respectBand: false,
        opacity: ({ local }) => band(local, 0.08, 0.26, 0.84, 0.96) * 0.3,
      })),

    // --- stromatolites -------------------------------------------------------
    // The oldest thing in the fossil record that a reader can actually look at:
    // layered microbial mats, still growing in Shark Bay today. Shallow water,
    // backlit from a surface a couple of metres up.
    L('archean-water', ago(3.72e9), ago(2.02e9), () =>
      backdrop({
        radiusFrames: 7,
        top: 0x8a6a3e,
        horizon: 0x4a4230,
        bottom: 0x0c1014,
        sunColor: 0xc8a870,
        sunDir: [0.3, 0.92, -0.22],
        sunSize: 0.86,
        sunSoft: 0.5,
        sunGain: 0.3,
        bandLift: 0.4,
        // The sky loses its Hadean orange as the atmosphere clears, over more
        // than a billion years — this drive is the only place that shows it.
        drive: ({ u }) => ({
          top: yaAt(u) > 2.5e9 ? 0x8a6a3e : 0x3f5f78,
          horizon: yaAt(u) > 2.5e9 ? 0x4a4230 : 0x28405a,
        }),
        opacity: ({ local }) => band(local, 0.02, 0.09, 0.9, 0.99),
      })),
    L('archean-floor', ago(3.72e9), ago(2.02e9), () =>
      terrain({
        radiusMeters: 26,
        ampMeters: 0.9,
        featureMeters: 6,
        flattenMeters: 12,
        seed: 41,
        haze: 0x121a1e,
        rock: 0x2f3338,
        dry: 0x4a4436,
        lightDir: [0.3, 0.7, -0.25],
        lightColor: 0xc4b083,
        surface: () => ({ sun: 0.95, cover: 0, fields: 0, urban: 0 }),
        opacity: ({ local }) => band(local, 0.02, 0.09, 0.9, 0.99),
      })),
    L('archean-ceiling', ago(3.72e9), ago(2.02e9), () =>
      water({
        radiusMeters: 90,
        levelMeters: 2.4,
        waveMeters: 0.09,
        wavelengthMeters: 1.6,
        chop: 1.1,
        below: 0x14181a,
        windowColor: 0xd0b47e,
        sunColor: 0xe8d2a4,
        sunDir: [0.26, 0.94, -0.2],
        sunGain: 0.45,
        drive: ({ u }) => ({
          windowColor: yaAt(u) > 2.5e9 ? 0xd0b47e : 0x9fc4dc,
        }),
        opacity: ({ local }) => band(local, 0.02, 0.09, 0.9, 0.99) * 0.9,
      })),
    L('stromatolites', ago(3.72e9), ago(2.02e9), () =>
      silhouette({
        kind: 'dome',
        count: 54,
        variants: 5,
        seed: 47,
        areaMeters: 6.5,
        heightMeters: [0.35, 1.05],
        aspect: 1.5, // wider than tall — that is what makes a mound a mound
        centreClear: 1.2,
        nearFadeMeters: 2.0,
        color: 0x0a0b0c,
        rim: 0x8a7448,
        opacity: ({ local }) => band(local, 0.03, 0.12, 0.9, 0.99),
      })),

    // --- the oxygen catastrophe ----------------------------------------------
    // Cyanobacteria venting oxygen. Bubble columns off the mats are the beat's
    // subject at close range; the pull-out afterwards is where it becomes a
    // planetary event.
    L('oxygen-bubbles', ago(2.42e9), ago(2.05e9), () =>
      blob({
        count: 90,
        radiusMeters: [0.02, 0.075],
        areaMeters: 5,
        seed: 53,
        offsetMeters: ({ t }) => [0, 1.0 + ((t * 0.22) % 1.1), 0],
        wobble: 0.16,
        fill: 0x16323f,
        rim: 0xbfe8ff,
        rimPower: 2.1,
        fillAlpha: 0.06,
        opacity: ({ local }) => band(local, 0.05, 0.18, 0.78, 0.95) * 0.85,
      })),

    // --- cells within cells --------------------------------------------------
    // Twenty microns across. The frame arrives here from a two-kilometre sea
    // view eight decades earlier in the same continuous move, which is the one
    // thing this engine can do that a cut-based explainer cannot.
    L('cell-host', ago(1.5e9), ago(660e6), () =>
      blob({
        count: 1,
        radiusMeters: 7.5e-6,
        seed: 59,
        wobble: 0.05,
        fill: 0x123a44,
        rim: 0x8fe6d8,
        rimPower: 2.8,
        fillAlpha: 0.09,
        opacity: ({ local }) => band(local, 0.05, 0.16, 0.86, 0.97),
      })),
    // The captive: an alpha-proteobacterium being engulfed, and not digested.
    // Its whole story is one number — the offset that carries it inside.
    L('cell-captive', ago(1.5e9), ago(660e6), () =>
      blob({
        count: 1,
        radiusMeters: 2.1e-6,
        seed: 61,
        wobble: 0.09,
        offsetMeters: ({ u }) => plin([
          [1.46e9, [1.55e-5, 0.5e-5, 0]],   // outside, approaching
          [1.30e9, [0.42e-5, 0.12e-5, 0]],  // through the membrane
          [1.05e9, [0.30e-5, -0.05e-5, 0]], // resident: the mitochondrion
        ], yaAt(u)),
        fill: 0x3a2418,
        rim: 0xffb877,
        rimPower: 2.2,
        fillAlpha: 0.16,
        opacity: ({ local }) => band(local, 0.06, 0.18, 0.86, 0.97),
      })),
    L('cell-organelles', ago(1.45e9), ago(660e6), () =>
      blob({
        count: 14,
        radiusMeters: [0.35e-6, 0.9e-6],
        areaMeters: 4.6e-6,
        seed: 67,
        wobble: 0.13,
        fill: 0x1d4450,
        rim: 0x74c8d8,
        rimPower: 2.0,
        fillAlpha: 0.12,
        opacity: ({ local }) => band(local, 0.08, 0.22, 0.86, 0.97) * 0.75,
      })),
    // Cytoplasmic granules — the same job the marine snow does for water: they
    // give an otherwise empty interior a sense of being a medium.
    L('cell-motes', ago(1.45e9), ago(660e6), () =>
      particleField({
        count: 900,
        distribution: 'ball',
        seed: 71,
        colorA: 0xa8e0e8,
        colorB: 0x3c7c8c,
        colorMode: 'random',
        size: 1.4,
        maxSize: 4,
        jitter: 0.02,
        twinkle: 0.4,
        radiusMeters: 6.6e-6,
        opacity: ({ local }) => band(local, 0.08, 0.22, 0.86, 0.97) * 0.4,
      })),

    // --- the seafloor era ----------------------------------------------------
    // PROTOTYPE SLICE. Proving the backdrop+silhouette pair on the Ediacaran
    // and Cambrian beats before the same treatment goes to the rest of the
    // globe-locked life era.
    //
    // One seafloor serves both beats, and the STORY is what changes on it:
    // fronds alone for the Ediacaran, then animals arriving over them. That
    // transition is the Cambrian explosion, told by the layer envelopes rather
    // than by a cut.
    L('sea-water', ago(650e6), ago(470e6), () =>
      backdrop({
        radiusFrames: 7,
        // seen from below, the sea surface is the bright thing overhead and
        // the deep is the dark thing below — the gradient is inverted from sky
        top: 0x4d7fa8,
        horizon: 0x1d3f5e,
        bottom: 0x040a12,
        sunColor: 0x9fd0e8,
        sunDir: [0.35, 0.9, -0.25],
        sunSize: 0.86,
        sunSoft: 0.5,
        // The surface overhead is a POOL tens of degrees across, not a sun. At
        // full gain it was a white blob over a third of the frame that blew out
        // the entire scene; a source this broad has to be dim.
        sunGain: 0.22,
        bandLift: 0.35,
        opacity: ({ local }) => band(local, 0.03, 0.12, 0.88, 0.98),
      })),
    L('sea-floor', ago(650e6), ago(470e6), () =>
      terrain({
        // 40 m, not 60: the haze ramp is a fraction of the radius, so shrinking
        // the disc is what brings the murk in to a believable underwater
        // visibility of twenty-odd metres.
        radiusMeters: 40,
        ampMeters: 1.5,
        featureMeters: 9,
        // Both of the seabed's defaults were savanna numbers, and both were
        // catastrophic at 60 m. The flatten radius defaults to 600 m — larger
        // than this entire world — so `lift` was zero everywhere and the ground
        // had literally no relief; and the colour wavelengths were fixed at
        // 420/90 m, so it had no texture either. Hence a flat brown gradient.
        //
        // The flat radius must still COVER THE CAST. Silhouettes stand at y=0
        // and have no ground-following, so any relief inside the scatter radius
        // buries them — at 2.5 m of flatten the entire Ediacaran meadow was
        // underground and the camera was inside a hill.
        flattenMeters: 18,
        seed: 11,
        haze: 0x0e2740, // underwater visibility is short; the haze is close
        rock: 0x38414d,
        dry: 0x5b5442, // grey-brown sediment, not savanna gold
        // Light from above but well off vertical: straight down leaves every
        // face at the same incidence and the new relief would not show.
        lightDir: [0.35, 0.62, -0.3],
        // Thirty metres of water has taken the red out of it.
        lightColor: 0x8ec4d8,
        surface: () => ({ sun: 0.62, cover: 0, fields: 0, urban: 0 }),
        opacity: ({ local }) => band(local, 0.03, 0.12, 0.88, 0.98),
      })),
    // Ediacaran fronds: the whole cast for beat 26, thinning as animals arrive.
    L('ediacaran-fronds', ago(650e6), ago(470e6), () =>
      silhouette({
        kind: 'frond',
        // Pushed back and multiplied. At centreClear 1.4 the nearest fronds sat
        // six metres from the lens and rendered as a couple of dark masses
        // cropped by the frame edge; the Ediacaran should read as a MEADOW.
        count: 56,
        variants: 5,
        seed: 23,
        areaMeters: 16,
        heightMeters: [0.25, 0.95],
        aspect: 0.8,
        centreClear: 2.6,
        nearFadeMeters: 4.5,
        sway: 0.045,
        color: 0x050910,
        rim: 0x39628a,
        opacity: ({ u, local }) =>
          band(local, 0.05, 0.16, 0.9, 0.99) * plin([[640e6, 1], [545e6, 1], [500e6, 0.55]], yaAt(u)),
      })),
    // …and the animals, arriving on the Cambrian beat.
    L('cambrian-swimmers', ago(575e6), ago(470e6), () =>
      silhouette({
        kind: 'segmented',
        count: 22,
        variants: 6,
        seed: 17,
        areaMeters: 10,
        // centreClear keeps swimmers off the lens: without it the nearest
        // instances sit a metre from the camera and clip out of frame as
        // unreadable slabs.
        centreClear: 3.2,
        nearFadeMeters: 5.0,
        heightMeters: [0.3, 0.85],
        aspect: 2.1,
        yMeters: 1.4,
        spreadY: 2.0,
        color: 0x04070c,
        rim: 0x4a7ba6,
        opacity: ({ u, local }) =>
          band(local, 0.04, 0.14, 0.9, 0.99) * plin([[570e6, 0], [540e6, 0.35], [515e6, 1]], yaAt(u)),
      })),
    // The sea surface, TEN METRES OVERHEAD. Without it the backdrop's gradient
    // reads as a dusk sky and the whole scene as a prairie: nothing else in the
    // frame says the camera is submerged. Snell's window — the bright cone
    // directly above, everything outside it a dark mirror — is the one cue that
    // cannot be mistaken for anything else.
    L('sea-ceiling', ago(650e6), ago(470e6), () =>
      water({
        radiusMeters: 130,
        levelMeters: 10,
        waveMeters: 0.18,
        wavelengthMeters: 2.2,
        chop: 1.15,
        below: 0x0b1f2f,
        windowColor: 0xa6cfe6,
        sunColor: 0xd6ecf8,
        sunDir: [0.28, 0.93, -0.24],
        sunGain: 0.5,
        opacity: ({ local }) => band(local, 0.03, 0.12, 0.88, 0.98) * 0.92,
      })),
    // marine snow — the drifting motes that make water read as water
    L('sea-motes', ago(650e6), ago(470e6), () =>
      particleField({
        count: 700,
        distribution: 'ball',
        seed: 29,
        colorA: 0xbcd8ea,
        colorB: 0x6f9ec0,
        colorMode: 'random',
        size: 1.5,
        maxSize: 4,
        jitter: 0.012,
        twinkle: 0.35,
        radiusMeters: 9,
        offsetMeters: [0, 2.5, 0],
        opacity: ({ local }) => band(local, 0.05, 0.16, 0.9, 0.99) * 0.45,
      })),

    // --- out of the water ----------------------------------------------------
    // The hinge of the whole life era. It starts underwater and ends on land,
    // because that is literally what the beat is about — and the camera goes
    // through the surface rather than cutting across it, which is the entire
    // reason the water archetype draws both sides.
    //
    // The crossing itself is done by the scale law: the camera sits at a fixed
    // 0.34 world units, so as the frame widens 15 m → 150 m it climbs from
    // 1.3 m below the waterline to 13 m above it, somewhere around 443 Mya.
    L('devonian-sky', ago(490e6), ago(240e6), () =>
      backdrop({
        radiusFrames: 7,
        top: 0x1d3f66,
        horizon: 0x5f7c92,
        bottom: 0x101a1e,
        sunColor: 0xffe1ac,
        sunDir: [0.62, 0.3, -0.5],
        sunSize: 0.995,
        sunSoft: 0.02,
        sunGain: 0.45,
        bandLift: 0.3,
        // Below the surface this dome IS the water, so it starts as the
        // Cambrian gradient and becomes a sky as the camera comes out.
        drive: ({ u }) => {
          const ya = yaAt(u);
          const air = clamp01(plin([[462e6, 0], [430e6, 1]], ya));
          return {
            top: air > 0.5 ? 0x1d3f66 : 0x2d4c6a,
            horizon: air > 0.5 ? 0x5f7c92 : 0x22445f,
            bottom: air > 0.5 ? 0x101a1e : 0x040a12,
            sunGain: 0.2 + air * 0.25,
            bandLift: 0.28 + air * 0.06,
          };
        },
        opacity: ({ local }) => band(local, 0.02, 0.10, 0.9, 0.99),
      })),
    L('shore-ground', ago(486e6), ago(245e6), () =>
      terrain({
        radiusMeters: 420,
        ampMeters: 8,
        featureMeters: 70,
        flattenMeters: 150,
        seed: 29,
        rock: 0x4a4238,
        lightDir: [0.5, 0.5, -0.35],
        segments: 200,
        surface: ({ u }) => {
          const ya = yaAt(u);
          const air = clamp01(plin([[462e6, 0], [430e6, 1]], ya));
          return {
            // Submerged, the ground is lit blue-green through water; in air it
            // is lit by the sun. One terrain spans the crossing, so both the
            // tint and the haze have to be driven rather than fixed at build.
            lightColor: air > 0.5 ? 0xffd9a8 : 0x8ec4d8,
            haze: air > 0.5 ? 0x8ea6b4 : 0x14324a,
            dry: air > 0.5 ? 0x6b6046 : 0x54503f,
            sun: 0.55 + air * 0.35,
            // Bare rock until plants colonise it, then soil and cover — the
            // beat's actual subject, on the ground it happens to.
            cover: plin([[470e6, 0], [430e6, 0.25], [380e6, 0.8], [250e6, 0.7]], ya),
            fields: 0,
            urban: 0,
          };
        },
        opacity: ({ local }) => band(local, 0.02, 0.09, 0.9, 0.99),
      })),
    // The sea itself, retreating below the lens. Level drops a little as well
    // as the camera rising, so the crossing does not depend on one mechanism.
    L('shore-water', ago(482e6), ago(330e6), () =>
      water({
        radiusMeters: 300,
        // Drops faster than it used to. The beat's own midpoint is 446 Myr, and
        // with the old curve that landed mid-crossing — the frame all water and
        // all sky, both the same pale blue, which is why this beat read as fog.
        // It now lands on the SHORE, which is what the beat is about.
        levelMeters: ({ u }) => plin([[480e6, 5.4], [460e6, 3.2], [448e6, 1.4], [420e6, 0.5], [360e6, 0.2]], yaAt(u)),
        waveMeters: 0.14,
        wavelengthMeters: 4,
        chop: 1.2,
        segments: 200,
        deep: 0x0b2231,
        sky: 0x6f8ea6,
        below: 0x0b1f2c,
        windowColor: 0xa8cfe4,
        sunColor: 0xffeccb,
        sunDir: [0.5, 0.62, -0.45],
        sunGain: 0.4,
        opacity: ({ local }) => band(local, 0.03, 0.11, 0.82, 0.96),
      })),
    // Low plants first — the copy is explicit that plants go ashore before
    // anything with a spine does.
    L('shore-reeds', ago(462e6), ago(300e6), () =>
      silhouette({
        kind: 'reed',
        count: 150,
        variants: 6,
        seed: 73,
        areaMeters: 70,
        heightMeters: [0.5, 2.4],
        centreClear: 5,
        nearFadeMeters: 8,
        sway: 0.05,
        color: 0x0b1410,
        rim: 0x5c7a58,
        // Arriving with the waterline, not thirty million years after it — the
        // shore has to have something standing on it the moment it appears.
        opacity: ({ u, local }) =>
          band(local, 0.05, 0.16, 0.88, 0.98) * plin([[466e6, 0], [444e6, 1], [330e6, 0.6]], yaAt(u)),
      })),
    // …then the first forests. Archaeopteris, the Devonian tree that built the
    // first real soils — which is why the beat says oxygen climbs steeply.
    L('devonian-forest', ago(436e6), ago(258e6), () =>
      silhouette({
        kind: 'tree',
        count: 120,
        variants: 6,
        seed: 79,
        areaMeters: 210,
        heightMeters: [5, 24],
        centreClear: 22,
        nearFadeMeters: 30,
        sway: 0.02,
        color: 0x0a0f0c,
        rim: 0x4e6a58,
        opacity: ({ u, local }) =>
          band(local, 0.05, 0.18, 0.86, 0.97) * plin([[434e6, 0], [385e6, 1], [262e6, 0.85]], yaAt(u)),
      })),

    // --- the Great Dying -----------------------------------------------------
    // The Siberian Traps: several million cubic kilometres of basalt, erupted
    // through a coalfield. The kill mechanism is in the copy — carbon, acid,
    // anoxia — but what you can SEE is fissures to the horizon and an ash sky.
    // Sky and ground run to 48 Myr, not to 180. Beat 29 spans 252 → 66 Myr, so
    // its own midpoint is 138 Myr — Jurassic — and layers that stopped at 180
    // left the middle of the beat as a black frame. The eruption fades; the
    // world it left does not, and the sky clearing from ash to blue over eighty
    // million years is the recovery the copy talks about.
    L('traps-sky', ago(268e6), ago(48e6), () =>
      backdrop({
        radiusFrames: 7,
        top: 0x140f0c,
        horizon: 0x5a3320,
        bottom: 0x0a0705,
        sunColor: 0xc46a30,
        sunDir: [0.6, 0.16, -0.5],
        sunSize: 0.994,
        sunSoft: 0.03,
        sunGain: 0.3,
        bandLift: 0.5,
        drive: ({ u }) => trapsSkyAt(yaAt(u)),
        opacity: ({ local }) => band(local, 0.04, 0.14, 0.9, 0.98),
      })),
    L('traps-ground', ago(268e6), ago(48e6), () =>
      terrain({
        radiusMeters: 9e4,
        ampMeters: 900,
        featureMeters: 7e3,
        flattenMeters: 1.2e4,
        seed: 83,
        haze: 0x22140e,
        rock: 0x241d19,
        dry: 0x2c2420,
        lavaHot: 0xff5a10,
        lightDir: [0.6, 0.3, -0.4],
        lightColor: 0xd8a070,
        segments: 220,
        surface: ({ u }) => {
          const ya = yaAt(u);
          return {
            haze: trapsSkyAt(ya).seam,
            lava: plin([[268e6, 0], [255e6, 1], [246e6, 0.9], [200e6, 0]], ya),
            // Life comes back — ten million years, as the copy says — and then
            // the K–Pg strips it again.
            cover: plin([[252e6, 0], [240e6, 0.15], [180e6, 0.7], [66.6e6, 0.7], [65.8e6, 0.08]], ya),
            sun: plin([[268e6, 0.28], [200e6, 0.42], [100e6, 0.5], [66.6e6, 0.5], [65.8e6, 0.12]], ya),
            lightColor: 0xd8a070,
            fields: 0,
            urban: 0,
          };
        },
        opacity: ({ local }) => band(local, 0.03, 0.12, 0.90, 0.98),
      })),
    L('traps-ash', ago(264e6), ago(190e6), () =>
      particleField({
        count: 1800,
        distribution: 'cloud',
        clumps: 26,
        clumpSpread: 0.12,
        seed: 89,
        blending: 'normal',
        colorA: 0x2e241e,
        colorB: 0x120d0a,
        size: 18,
        maxSize: 46,
        jitter: 0.02,
        radiusMeters: 2.2e4,
        offsetMeters: [0, 5.5e3, 0],
        respectBand: false,
        opacity: ({ local }) => band(local, 0.06, 0.2, 0.84, 0.96) * 0.45,
      })),
    // Dead snags. The same tree routine, sparse and unlit — a forest that has
    // stopped being one.
    L('traps-snags', ago(262e6), ago(200e6), () =>
      silhouette({
        kind: 'tree',
        count: 55,
        variants: 5,
        seed: 97,
        areaMeters: 4.5e3,
        heightMeters: [90, 320],
        centreClear: 500,
        nearFadeMeters: 700,
        color: 0x080605,
        rim: 0x7a3a18,
        opacity: ({ local }) => band(local, 0.06, 0.2, 0.8, 0.95) * 0.9,
      })),

    // Forest, as TEXTURE. At a five-to-twenty-kilometre frame an individual
    // tree is a fraction of a pixel, so the Mesozoic and the Paleogene recovery
    // cannot be populated the way the savanna beats are. A dark point field
    // lying on the ground reads as canopy at exactly the scales where geometry
    // does not — the inverse of the trick the settlement lamps use, and the
    // difference between "a world" and "a bare plain".
    L('forest-cover', ago(200e6), ago(9e6), () =>
      particleField({
        count: 5000,
        distribution: 'disk',
        thickness: 0.0015,
        seed: 167,
        blending: 'normal',
        colorA: 0x1b2a18,
        colorB: 0x0d1610,
        colorMode: 'random',
        size: 10,
        maxSize: 26,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 2.4,
        respectBand: false,
        opacity: ({ u, local }) =>
          band(local, 0.03, 0.12, 0.9, 0.99)
          * plin([[180e6, 0.75], [67e6, 0.75], [65e6, 0.05], [40e6, 0.5], [12e6, 0.6]], yaAt(u)),
      })),

    // --- ten kilometres of rock ----------------------------------------------
    // Chicxulub. Staged like the Moon-forming impact: an approach, a strike, an
    // aftermath — the pattern that beat established.
    L('kpg-bolide', ago(67e6), ago(65.8e6), () =>
      glowSphere({
        radiusMeters: 6e3,
        offsetMeters: ({ u }) => plin([
          [66.9e6, [3.4e4, 2.6e4, -1.2e4]],
          [66.2e6, [0.4e4, 0.15e4, 0]],
        ], yaAt(u)),
        color: 0xfff2d0,
        haloColor: 0xffa64a,
        haloScale: 6,
        opacity: ({ u }) => plin([
          [67.0e6, 0], [66.85e6, 1], [66.25e6, 1], [66.15e6, 0],
        ], yaAt(u)),
      })),
    L('kpg-flash', ago(66.4e6), ago(64e6), () =>
      glowSphere({
        radiusMeters: 9e4,
        color: 0xffffff,
        haloColor: 0xffd9a0,
        haloScale: 5,
        opacity: ({ u }) => plin([
          [66.25e6, 0], [66.1e6, 1], [65.8e6, 0.25], [65e6, 0],
        ], yaAt(u)),
      })),
    // The shockwave, as an expanding ring on the ground.
    L('kpg-shock', ago(66.3e6), ago(62e6), () =>
      particleField({
        count: 7000,
        distribution: 'disk',
        innerRadius: 0.82,
        thickness: 0.03,
        seed: 101,
        colorA: 0xffd2a0,
        colorB: 0xa03810,
        size: 3.0,
        maxSize: 9,
        radiusMeters: ({ u }) => plog([[66.15e6, 6e3], [65.4e6, 5.5e4], [64e6, 1.4e5]], yaAt(u)),
        opacity: ({ u }) => plin([
          [66.2e6, 0], [66.05e6, 0.9], [65.2e6, 0.35], [63.5e6, 0],
        ], yaAt(u)),
      })),
    // Then years of dust. Normal blending, because this layer's whole job is to
    // take light OUT of the sky.
    L('kpg-dust', ago(66.2e6), ago(40e6), () =>
      particleField({
        count: 2600,
        distribution: 'cloud',
        clumps: 30,
        clumpSpread: 0.16,
        seed: 103,
        blending: 'normal',
        colorA: 0x241c17,
        colorB: 0x0c0908,
        size: 22,
        maxSize: 60,
        jitter: 0.015,
        radiusMeters: 8e5,
        offsetMeters: [0, 1.6e5, 0],
        respectBand: false,
        opacity: ({ u, local }) =>
          band(local, 0.03, 0.12) * plin([[66.2e6, 0], [65.8e6, 0.85], [58e6, 0.5], [42e6, 0]], yaAt(u)),
      })),

    // --- the surface ---------------------------------------------------------
    // From the hominin beats to the industrial age the frame is 300 m – 25 km
    // and the world is a heightfield, not a globe. Earth (fixed at its real
    // radius) dissolves on the rebase band during the descent and re-forms
    // during the final pull-back, so the hand-off costs nothing.

    // One terrain serves the whole surface era; its ground cover, field
    // patchwork, urban centre and sun level are all driven by years-before-
    // present, the same pattern the planet uses for geological time.
    // THE SKY. There was none — from 48 Myr ago to the end of the journey every
    // beat rendered against the black stage with a starfield on it. A savanna at
    // noon, a wheat field, an industrial city and a night camp all came out as
    // the same dark empty plain, which is most of why this whole stretch read as
    // unfinished. One dome, driven through the era, fixes all of them at once.
    //
    // `day` is the same curve the ground's own sun level follows, so light and
    // sky can never disagree — the failure mode being a lit landscape under a
    // midnight sky, or the reverse.
    L('surface-sky', ago(58e6), ago(1.2), () =>
      backdrop({
        radiusFrames: 7,
        sunDir: [0.72, 0.24, -0.48],
        sunSize: 0.9975,
        sunSoft: 0.006,
        drive: ({ u }) => skyAt(yaAt(u)),
        // Out at the top: the final pull-back leaves the atmosphere, and a sky
        // dome has no business being on screen once Earth is a globe again.
        opacity: ({ local, rebase }) =>
          band(local, 0.02, 0.07) * clamp01((1.6e5 - rebase.frameMeters()) / 1.0e5),
      })),

    // Starts at 55 Myr rather than 30, to take the hand-off from the Mesozoic
    // ground before it has finished fading — otherwise the second half of the
    // K–Pg beat has no ground at all.
    L('ground', ago(55e6), ago(1.2), () =>
      terrain({
        radiusMeters: 3e4,
        ampMeters: 26,
        featureMeters: 1300,
        seed: 3,
        haze: 0x171420,
        lightDir: [0.7, 0.28, 0.5],
        // Entry and exit are keyed on the FRAME, not on u: the ground only
        // exists as a place once the frame is under ~40 km, and dissolves
        // again past it on the way back to orbit. This is what makes both
        // hand-offs with the planet cost nothing — Earth fades on the rebase
        // band at almost the same frame widths.
        opacity: ({ local, rebase }) => {
          const f = rebase.frameMeters();
          // Long entry ramp: the ground ghosts in from ~1.1e6 m frames so the
          // fall from orbit is never a black screen — there is always either a
          // dissolving planet or an approaching land haze in view.
          const lift = f > 6e4 ? Math.max(0, 1 - (f - 6e4) / 1.05e6) : 1;
          // …and yields at the bottom to the woodland ground below ~500 m. This
          // terrain is 30 km across with 1.3 km relief features; at an intimate
          // frame it is a single flat colour, which is the same defect the
          // seafloor had.
          const close = clamp01((f - 320) / 260);
          return band(local, 0.005, 0.02) * lift * close;
        },
        surface: ({ u }) => {
          const ya = yaAt(u);
          const sky = skyAt(ya);
          return {
            cover: plin([[30e6, 0.45], [2e6, 0.55], [12e3, 0.62], [5e3, 0.5], [260, 0.42], [1, 0.4]], ya),
            fields: plin([[14e3, 0], [10e3, 0.7], [6e3, 0.92], [600, 0.85], [120, 0.5], [1, 0.35]], ya),
            urban: plin([[6.4e3, 0], [5.2e3, 0.6], [900, 0.65], [260, 0.85], [1, 0.92]], ya),
            sun: sky.day,
            haze: sky.seam,
            lightColor: sky.light,
            // the level plain grows with the settlement that stands on it
            flatten: plin([[30e6, 600], [9e3, 900], [5.5e3, 1500], [3e3, 1800], [600, 5000], [280, 7000], [1, 7000]], ya),
          };
        },
      })),

    // --- woodland, at eye level ----------------------------------------------
    // The hominin beats happen at 40–200 m frames, and the 30 km savanna ground
    // cannot serve them: its relief features are 1.3 km and its colour
    // wavelengths hundreds of metres, so close up it is one flat brown sheet.
    // A second, small terrain takes over below ~500 m — the same split the
    // seafloor already uses, for the same reason.
    L('woodland-ground', ago(7.2e6), ago(88e3), () =>
      terrain({
        radiusMeters: 900,
        ampMeters: 5,
        featureMeters: 120,
        flattenMeters: 200, // must cover the tree and figure scatter — they stand at y=0
        seed: 131,
        rock: 0x483f31,
        dry: 0x6d5f3e,
        lightDir: [0.7, 0.3, 0.5],
        segments: 220,
        surface: ({ u }) => {
          const ya = yaAt(u);
          const sky = skyAt(ya);
          return {
            sun: sky.day,
            cover: plin([[7e6, 0.6], [2e6, 0.5], [300e3, 0.45]], ya),
            haze: sky.seam,
            lightColor: sky.light,
            fields: 0,
            urban: 0,
          };
        },
        opacity: ({ local, rebase }) =>
          band(local, 0.02, 0.08, 0.93, 0.99) * clamp01((580 - rebase.frameMeters()) / 260),
      })),
    // Open woodland — the habitat the split actually happened in. Trees are the
    // only thing at this scale that gives the frame depth: without them a
    // savanna is an empty plane no matter how well it is lit.
    L('woodland-trees', ago(7.0e6), ago(92e3), () =>
      silhouette({
        kind: 'tree',
        count: 80,
        variants: 6,
        seed: 137,
        areaMeters: 130,
        heightMeters: [3.5, 12],
        centreClear: 16,
        nearFadeMeters: 22,
        sway: 0.015,
        color: 0x0c120e,
        rim: 0x6d7a4e,
        opacity: ({ local, rebase }) =>
          band(local, 0.03, 0.12, 0.9, 0.99) * clamp01((520 - rebase.frameMeters()) / 240),
      })),
    // …and the subject of the beat. "There is no first human" — so they are a
    // scattered group, not a posed pair, and they are silhouettes because at
    // twenty-odd pixels tall the upright STANCE is the only thing that carries
    // and the only thing the science actually claims.
    L('hominins', ago(6.7e6), ago(1.5e6), () =>
      silhouette({
        kind: 'figure',
        count: 6,
        variants: 5,
        seed: 139,
        // Scattered from 9 m to 40 m out. The camera sits ~62 m from the origin
        // at this frame, so the near half of the group lands 25–50 m away and
        // reads at 30–60 px, while the far half stays small and gives the group
        // depth. A scatter centred further out is uniformly too small.
        areaMeters: 55,
        heightMeters: [1.3, 1.6],
        centreClear: 8,
        nearFadeMeters: 18,
        color: 0x090d0b,
        rim: 0x93a06a,
        opacity: ({ local, rebase }) =>
          band(local, 0.06, 0.2, 0.88, 0.98) * clamp01((260 - rebase.frameMeters()) / 140),
      })),
    // The people around the fire, from Homo erectus through to the camps of the
    // "Us" beat. Same archetype, taller and more of them.
    L('people', ago(2.1e6), ago(92e3), () =>
      silhouette({
        kind: 'figure',
        variants: 5,
        seed: 149,
        // Scattered wide, not tight around the fire. The camera is ~130 m from
        // the origin at these frames, so distance from the ORIGIN barely changes
        // a figure's size — what changes it is landing on the camera's side of
        // the scatter, and that needs the scatter to be big enough to reach.
        count: 14,
        areaMeters: 85,
        heightMeters: [1.45, 1.8],
        centreClear: 6,
        nearFadeMeters: 26,
        color: 0x0a0806,
        rim: 0xc27a3a, // lit by the fire, not by the sky
        opacity: ({ local, rebase }) =>
          band(local, 0.05, 0.16, 0.9, 0.98) * clamp01((300 - rebase.frameMeters()) / 160),
      })),

    // Fire — the literal beat subject, at human scale: a hearth glow plus a
    // column of drifting sparks. It burns from Homo erectus through the
    // 300 kya "Us" beat (two more camps join) and is what the "Out of Africa"
    // aerial then multiplies into a constellation.
    // Sized for a ~45 m frame, not the 260 m one these were written for: a
    // hearth is about a metre across, and at the old numbers the "campfire" was
    // a seven-metre ball of light with a sixty-metre halo — which read fine as
    // an abstract glow and not at all as a fire people are sitting around.
    L('fire-glow', ago(2.3e6), ago(95e3), () =>
      glowSphere({
        radiusMeters: 1.5,
        offsetMeters: [0, 0.9, 0],
        color: 0xffc27a,
        haloColor: 0xff9a40,
        haloScale: 7,
        opacity: ({ local, t }) =>
          band(local, 0.03, 0.1, 0.9, 0.98) * (0.78 + 0.16 * Math.sin(t * 6.3) + 0.06 * Math.sin(t * 17.1)),
      })),
    L('fire-sparks', ago(2.3e6), ago(95e3), () =>
      particleField({
        count: 130,
        distribution: 'ball',
        seed: 41,
        colorA: 0xffd9a0,
        colorB: 0xff5a20,
        size: 2.6,
        maxSize: 6,
        jitter: 0.06,
        twinkle: 0.9,
        radiusMeters: 2.6,
        offsetMeters: [0, 2.2, 0],
        opacity: ({ local }) => band(local, 0.03, 0.1, 0.9, 0.98) * 0.9,
      })),
    L('camp-2', ago(600e3), ago(95e3), () =>
      glowSphere({
        radiusMeters: 1.1,
        offsetMeters: [46, 0.8, -26],
        color: 0xffb46a,
        haloScale: 6,
        opacity: ({ local, t }) => band(local, 0.05, 0.2, 0.9, 0.98) * (0.7 + 0.2 * Math.sin(t * 5.1 + 2)),
      })),
    L('camp-3', ago(600e3), ago(95e3), () =>
      glowSphere({
        radiusMeters: 1.1,
        offsetMeters: [-38, 0.8, 33],
        color: 0xffb46a,
        haloScale: 6,
        opacity: ({ local, t }) => band(local, 0.05, 0.2, 0.9, 0.98) * (0.7 + 0.2 * Math.sin(t * 4.3 + 4)),
      })),

    // Out of Africa, seen from altitude at night: fires multiplying across the
    // plain. Migration drawn as the spread of firelight — points lying on the
    // terrain plane, some swallowed by hills, which is what keeps the spread
    // looking settled-in rather than sprinkled-on.
    L('migration-fires', ago(105e3), ago(15e3), () =>
      particleField({
        count: 850,
        distribution: 'disk',
        thickness: 0.004,
        seed: 59,
        colorA: 0xffd9a0,
        colorB: 0xff8a50,
        colorMode: 'random',
        size: 3.2,
        maxSize: 7,
        twinkle: 0.55,
        radiusMeters: 1.2e4,
        offsetMeters: [0, 45, 0],
        opacity: ({ local }) => band(local, 0.05, 0.25, 0.75, 0.95) * 0.85,
      })),

    // Settlements, in three ages that cross-fade: a farming hamlet, the
    // mudbrick city of the writing beat (lamplit, faintly), and the industrial
    // city the pull-back leaves behind (electrified, smoking).
    L('hamlet', ago(11.5e3), ago(5.4e3), () =>
      blocks({
        count: 26,
        areaMeters: 240,
        spacingMeters: 26,
        heightMeters: [2.5, 4.5],
        seed: 5,
        color: 0x6b5a44,
        lightDir: [0.7, 0.28, 0.5],
        sun: () => 0.75,
        opacity: ({ local }) => band(local, 0.06, 0.2, 0.8, 0.95),
      })),
    L('city', ago(6e3), ago(600), () =>
      blocks({
        count: 480,
        areaMeters: 850,
        spacingMeters: 34,
        heightMeters: [3, 10],
        seed: 9,
        color: 0x6e5d45,
        lightDir: [0.7, 0.28, 0.5],
        sun: () => 0.55,
        night: ({ u }) => plin([[5.4e3, 0], [4.6e3, 0.2], [700, 0.25]], yaAt(u)),
        opacity: ({ local }) => band(local, 0.05, 0.18, 0.85, 0.97),
      })),

    // Hearth- and lamplight over the settlements. At the aerial frames where
    // a whole village or city fits, a 4 m hut is sub-pixel — but a warm point
    // under bloom reads at ANY scale, so the lights are what say "inhabited".
    // Same trick the Out of Africa constellation uses, at town size.
    L('village-lamps', ago(10.5e3), ago(4.9e3), () =>
      particleField({
        count: 34,
        distribution: 'disk',
        thickness: 0.01,
        seed: 71,
        colorA: 0xffd9a0,
        colorB: 0xff9a50,
        colorMode: 'random',
        size: 3.4,
        maxSize: 7,
        twinkle: 0.5,
        radiusMeters: 210,
        offsetMeters: [0, 7, 0],
        opacity: ({ local }) => band(local, 0.08, 0.25, 0.8, 0.95) * 0.9,
      })),
    L('city-lamps', ago(5.7e3), ago(650), () =>
      particleField({
        count: 150,
        distribution: 'disk',
        thickness: 0.01,
        seed: 79,
        colorA: 0xffd9a0,
        colorB: 0xff8a50,
        colorMode: 'random',
        size: 3.0,
        maxSize: 6,
        twinkle: 0.45,
        radiusMeters: 780,
        offsetMeters: [0, 9, 0],
        opacity: ({ local }) => band(local, 0.06, 0.2, 0.85, 0.97) * 0.8,
      })),
    L('industrial', ago(800), ago(1.1), () =>
      blocks({
        count: 1600,
        areaMeters: 5500,
        spacingMeters: 105,
        heightMeters: [5, 38],
        footprint: 0.55,
        seed: 23,
        color: 0x5f5b55,
        lightDir: [0.7, 0.28, 0.5],
        sun: () => 0.55,
        night: ({ u }) => plin([[500, 0.05], [260, 0.3], [120, 0.6], [30, 0.95], [1, 1]], yaAt(u)),
        opacity: ({ local }) => band(local, 0.04, 0.15),
      })),
    // The electrified city's glow. Window fragments are sub-pixel at a 7 km
    // frame; the point field is what actually reads — and during the pull-back
    // it becomes the shrinking patch of light that hands off to the planet's
    // own night-side cities.
    L('industrial-lights', ago(700), ago(1.2), () =>
      particleField({
        count: 1400,
        distribution: 'disk',
        thickness: 0.008,
        seed: 89,
        colorA: 0xfff4d0,
        colorB: 0xff9a50,
        colorMode: 'random',
        size: 2.6,
        maxSize: 6,
        twinkle: 0.3,
        radiusMeters: 4.8e3,
        offsetMeters: [0, 25, 0],
        opacity: ({ u, local }) =>
          band(local, 0.03, 0.12) * plin([[500, 0], [260, 0.3], [120, 0.65], [30, 1], [1, 1]], yaAt(u)) * 0.9,
      })),
    L('smoke', ago(300), ago(15), () =>
      particleField({
        count: 900,
        distribution: 'cloud',
        clumps: 14,
        clumpSpread: 0.09,
        seed: 67,
        colorA: 0x3a332e,
        colorB: 0x201c19,
        size: 9,
        maxSize: 20,
        jitter: 0.02,
        radiusMeters: 3e3,
        offsetMeters: [0, 700, 0],
        opacity: ({ local }) => band(local, 0.1, 0.35, 0.8, 0.97) * 0.22,
      })),

  ];
}
