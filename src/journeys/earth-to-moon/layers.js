import {
  particleField, glowSphere, planet, terrain, blocks, backdrop, silhouette,
  panel, vehicle, trajectory, tower, rocks, cloudDeck,
} from '../../archetypes/index.js';
import { R_EARTH, R_MOON, TOTAL, MOON_D, CROSSOVER, overMoon, walked } from './distance.js';
import { band, plin, plog, clamp01, mixHex } from './curve.js';

// The visual stack. Every entry is an archetype plus parameters — no bespoke
// Three.js in this file, which is rule 2 doing its job.
//
// THE ORIGIN IS THE SPACECRAFT. Earth's centre sits at y = -(R_EARTH + d) and
// the Moon's centre at y = +(TOTAL - R_EARTH - d), both derived from the axis
// value every frame. Consequences that shape everything below:
//
//   · the reader leaves the thing at the bottom of the frame and arrives at the
//     thing at the top — that is the whole composition, in one rule;
//   · the ground during ascent is `d` metres BELOW the origin, which is why
//     terrain.js needed an offsetMeters;
//   · azimuth is free. Both bodies lie ON the rotation axis, so swinging the
//     camera about Y does not move either of them — unlike big-bang, where a
//     bearing swing slid every world-space composition it had.
//
// Layers are bounded by real DISTANCES converted through `uAt`, so re-weighting
// a segment moves the visuals with the story instead of desynchronising them.
// Anything whose relevance depends on how wide the view is gates on
// `rebase.frameMeters()` and never on u — four ground layers hand off to each
// other and then to a planet that way, with no black frame in between.

export function makeLayers(uAt, dAt) {
  const L = (id, fromD, toD, build) => ({ id, from: uAt(fromD), to: uAt(toD), build });

  // Fade a layer in and out on FRAME WIDTH. Ground scenery is only meaningful
  // across a couple of decades of frame — a 200 m relief is a wall at a 20 m
  // frame and invisible at a 200 km one.
  const frames = (rebase, lo, hi) => {
    const f = rebase.frameMeters();
    return clamp01((f - lo) / (lo * 0.8)) * clamp01((hi - f) / (hi * 0.35));
  };

  // How much sky is left. 1 at the pad, 0 above about 40 km — the single number
  // the dome, the ground haze and the ground's own sun term all read, because
  // the three disagreeing is the most illusion-breaking thing this era can do.
  const airAt = (d) => clamp01(plin([[0, 1], [8e3, 0.9], [2.0e4, 0.45], [4.0e4, 0.06], [7e4, 0]], d));

  const skyAt = (d) => {
    const air = airAt(d);
    return {
      air,
      // Dawn at the pad — Apollo launches were morning launches, and a low sun
      // is also the only light that puts a readable shadow down the side of a
      // white cylinder.
      top: mixHex(0x02040a, 0x1d4f95, air),
      horizon: mixHex(0x05101f, 0xc08a52, air),
      bottom: mixHex(0x02040a, 0x1a1a20, air),
      bandLift: 0.12 + air * 0.5,
      sunGain: 0.25 + air * 0.5,
      light: mixHex(0xdfe8ff, 0xffc487, air),
      haze: mixHex(0x04060c, 0x8c7a68, air),
    };
  };

  // Altitude above the LUNAR surface. Negative once the walk begins.
  const lunarAlt = (d) => MOON_D - d;
  // The ground's height below the origin: the ship is the origin, so the
  // surface sits at -altitude until touchdown and at 0 afterwards.
  const lunarDrop = (d) => -Math.max(0, lunarAlt(d));

  // ONE sun for every body, so the terminators agree — two bodies lit from
  // different directions read as a collage, which is the lesson big-bang
  // records for the Earth–Moon pair.
  //
  // The +z component is load-bearing. The camera sits on +z looking back at the
  // origin, so the hemisphere it can SEE is the +z one; the first version of
  // this pointed the sun along +x with almost no z, which lit the far side of
  // both worlds and left the reader looking at a dark ball with a bright rim
  // for nine consecutive beats. 0.62 in z with 0.72 in x puts the terminator
  // across the visible disc, which is what a limb needs to read as a sphere.
  const SUN = [0.72, 0.12, 0.62];
  // …and that fix was right for the LIMB and wrong for the COAST, which is a
  // different geometry entirely. From orbit the camera is beside the planet and
  // sees it edge-on, so a sun in the x–z plane lands a terminator across the
  // visible disc. On the way out the ship is ABOVE Earth (its centre sits at
  // -y) and the camera looks down the +y face — which `SUN`, carrying only 0.12
  // in y, barely lights at all. Measured: every coast beat rendered the NIGHT
  // hemisphere, a dark ball with city lights on it, scoring 0.025–0.05
  // occupancy. The copy said "the whole Earth" over a black disc.
  //
  // So the planet gets its own sun with a real +y component. It is not a
  // cheat: a translunar trajectory departs over the daylit hemisphere, and a
  // gibbous Earth is exactly what the crews photographed. The Moon keeps
  // `LUNAR_SUN` and is unaffected, and the ascent keeps `SUN` so the pad,
  // the plume and the rocket are lit as they were composed.
  const EARTH_SUN = [0.46, 0.68, 0.57];
  // A few degrees above the local horizon: the low sun the landing site was
  // chosen for, and the only lighting in which a boulder throws a shadow.
  const LUNAR_SUN = [0.90, 0.10, 0.42];

  return [
    // --- the sky over Florida ------------------------------------------------
    // Gone by an 8e4 m frame, and that is not an arbitrary cut-off: the dome
    // sits at 8 frame-widths, so anything further away than that — which above
    // ~25 km means the Earth itself — would be drawn BEHIND it and hidden. The
    // sky has to be out of the way before the planet arrives, and at 40 km
    // altitude there is functionally no sky left anyway. "The sky goes out" is
    // this layer's own exit, told honestly.
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

    // Stars. Gated on ALTITUDE, not on the frame: they arrive as the sky leaves,
    // which is a real thing that happens at a real height, and they must not be
    // in the dawn sky at the pad.
    // 2,200 points at half opacity is what an empty frame is made of. Measured:
    // the coast beats scored 0.008 occupancy — a black rectangle with a caption
    // — and 0.005 on the flanks, so turning the view found nothing at all. Deep
    // space is not empty to look at; it is the densest thing in the sky, and
    // big-bang's deep-field beats score 0.7–0.9 for exactly this reason. The
    // starfield is this journey's BACKGROUND PLANE, and it has to behave like
    // one everywhere the ground and the sky are gone.
    L('stars', 1.0e4, walked(95), () =>
      particleField({
        count: 9000,
        distribution: 'ball',
        seed: 19,
        colorA: 0xffffff,
        colorB: 0x9db4e0,
        colorMode: 'random',
        size: 1.25,
        maxSize: 4,
        twinkle: 0.35,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 4,
        opacity: ({ u }) => clamp01((dAt(u) - 1.2e4) / 2.4e4) * 0.8,
      })),

    // The Milky Way. A flattened, much denser field at a larger radius, so it
    // reads as a band lying across the sky rather than as more stars — the one
    // piece of STRUCTURE available in deep space, and the thing that gives a
    // coast beat somewhere for the eye to go when the ship is four pixels wide.
    // It is also what makes turning the view worth doing out here: the band
    // sweeps through frame, so the flanks are never void.
    //
    // `yScale` presses the ball flat; the tilt comes from `rotation`, because a
    // band parallel to the frame edge reads as a rendering artefact and a band
    // running corner to corner reads as the galaxy.
    L('milky-way', 3.0e4, walked(95), () =>
      particleField({
        count: 14000,
        distribution: 'ball',
        seed: 71,
        flattenY: 0.085,
        rotation: [0.35, 0, 0.62],
        colorA: 0xdfe8ff,
        colorB: 0x8ea6d8,
        colorMode: 'random',
        size: 0.85,
        maxSize: 2.6,
        twinkle: 0.15,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 5.2,
        // Well under 1, per the exposure lesson: 14,000 additive sprites at
        // full opacity is a white wash, not a galaxy.
        opacity: ({ u }) => clamp01((dAt(u) - 3.2e4) / 4.0e4) * 0.36,
      })),

    // --- the pad -------------------------------------------------------------
    // Four grounds, each alive across about a decade and a half of frame width,
    // handing off to each other and finally to the planet. The relief scale has
    // to follow: 200 m features at the pad, 100 km features from orbit.
    L('pad-ground', 1, 3.0e3, () =>
      terrain({
        radiusMeters: 2.5e3,
        ampMeters: 4,
        featureMeters: 220,
        flattenMeters: 700,
        seed: 7,
        rock: 0x3b3a36,
        dry: 0x5a5443,
        lightDir: [0.8, 0.4, -0.3],
        offsetMeters: ({ u }) => [0, -dAt(u), 0],
        surface: ({ u }) => {
          const s = skyAt(dAt(u));
          return { haze: s.haze, lightColor: s.light, sun: 0.55 * s.air + 0.05, cover: 0.45, fields: 0, urban: 0.25 };
        },
        opacity: ({ rebase }) => frames(rebase, 60, 620),
      })),
    L('coast-ground', 60, 4.0e4, () =>
      terrain({
        radiusMeters: 2.0e4,
        ampMeters: 30,
        featureMeters: 1400,
        flattenMeters: 4.0e3,
        seed: 11,
        rock: 0x35362f,
        dry: 0x4c4a36,
        lightDir: [0.8, 0.4, -0.3],
        offsetMeters: ({ u }) => [0, -dAt(u), 0],
        surface: ({ u }) => {
          const s = skyAt(dAt(u));
          return { haze: s.haze, lightColor: s.light, sun: 0.6 * s.air + 0.04, cover: 0.5, fields: 0.35, urban: 0 };
        },
        opacity: ({ rebase }) => frames(rebase, 380, 3.4e3),
      })),
    L('region-ground', 600, 1.2e5, () =>
      terrain({
        radiusMeters: 1.5e5,
        ampMeters: 260,
        featureMeters: 1.0e4,
        flattenMeters: 2.0e4,
        seed: 13,
        rock: 0x2b3238,
        dry: 0x3e4636,
        lightDir: [0.8, 0.4, -0.3],
        offsetMeters: ({ u }) => [0, -dAt(u), 0],
        surface: ({ u }) => {
          const s = skyAt(dAt(u));
          return { haze: s.haze, lightColor: s.light, sun: 0.6 * s.air + 0.04, cover: 0.55, fields: 0.2, urban: 0 };
        },
        opacity: ({ rebase }) => frames(rebase, 2.4e3, 2.6e4),
      })),
    L('continent-ground', 6.0e3, 2.0e5, () =>
      terrain({
        radiusMeters: 3.0e6,
        ampMeters: 2.0e3,
        featureMeters: 1.4e5,
        flattenMeters: 3.0e5,
        seed: 17,
        rock: 0x223038,
        dry: 0x33402f,
        lightDir: [0.8, 0.4, -0.3],
        offsetMeters: ({ u }) => [0, -dAt(u), 0],
        surface: ({ u }) => {
          const s = skyAt(dAt(u));
          return { haze: mixHex(0x060a12, s.haze, 0.5), lightColor: 0xdfe6ff, sun: 0.55, cover: 0.5, fields: 0, urban: 0 };
        },
        opacity: ({ rebase }) => frames(rebase, 1.8e4, 3.6e5),
      })),

    // The launch complex. Lights read at any scale, geometry does not — but at
    // a 130 m frame the geometry is the subject, so this is one of the two
    // places in the journey where a building is actually drawn.
    // A launch complex is NOT a skyline. The first version ran 34 boxes up to
    // 105 m with the window shader at 0.6, and it rendered as a lit city centre
    // with a 110 m rocket lost in the middle of it — the vehicle, which is the
    // entire subject of the first two beats, was a white sliver between two
    // office blocks. A pad has one tall structure (the service tower, alongside
    // the vehicle), a handful of low buildings, and a wide empty apron, because
    // everything near a Saturn V on ignition day is designed to be far away.
    L('complex', 1, 1.2e3, () =>
      blocks({
        count: 5,
        areaMeters: 230,
        clearMeters: 95,      // the vehicle stands in the clear middle
        spacingMeters: 76,
        heightMeters: [4, 13],
        footprint: 0.45,
        seed: 23,
        color: 0x4a4d52,
        lightDir: [0.8, 0.4, -0.3],
        sun: () => 0.45,
        night: () => 0.1,
        respectBand: false,
        opacity: ({ u, rebase }) =>
          frames(rebase, 70, 900) * clamp01((1.6e3 - dAt(u)) / 1.2e3),
      })),
    // THE SERVICE TOWER. This was one tall box drawn with `blocks`, and it read
    // as exactly that: a brown slab standing beside the rocket. A launch tower
    // is mostly HOLES — legs, bay ties, cross-bracing, a crane head, and the
    // swing arms reaching across to the vehicle. You are supposed to see sky
    // through it, and the arms are what say "this thing is servicing that
    // thing" rather than "two objects happen to be adjacent".
    //
    // `blocks` cannot express any of that, which made it an archetype gap
    // rather than a tuning problem — see src/archetypes/tower.js. It stands
    // 12 m off the pad centre on the sunward side so its shadow falls across
    // the deck toward the camera instead of away from it.
    L('service-tower', 1, 900, () =>
      tower({
        heightMeters: 106,
        widthMeters: 13,
        bays: 11,
        braces: 'x',
        legR: 0.05,
        color: 0x6f7378,
        metalness: 0.5,
        roughness: 0.66,
        cap: { heightMeters: 7, overhang: 0.75 },
        // Three arms at the levels a Saturn V actually had them: the tail
        // service masts low down, an intertank arm, and the crew access arm
        // near the top. They point -x, which is where the vehicle stands.
        arms: [
          { at: 0.17, lengthMeters: 17, thickness: 2.6, side: -1 },
          { at: 0.52, lengthMeters: 15, thickness: 2.2, side: -1 },
          { at: 0.88, lengthMeters: 18, thickness: 2.4, side: -1 },
        ],
        deck: { sizeMeters: 90, thickness: 3.2, color: 0x59564f },
        offsetMeters: [30, 0, -12],
        respectBand: false,
        opacity: ({ u, rebase }) =>
          frames(rebase, 55, 900) * clamp01((1.1e3 - dAt(u)) / 800),
      })),
    L('complex-lights', 1, 1.2e3, () =>
      particleField({
        count: 90,
        distribution: 'cloud',
        clumps: 14,
        clumpSpread: 0.2,
        flattenY: 0.12,
        seed: 29,
        colorA: 0xffd9a0,
        colorB: 0xfff2d8,
        colorMode: 'random',
        size: 2.6,
        maxSize: 7,
        twinkle: 0.3,
        radiusMeters: 200,
        offsetMeters: ({ u }) => [0, -dAt(u) + 10, 0],
        respectBand: false,
        opacity: ({ u, rebase }) =>
          frames(rebase, 70, 1.6e3) * clamp01((2.2e3 - dAt(u)) / 1.6e3) * 0.45,
      })),

    // --- the launch vehicle --------------------------------------------------
    // One `vehicle`, shedding three times: first stage, escape tower, second
    // stage, and finally the third stage at the turnaround. Everything below is
    // keyed on the axis DISTANCE rather than on layer progress, so the sequence
    // stays welded to the altitudes even if a segment weight moves.
    //
    // The drawn length is max(110 m, 0.16 × frame). True size while the frame is
    // tight, then a formation-camera convention: at a 5e4 m frame a real Saturn
    // V is one and a half pixels, and inflating the world instead would break
    // the axis. The bodies stay true; the ship is the thing that is drawn to be
    // seen. Same trade big-bang records as "physically where the observer was
    // is not the same as legible".
    L('saturn', 1, 2.6e7, () =>
      vehicle({
        lengthMeters: ({ rebase }) => Math.max(110, rebase.frameMeters() * 0.22),
        fins: { count: 4, span: 0.058, chord: 0.075, at: -0.5 },
        bands: 7,
        bandDepth: 0.55,
        lightDir: SUN,
        stages: [
          // S-IC: 42 m of the 110 m stack, 10 m across, five F-1s.
          {
            span: 0.38, r: 0.046, color: 0xe8ebef, nozzles: 5, nozzleR: 0.017,
            shed: ({ u }) => plin([[6.75e4, 0], [7.8e4, 0.45], [9.6e4, 1]], dAt(u)),
          },
          // S-II: five J-2s, same diameter.
          {
            span: 0.23, r: 0.046, color: 0xdfe3e8, nozzles: 5, nozzleR: 0.013,
            shed: ({ u }) => plin([[1.70e5, 0], [1.845e5, 1]], dAt(u)),
          },
          // S-IVB: one J-2, narrower, and the stage that does translunar
          // injection — so it is still here four days later.
          {
            span: 0.20, r: 0.030, color: 0xd6dbe2, nozzles: 1, nozzleR: 0.016,
            shed: ({ u }) => plin([[6.0e6, 0], [1.14e7, 0.5], [2.2e7, 1]], dAt(u)),
          },
        ],
        capsule: { span: 0.09, r: 0.022, color: 0xa8b2bd, cone: 1 },
        tower: {
          span: 0.10, r: 0.010, color: 0x9aa0a8,
          shed: ({ u }) => plin([[9.5e4, 0], [1.13e5, 0.5], [1.35e5, 1]], dAt(u)),
        },
        plume: {
          span: 0.85, r: 0.05, core: 0xfff4d8, edge: 0xff8a2e, gain: 1.0,
          smoke: 0x33302c, smokeEdge: 0x121110, smokeGain: 0.5, soft: 1.5,
          // Throttled DOWN through max-Q, off across the staging gap, off at
          // cut-off, and lit again for translunar injection. Every one of those
          // is a real event at a real altitude.
          throttle: ({ u }) => plin([
            [1, 0], [4, 1], [1.0e4, 1], [1.37e4, 0.7], [2.4e4, 1],
            [6.75e4, 1], [7.0e4, 0], [7.6e4, 0.85], [1.80e5, 0.85], [1.855e5, 0],
            [1.94e5, 0], [2.0e5, 1], [9.0e5, 1], [2.0e6, 0],
          ], dAt(u)),
        },
        // Vertical on the pad, rolls onto its heading, then tips over — because
        // the goal is sideways speed, not height, which is what beat 3 says.
        attitude: ({ u }) => {
          const d = dAt(u);
          return [
            plin([[110, 0], [2.0e3, 0.12], [1.37e4, 0.45], [6.7e4, 0.95], [1.855e5, 1.45]], d),
            0,
            plin([[110, 0], [1.2e3, -0.5], [1.0e4, -0.55]], d),
          ];
        },
        // Drifts off frame once it is spent, so the turnaround leaves something
        // behind rather than dissolving on the spot.
        offsetMeters: ({ u, rebase }) => {
          const s = plin([[6.0e6, 0], [2.2e7, 1]], dAt(u));
          return [0, -rebase.frameMeters() * 0.55 * s, 0];
        },
        opacity: ({ u }) => plin([[6.0e6, 1], [1.9e7, 0]], dAt(u)),
        respectBand: false,
      })),

    // The ice sheath a cryogenic stage sheds when it moves, and the retro-rocket
    // flash at separation. An event needs three phases; this is the middle one.
    L('stage-debris', 6.2e4, 1.6e5, () =>
      particleField({
        count: 1400,
        distribution: 'disk',
        innerRadius: 0.15,
        thickness: 0.5,
        seed: 31,
        blending: 'normal',
        colorA: 0xb9c2cc,
        colorB: 0x585f68,
        colorMode: 'random',
        size: 2.4,
        maxSize: 7,
        jitter: 0.02,
        radiusMeters: ({ u, rebase }) =>
          rebase.frameMeters() * plin([[6.7e4, 0.05], [9.5e4, 0.5], [1.4e5, 0.9]], dAt(u)),
        offsetMeters: ({ u, rebase }) => [0, -rebase.frameMeters() * 0.28, 0],
        respectBand: false,
        opacity: ({ u }) => plin([[6.6e4, 0], [7.2e4, 0.85], [1.1e5, 0.4], [1.5e5, 0]], dAt(u)),
      })),
    L('retro-flash', 6.4e4, 1.0e5, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.06,
        // ABOVE the ship, not below it. At -0.2 frames the flash sat between the
        // vehicle and the planet, which put a bright orange ball directly over
        // the ground at the same screen position as the terrain — so it read as
        // an explosion ON the Earth rather than as a separation happening in
        // vacuum 78 km up. Anything meant to be seen as happening IN SPACE has
        // to be composed against space.
        offsetMeters: ({ rebase }) => [0, rebase.frameMeters() * 0.06, 0],
        color: 0xfff0d0,
        haloColor: 0xffc98a,
        haloScale: 5,
        respectBand: false,
        opacity: ({ u }) => plin([[6.7e4, 0], [7.3e4, 1], [8.4e4, 0]], dAt(u)),
      })),

    // --- the cloud deck ------------------------------------------------------
    // NORMAL blending. Cloud is a thing that HIDES the ground, and additive
    // cannot draw an occluder — big-bang learned this three separate times with
    // ash, dust and a molecular cloud.
    // CLOUD, not cotton balls. This was 3,000 normal-blended point sprites, and
    // a sprite is a round hard-edged disc — so the deck read as a heap of balls
    // rather than as weather. No count or size fixes the shape of a sprite.
    //
    // `cloudDeck` puts multi-octave noise on a small stack of horizontal planes
    // instead: broad masses with billows on them, soft alpha edges, real gaps
    // where the coverage threshold cuts, and enough parallax between the layers
    // that flying through the deck reads as passing a LAYER with a top and a
    // bottom. Altitude is the real thing — a Florida cumulus base sits around
    // 2 km — and the ship's own altitude is subtracted, because the origin is
    // the spacecraft.
    L('clouds', 200, 2.0e5, () =>
      cloudDeck({
        radiusMeters: ({ rebase }) => Math.min(6.0e4, rebase.frameMeters() * 2.4),
        altitudeMeters: ({ u }) => 2.0e3 - dAt(u),
        layers: 3,
        thicknessMeters: 900,
        coverage: 0.52,
        scale: 3.6,
        seed: 37,
        color: 0xf6f8fc,
        shadowColor: 0x93a1b4,
        sunDir: SUN,
        respectBand: false,
        opacity: ({ u, rebase }) => {
          const f = rebase.frameMeters();
          return clamp01((f - 700) / 700) * clamp01((8.0e4 - f) / 4.5e4) * airAt(dAt(u)) * 0.92;
        },
      })),

    // --- Earth ---------------------------------------------------------------
    // respectBand is OFF, deliberately. At a 1e5 m frame the planet is 280 world
    // units across, which the band would reject — and it is right to reject a
    // 280-unit PARTICLE FIELD, but a solid sphere that large is not a wash, it
    // is the floor of the world. Gating on the frame instead is what closes the
    // dead zone between the last terrain and the first view of the globe.
    L('earth', 2.0e4, walked(95), () =>
      planet({
        radiusMeters: R_EARTH,
        offsetMeters: ({ u }) => [0, -(R_EARTH + dAt(u)), 0],
        lightDir: EARTH_SUN,
        rock: 0x5b5140,
        atmosphere: 0x67b0ff,
        atmosphereScale: 1.014,
        spin: 0.004,
        // 256, not 128. During the orbital beats the camera sits just off the
        // limb and the silhouette is most of the frame, where 128 segments
        // shows as visible facets around the edge — a polygon where a world
        // should be.
        segments: 256,
        respectBand: false,
        surface: () => ({
          // ice 0.28, not 0.5. Half the planet was rendering as polar white,
          // which under this stage's tone mapping clips flat and takes the
          // continents with it — the second-stage beats were a white shape with
          // a blue rind. A body that clips to white is a hole in the frame.
          magma: 0, seaLevel: 0.5, green: 0.85, ice: 0.28,
          // City lights on the night hemisphere. This is the beat about falling
          // around a dark world, and it is also the only cue that the thing
          // below is inhabited.
          night: 1, atmosphere: 1,
        }),
        opacity: ({ rebase }) => clamp01((rebase.frameMeters() - 6.0e4) / 7.0e4),
      })),

    // --- the Moon ------------------------------------------------------------
    // seaLevel is driven below zero so the shader's "land" term is 1 everywhere:
    // there is no water here, and the ocean stops would paint the maria blue.
    // The mottling that remains is doing the work of the maria.
    L('moon', 2.0e5, overMoon(2.0e4), () =>
      planet({
        radiusMeters: R_MOON,
        offsetMeters: ({ u }) => [0, TOTAL - R_EARTH - dAt(u), 0],
        lightDir: SUN,
        rock: 0x7c7a74,
        atmosphere: 0x000000,
        atmosphereScale: 1.001,
        spin: 0.0,
        segments: 128,
        respectBand: false,
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0, night: 0, atmosphere: 0 }),
        // Drawn only ABOVE a 1.1e5 m frame. Below that we are close enough that
        // the lunar terrain is carrying the surface, and the two overlap by
        // most of a decade (terrain runs to 2.2e5) so the arrival never cuts.
        opacity: ({ rebase }) => clamp01((rebase.frameMeters() - 1.1e5) / 9.0e4),
      })),

    // --- the coast -----------------------------------------------------------
    // The path, drawn once in a fixed span of TOTAL metres and slid so its ends
    // land on the two bodies. Bright behind, faint ahead: that difference is
    // what turns a line into a plan, and it is the only thing on screen during
    // the two beats where genuinely nothing else is happening.
    L('coast-path', 1.0e6, 3.74e8, () =>
      trajectory({
        path: (s) => [0, (s - 0.5) * TOTAL, 0],
        samples: 300,
        ticks: 16,
        tickSize: 3.4,
        color: 0x9fe0ff,
        colorAhead: 0x2c4a66,
        aheadOpacity: 0.30,
        offsetMeters: ({ u }) => [0, TOTAL / 2 - (R_EARTH + dAt(u)), 0],
        progress: ({ u }) => (R_EARTH + dAt(u)) / TOTAL,
        opacity: ({ u }) => band(dAt(u), 1.0e6, 6.0e6, 3.2e8, 3.72e8) * 0.5,
      })),

    // The spacecraft after the turnaround: command module, service module, and
    // the lander pulled out of the third stage. One burn in its whole life here
    // — the braking burn on the far side.
    L('spacecraft', 4.0e6, overMoon(2.4e4), () =>
      vehicle({
        // The floor matters more than the fraction. Through the deep coast the
        // frame is set by a body that is barely there, so 0.16 of it is still a
        // craft a few pixels wide — the beat about the spacecraft had no
        // visible spacecraft in it. 0.024 of the frame is about 60 px at 1440,
        // which is a readable object without pretending the ship is the size
        // of a continent.
        lengthMeters: ({ rebase }) => Math.max(17, rebase.frameMeters() * 0.024),
        lightDir: SUN,
        stages: [
          // the lander, riding nose-to-nose with the capsule
          { span: 0.34, r: 0.16, color: 0xc9a25e, nozzles: 1, nozzleR: 0.07 },
          // the service module
          { span: 0.44, r: 0.13, color: 0xb6bec8, nozzles: 1, nozzleR: 0.07 },
        ],
        capsule: { span: 0.18, r: 0.11, color: 0xa4aeb9, cone: 1 },
        dish: { r: 0.13, at: 0.62, tilt: 0.5, color: 0xd8dde4 },
        plume: {
          span: 0.6, r: 0.06, core: 0xdff0ff, edge: 0x6aa4ff, gain: 0.85,
          smoke: 0x101418, smokeEdge: 0x080a0c, smokeGain: 0.12, soft: 1.2,
          // Lunar orbit insertion. It happens out of contact with Earth because
          // that is where the trajectory passes closest — beat 20's whole point.
          throttle: ({ u }) => plin([
            [overMoon(6.0e5), 0], [overMoon(4.6e5), 1], [overMoon(3.0e5), 1], [overMoon(2.4e5), 0],
          ], dAt(u)),
        },
        attitude: ({ u }) => [
          plin([[6.0e6, 1.2], [3.0e7, 1.6], [3.4e8, 1.6], [overMoon(5e5), 2.9]], dAt(u)),
          0.4, 0,
        ],
        opacity: ({ u }) => band(dAt(u), 4.0e6, 9.0e6, overMoon(9.0e4), overMoon(3.0e4)),
        respectBand: false,
      })),

    // --- the lunar surface ---------------------------------------------------
    // Five grounds again, spanning 2e5 m of frame down to 0.4 m — a landing site
    // seen from orbit and a bootprint are five decades apart, and no single
    // heightfield covers that.
    L('lunar-far', 3.68e8, walked(95), () =>
      terrain({
        radiusMeters: 1.2e6,
        ampMeters: 6.0e3,
        featureMeters: 9.0e4,
        flattenMeters: 1.0e5,
        seed: 41,
        haze: 0x000000,
        rock: 0x4a4844,
        dry: 0x6e6a62,
        lightDir: LUNAR_SUN,
        lightColor: 0xfff4e2,
        offsetMeters: ({ u }) => [0, lunarDrop(dAt(u)), 0],
        surface: () => ({ sun: 0.95, cover: 0, fields: 0, urban: 0 }),
        opacity: ({ rebase }) => frames(rebase, 1.4e4, 2.2e5),
      })),
    L('lunar-mid', overMoon(4.0e5), walked(95), () =>
      terrain({
        radiusMeters: 1.0e5,
        ampMeters: 700,
        featureMeters: 7.0e3,
        flattenMeters: 1.0e4,
        seed: 43,
        haze: 0x000000,
        rock: 0x4d4b46,
        dry: 0x757168,
        lightDir: LUNAR_SUN,
        lightColor: 0xfff4e2,
        offsetMeters: ({ u }) => [0, lunarDrop(dAt(u)), 0],
        surface: () => ({ sun: 0.95, cover: 0, fields: 0, urban: 0 }),
        opacity: ({ rebase }) => frames(rebase, 1.6e3, 1.7e4),
      })),
    L('lunar-near', overMoon(1.2e4), walked(95), () =>
      terrain({
        radiusMeters: 6.0e3,
        ampMeters: 34,
        featureMeters: 340,
        flattenMeters: 600,
        seed: 47,
        haze: 0x000000,
        rock: 0x4f4d48,
        dry: 0x7b776e,
        lightDir: LUNAR_SUN,
        lightColor: 0xfff4e2,
        offsetMeters: ({ u }) => [0, lunarDrop(dAt(u)), 0],
        surface: () => ({ sun: 0.95, cover: 0, fields: 0, urban: 0 }),
        opacity: ({ rebase }) => frames(rebase, 110, 2.0e3),
      })),
    L('lunar-close', overMoon(900), walked(95), () =>
      terrain({
        radiusMeters: 420,
        ampMeters: 2.6,
        featureMeters: 26,
        flattenMeters: 60,
        seed: 53,
        haze: 0x000000,
        rock: 0x514f4a,
        dry: 0x807c73,
        lightDir: LUNAR_SUN,
        lightColor: 0xfff4e2,
        offsetMeters: ({ u }) => [0, lunarDrop(dAt(u)), 0],
        surface: () => ({ sun: 0.95, cover: 0, fields: 0, urban: 0 }),
        opacity: ({ rebase }) => frames(rebase, 7, 140),
      })),
    L('lunar-micro', walked(1), walked(95), () =>
      terrain({
        radiusMeters: 26,
        // 1.5 m features across a 3.6 m visible width is two humps and reads as
        // a desert. At 0.35 m the ground is grain rather than dune, which is
        // what regolith at arm's length actually looks like.
        ampMeters: 0.012,
        featureMeters: 0.22,
        flattenMeters: 2,
        seed: 59,
        haze: 0x000000,
        rock: 0x565349,
        dry: 0x8b8779,
        lightDir: LUNAR_SUN,
        lightColor: 0xfff4e2,
        surface: () => ({ sun: 0.95, cover: 0, fields: 0, urban: 0 }),
        opacity: ({ rebase }) => frames(rebase, 0.35, 8),
      })),

    // Earth, over the Moon's limb, for "Behind the Moon" / "Earthrise" / "The
    // terminator" (beats 20–22). FIX for a real rule-9 defect: at this range
    // the camera is aimed at the MOON (LOOK_Y ≈ 0.6–1.5, positive — up toward
    // the body ahead) because that is what those beats are staged around, but
    // Earth sits on the same Y axis in the opposite, negative direction —
    // roughly 1,400 world units the other way at this frame. A single scalar
    // look-height cannot aim at both a nearby body ahead and a distant one
    // behind in the same shot; that is the wall this journey and Earth→Mars
    // both hit (see src/kit/camrig.js). The `earth` planet layer above is
    // physically placed and simply never enters this frame.
    //
    // The fix is the same device the final beat already uses for Earth-in-the-
    // lunar-sky: an AUTHORED position (a fixed offset near the top of frame,
    // above the local horizon) rather than the true axis position, sized to
    // the real angular diameter the design brief computes for this range
    // (radius/distance ≈ 1.9°, matching a real Earthrise photograph). It is a
    // compositional placement, not a physical one — exactly the carve-out
    // rule 1 already grants the walked() Earth, extended a few beats earlier
    // to the beat that is actually named after it.
    // First placement (r×3 out, mostly +y/-z) put Earth GEOMETRICALLY BEHIND
    // the Moon sphere: the line from the camera to that point passed straight
    // through `moon`'s own opaque geometry (the Moon fills most of the frame
    // here — see beat 20's own copy), so it was occluded, not merely dim.
    // This placement sits close to the camera, well inside the Moon's near
    // surface, at an angle (~26° off the camera's own forward direction —
    // near the edge of a 55° FOV) that clears the sphere entirely.
    L('earthrise', overMoon(3.3e5), overMoon(0.7e4), () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.015,
        offsetMeters: ({ rebase }) => {
          const f = rebase.frameMeters();
          return [-f * 0.375, f * 0.15, f * 0.75];
        },
        color: 0x7fb4f0,
        haloColor: 0x2f68b8,
        haloScale: 2.0,
        solid: true,
        solidColor: 0x6ea6ea,
        segments: 24,
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), overMoon(3.3e5), overMoon(2.6e5), overMoon(2.0e4), overMoon(0.7e4)),
      })),

    // The black sky. Only below a 1e3 m frame — above that, Earth and the Moon
    // are both further away than a dome at eight frame-widths, and a dome would
    // hide the thing beat 21 is entirely about.
    L('lunar-sky', overMoon(3.0e3), walked(95), () =>
      backdrop({
        radiusFrames: 8,
        top: 0x000000,
        horizon: 0x000000,
        bottom: 0x000000,
        sunColor: 0xfff6e6,
        sunDir: [0.94, 0.11, -0.32],
        sunSize: 0.99985,
        sunSoft: 0.0006,
        sunGain: 2.4,
        bandLift: 0,
        opacity: ({ rebase }) => clamp01((1.4e3 - rebase.frameMeters()) / 700),
      })),

    // --- the lander ----------------------------------------------------------
    L('lander', overMoon(9.0e4), walked(95), () =>
      vehicle({
        // Converges on the real 7 m as the frame closes in — max(7, 0.14×frame)
        // is 7.2 m at the 45 m contact frame, so the landing is true size and
        // gets there without a pop.
        lengthMeters: ({ rebase }) => Math.max(7, rebase.frameMeters() * 0.14),
        lightDir: LUNAR_SUN,
        ambient: 0.07, // vacuum: the only fill is bounce off the ground
        stages: [
          { span: 0.42, r: 0.30, color: 0xbe9852, nozzles: 1, nozzleR: 0.09 },
        ],
        capsule: { span: 0.36, r: 0.26, color: 0xc8ccd2, cone: 0 },
        legs: { count: 4, span: 0.55, spread: 0.72, footR: 0.07, color: 0xa8aeb6 },
        plume: {
          // Dim, and deliberately so. A hypergolic descent engine has an almost
        // invisible flame, and at gain 0.5 the additive cone plus the stage's
        // bloom turned the whole lander into a white blob with no shape in it.
        span: 0.9, r: 0.10, core: 0xbcd0ee, edge: 0x5a86c4, gain: 0.26,
          smoke: 0x0c0e12, smokeEdge: 0x05060a, smokeGain: 0.06, soft: 1.1,
          throttle: ({ u }) => plin([
            [overMoon(3.0e4), 0], [overMoon(1.6e4), 1], [overMoon(2.0e3), 0.8],
            [overMoon(120), 0.55], [overMoon(2), 0.25], [MOON_D, 0],
          ], dAt(u)),
        },
        // On its back with the engine forward for the braking phase, then
        // upright at pitchover — which is the moment the crew first see the
        // ground they are going to land on.
        attitude: ({ u }) => [
          plin([[overMoon(9.0e4), 2.2], [overMoon(1.6e4), 1.95], [overMoon(3.0e3), 0.5], [overMoon(400), 0.06], [MOON_D, 0]], dAt(u)),
          0.5, 0,
        ],
        // Sits on the ground once down, and recedes as the walk goes on.
        offsetMeters: ({ u, rebase }) => {
          const d = dAt(u);
          // 0 while flying, 1 once the footpads are down — the lander stops
          // being centred on the origin and starts standing on the ground.
          const grounded = clamp01(1 - Math.max(0, MOON_D - d) / 30);
          const len = Math.max(7, rebase.frameMeters() * 0.14);
          const walkedM = Math.max(0, d - MOON_D);
          return [-(walkedM * 0.8) - grounded * 6, grounded * len * 0.42, walkedM * 0.4];
        },
        opacity: ({ u }) => band(dAt(u), overMoon(9.0e4), overMoon(5.0e4)),
        respectBand: false,
      })),

    // The dust sheet. NORMAL blending — regolith thrown by an engine is lit grey
    // material, not light, and an additive version is a haze that brightens the
    // very ground it should be hiding. `flattenY` presses it to a sheet, because
    // with no air it does not billow: it leaves radially, flat and fast.
    L('landing-dust', overMoon(400), walked(30), () =>
      particleField({
        count: 5200,
        distribution: 'disk',
        innerRadius: 0.06,
        thickness: 0.28,
        flattenY: 0.16,
        seed: 61,
        blending: 'normal',
        colorA: 0x9a958a,
        colorB: 0x4a4741,
        colorMode: 'random',
        size: 6,
        maxSize: 22,
        spin: 0.5,
        radiusMeters: ({ u }) => 24 + Math.max(0, 120 - lunarAlt(dAt(u))) * 0.55,
        offsetMeters: ({ u }) => [0, lunarDrop(dAt(u)) + 1.2, 0],
        respectBand: false,
        // Ramps in below 60 m and stops DEAD at touchdown. With no atmosphere
        // nothing stays suspended: the instant the engine quits, every particle
        // finishes its arc and lands. That discontinuity is the beat.
        opacity: ({ u }) => {
          const d = dAt(u);
          const alt = lunarAlt(d);
          if (d >= MOON_D) return 0;
          return clamp01((60 - alt) / 45) * 0.85;
        },
      })),

    // --- the bootprint -------------------------------------------------------
    // Some subjects are not shapes. A print is a few millimetres of relief in
    // powder, so the journey does what it already does for a living cell and a
    // clay tablet: it dives. tiltRad near PI/2 lays the quad flat on the
    // ground, which is the one orientation a footprint has.
    L('bootprint', walked(2), walked(40), () =>
      panel({
        kind: 'bootprint',
        count: 3,
        variants: 4,
        seed: 67,
        sizeMeters: [0.46, 0.50],
        aspect: 0.62,
        areaMeters: 0.5,
        tiltRad: 1.5,
        bodyColor: null,      // a print is IN the surface; it has no carrier
        // A print on the Moon is lit by the sun, not by a lamp a hand's width
        // away. Turning the lamp term down and the ambient up stops each print
        // carrying its own halo, which is what made them look like objects
        // sitting ON the ground rather than impressions in it.
        ambient: 0x565248,
        lampColor: 0xfff2dc,
        lamp: () => 0.55,
        lampAt: [0.7, 0.62],
        opacity: ({ rebase }) => frames(rebase, 0.32, 5),
        respectBand: false,
      })),

    // --- the last frame ------------------------------------------------------
    L('crew', walked(20), walked(95), () =>
      silhouette({
        kind: 'figure',
        count: 2,
        variants: 4,
        seed: 71,
        areaMeters: 9,
        heightMeters: [1.75, 1.95],
        aspect: 0.72,
        centreClear: 5,
        nearFadeMeters: 3.5,
        offsetMeters: [5, 0, -4],
        // Lit, not backlit. There is no bright sky here to silhouette against,
        // so the figure has to be the PALE thing against black — the inverse of
        // every other use of this archetype in the project.
        // Bright, but well under clipping. At 0xf2f5f8 the bloom took both
        // figures to solid white and they read as glowing pillars rather than
        // as people — a suit in sunlight is bright, not incandescent.
        color: 0xc6ccd4,
        rim: 0xe8eef5,
        respectBand: false,
        opacity: ({ rebase }) => frames(rebase, 9, 160),
      })),

    // Earth in the lunar sky. At a 24 m frame the real Earth is 3.8e8 m away —
    // twenty-seven decades outside anything the rebaser will draw — so it is
    // placed at a fixed fraction of the frame and sized to its TRUE ANGULAR
    // diameter of about two degrees, which is the quantity the beat is about.
    // Anything else here would be a lie the reader can measure.
    L('earth-in-sky', walked(12), walked(95), () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 3 * 0.01746,
        offsetMeters: ({ rebase }) => {
          const r = rebase.frameMeters() * 3;
          return [r * 0.30, r * 0.62, -r * 0.72];
        },
        color: 0x7fb4f0,
        haloColor: 0x2f68b8,
        // 3.4 blew the disc to white and the one thing this frame has to be is
        // BLUE. A tight halo keeps the glare inside the disc's own edge.
        haloScale: 1.9,
        solid: true,
        solidColor: 0x6ea6ea,
        segments: 24,
        respectBand: false,
        opacity: ({ rebase }) => frames(rebase, 6, 200),
      })),
  ];
}
