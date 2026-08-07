import {
  particleField, glowSphere, filaments, planet, backdrop, blob, vehicle,
  instrumentedProbe, trajectory, rocks, panel,
} from '../../archetypes/index.js';
import {
  AU,
  R_SUN, R_EARTH, R_MARS, R_JUPITER, R_SATURN, R_URANUS, R_NEPTUNE,
  R_IO, R_EUROPA, R_TITAN, R_TRITON, D_IO, D_EUROPA, D_TITAN, D_TRITON,
  R_MARS_AU, R_JUPITER_AU, R_SATURN_AU, R_URANUS_AU, R_NEPTUNE_AU, R_PLUTO_AU,
  RING_C_IN, RING_B_IN, RING_B_OUT, RING_A_IN, RING_A_OUT, RING_F, RING_EPSILON,
} from './distance.js';
import { band, plin, plog, clamp01 } from './curve.js';
import {
  LIGHT_DIR, sunGlare, sunFlux, sunOffsetMeters, screenAnchoredMeters,
  separationFormation, separationProgress, voyagerPositionMeters,
  departurePathAt, departureProgress, departurePathOffsetMeters, END_AU,
} from './plan.js';

// THE WORLD.
//
// Rewritten from the ground up. The first build was 403 lines over 32 beats —
// about one archetype per beat, which is the "object floating in void" failure
// arrived at by construction, before a single compositional decision has been
// made. It measured 0.032 mean occupancy and 0.6 mean adjacent distance: the
// same white probe, the same size, the same screen position, thirty-two times.
//
// Three things are different here, and they are structural rather than
// cosmetic:
//
//  1. TRAVEL RUNS ALONG +X, ACROSS THE FRAME. Every body ahead sits at
//     `its own orbital radius - d`, positive; the Sun is behind at `-d`. The
//     camera is on +z, so origin-left/destination-right falls out for free and
//     one frame can hold both ends of a leg (rule 5, and `journey-craft`'s
//     "travel must be perpendicular to the camera").
//
//  2. THE SHIP IS NOT THE SUBJECT. It appears in seven beats at genuinely
//     different sizes, attitudes and lighting — a launch stack, a cruise
//     portrait, a speck among boulders, a silhouette on Jupiter's face, twice
//     over at the divergence, and finally as dark structure around the Golden
//     Record — and is absent from the other fifteen. What carries continuity
//     instead is the Sun, whose drawn glare shrinks 220 px → 4 px on real
//     inverse-square flux, and the Grand Tour path, flown bright and unflown
//     faint.
//
//  3. EVERY BEAT HAS THREE PLANES. The galactic band is the far plane for the
//     whole journey — it is genuinely the brightest structure in the sky from
//     out here, and it is what stops a cruise beat being a black rectangle and
//     what stops a 32° drag finding nothing. A mid-ground subject and a near
//     element are then this file's per-beat job.
//
// Rule 1 still holds everywhere: nothing below writes a world-space position.
// Sizes and offsets are real metres, or an explicit fraction of the current
// frame, and the rebaser converts.

export function makeLayers(uAt, dAt) {
  const A = (au) => au * AU;
  const L = (id, fromAU, toAU, build) => ({ id, from: uAt(A(fromAU)), to: uAt(A(toAU)), build });

  // Opacity envelope in AU, so every fade can be checked against the beat it
  // belongs to without converting anything by hand.
  const win = (d, a, b, c = Infinity, e = Infinity) => band(d / AU, a, b, c, e);

  // Fade on FRAME WIDTH rather than on u. Anything whose relevance depends on
  // how wide the view is — a boulder field, a ring system, a starfield's
  // density — gates on this, which is what lets scales five decades apart hand
  // off to each other without a black frame in between.
  const frames = (rebase, lo, hi) =>
    clamp01((rebase.frameMeters() - lo) / (lo * 0.7))
    * clamp01((hi - rebase.frameMeters()) / (hi * 0.45));

  // A direction and distance in FRAME UNITS, converted to metres. The only
  // sanctioned way to author a compositional placement here: it stays correct
  // at every scale the journey passes through, and it is obvious in the source
  // that the number is a screen decision rather than a physical one.
  const units = (rebase, x, y, z) => {
    const k = rebase.frameMeters() / 4;
    return [x * k, y * k, z * k];
  };

  // Damping for the drawn solar glare in the one frame wide enough to be a
  // map rather than a place. 1 below ~7 AU of frame, 0.40 above ~70 AU.
  const planView = (rebase) => {
    const f = Math.log10(rebase.frameMeters());
    return 1 - 0.78 * clamp01((f - 12.0) / 1.0);
  };

  // A body's TRUE offset from the spacecraft along the travel axis: positive
  // ahead, negative behind, recomputed every frame from the axis value. This
  // is the whole geometric convention of the journey in one line.
  const ahead = (u, rAU) => A(rAU) - dAt(u);

  // Sunlight, everywhere, from one vector — see plan.js. Two bodies with
  // different terminator angles read as a collage rather than as a system.
  const SUN = LIGHT_DIR;

  // Earth on departure is the ONE documented exception. The shared vector
  // points back toward the inner system, and Earth is between us and it, so
  // under `SUN` the departure beat renders the night hemisphere — a dark ball
  // with a bright rim, which is exactly the defect `earth-to-moon` spent nine
  // beats on before it was given its own EARTH_SUN. A translunar-class
  // departure leaves over the daylit hemisphere; this vector is still a
  // left-hand light, so the Sun's drawn glare and Earth's terminator agree.
  const EARTH_SUN = [-0.42, 0.26, 0.87];

  // The galactic plane. One tilt, shared by the three layers that make up the
  // band, because they are one object drawn three ways.
  const GALACTIC = [0.30, 0, 0.56];

  // ---------------------------------------------------------------------
  // THE SPACECRAFT, as one description reused eight times.
  //
  // It used to be built from `vehicle`, which is an axial launch-stack
  // generator: a stage for the bus, a gold `capsule` for the payload, a bare
  // sphere-cap `dish`, and a `tower` standing in for the magnetometer boom.
  // Everything in that list stacks on one line, so the silhouette that came
  // out was a TABLE LAMP — white bowl, gold ball, tapered base, one spike —
  // and no parameter of `vehicle` could have fixed it, because the defect was
  // the axis. `instrumentedProbe` exists for exactly this shape and this is
  // its first user; `vehicle` still draws the Titan-Centaur below, because a
  // Titan-Centaur genuinely IS a launch stack.
  //
  // This is DATA, not code (rule 2): a parameter block with a palette, so the
  // eight appearances cannot drift into eight different spacecraft while
  // still being tintable — the craft is pale in sunlight at 1.5 AU, dark
  // against Jupiter's lit face, and nearly black beside the Golden Record.
  //
  // Proportions are Voyager's own, as fractions of the model's envelope: a
  // 3.7 m dish over a squat ten-sided bus, an RTG boom out one side carrying
  // three generators, a science boom out the other with the scan platform on
  // its end, and the 13 m magnetometer boom — by far the longest thing on the
  // craft — going off diagonally. That last asymmetry is the whole difference
  // between "a probe" and "a lamp".
  const PROBE = ({
    hull = 0xa8aeb6,
    dishFace = 0xe2e6ec,
    dishBack = 0x97a0aa,
    strut = 0xaeb5bd,
    boom = 0x8a9098,
    rtg = 0x26282c,
  } = {}) => ({
    bus: {
      shape: 'octagonalDeck',
      sides: 10,
      radius: 0.155,
      height: 0.135,
      at: [0, -0.055, 0],
      color: hull,
      rimColor: strut,
      deckRim: 0.032,
      modules: [
        // The propulsion module under the deck, and two electronics bays on
        // its flank — the lumps that stop a ten-sided prism reading as a puck.
        { kind: 'cylinder', at: [0, -0.115, 0], size: [0.085, 0.10], color: 0x5e646c },
        { at: [0.135, -0.02, 0.075], size: [0.05, 0.075, 0.05], color: 0x6d747c },
        { at: [-0.10, -0.02, -0.115], size: [0.055, 0.065, 0.045], color: 0x6d747c },
      ],
    },
    hga: {
      diameter: 0.62,
      depth: 0.125,
      at: [0, 0.115, 0],
      // Antennas point at Earth, which for the whole cruise is behind and
      // sunward — the model's +y. Every call site's attitude then turns the
      // craft, so the dish is never twice at the same angle to the camera.
      direction: [0, 1, 0],
      rim: 0.017,
      rimColor: strut,
      ribs: 10,
      faceColor: dishFace,
      backColor: dishBack,
      // The feed stands well off the vertex — a real focal length, not a bump
      // on the dish. At the cruise attitude that is what puts the horn and
      // its tripod ABOVE the dish's own rim, silhouetted against sky, where
      // they are legible instead of buried in the bowl.
      feed: { length: 0.20, r: 0.020, color: strut },
      struts: { count: 3, r: 0.016, color: strut },
    },
    appendages: [
      // The RTG boom: three generators on the outer half, dark against the
      // dish. Real Voyager carries them stacked end to end out one side.
      {
        kind: 'rtgBoom',
        anchor: [-0.13, -0.075, 0.03],
        direction: [-0.90, -0.32, 0.30],
        length: 0.40,
        r: 0.015,
        color: boom,
        endModules: [
          { at: 0.46, kind: 'rtg', length: 0.115, r: 0.036, fins: 4, color: rtg },
          { at: 0.71, kind: 'rtg', length: 0.115, r: 0.036, fins: 4, color: rtg },
          { at: 0.96, kind: 'rtg', length: 0.115, r: 0.036, fins: 4, color: rtg },
        ],
      },
      // The science boom, with the steerable scan platform on its end.
      {
        kind: 'instrumentMast',
        anchor: [0.13, -0.07, -0.02],
        direction: [0.86, -0.34, -0.38],
        length: 0.32,
        r: 0.017,
        color: boom,
        endModules: [{ at: 1.0, kind: 'scanPlatform', length: 0.10, color: 0x767d86 }],
      },
      // The magnetometer boom. Thirteen metres of glass-epoxy truss carrying
      // two small sensors — genuinely thin, genuinely long, and pointed away
      // from everything else on the craft so it breaks the outline.
      {
        kind: 'magnetometerBoom',
        anchor: [0.03, -0.09, 0.10],
        direction: [0.34, -0.30, 0.89],
        length: 0.72,
        r: 0.0055,
        color: boom,
        endModules: [
          { at: 0.62, kind: 'sensor', r: 0.014, color: 0x7d848c },
          { at: 1.0, kind: 'sensor', r: 0.017, color: 0x7d848c },
        ],
      },
    ],
    instruments: [
      // The two low-gain / plasma-wave whips, which on the real craft leave
      // the bus at a wide angle and are the last thing in the silhouette.
      { kind: 'antenna', at: [0.10, -0.13, -0.12], size: [0.011, 0.28], direction: [0.42, -0.62, -0.66], color: boom },
      { kind: 'antenna', at: [-0.10, -0.13, -0.12], size: [0.011, 0.28], direction: [-0.42, -0.62, -0.66], color: boom },
    ],
  });

  // The Golden Record beat, in two numbers. The record is drawn at the ORIGIN
  // and the spacecraft is then placed so its record bracket lands there, which
  // is why these live up here rather than at the call site: the offset is
  // DERIVED from the mount, so the disc and the thing it is bolted to cannot
  // drift apart. 0.9 m of spacecraft at a 0.30 m frame is already three
  // frame-widths of structure; the first attempt used 2.2 and rendered a black
  // slab with the record nowhere in it.
  const REC_SPAN = 0.9;
  const REC_MOUNT = [0.02, 0.30, 0.46];
  // The gap between the bracket's face and the disc. Physically real — the
  // record is bolted to the bus on standoffs — and compositionally it is what
  // keeps the plate BEHIND the tilted disc instead of cutting through it.
  const REC_STANDOFF = 0.16;

  // The Grand Tour, as an authored path in real metres — a gentle bow that
  // kinks at each assist and climbs out of the ecliptic after Saturn, which is
  // what actually happened to Voyager 1. Written once and reused, so the beat
  // about the plan and the beat about the divergence cannot disagree about it.
  const TOUR_END = A(34);
  const tourAt = (m) => {
    const au = m / AU;
    const z = A(-0.75) * Math.sin(clamp01(au / 6) * 1.25)
      + A(1.5) * clamp01((au - 5.2) / 3.2)
      + A(2.2) * clamp01((au - 9.58) / 9);
    const y = A(0.7) * clamp01((au - 9.58) / 13);
    return [m, y, z];
  };

  // ---------------------------------------------------------------------
  // WHERE THE CRAFT IS THE SUBJECT, declared once.
  //
  // Seven beats stage the spacecraft deliberately — a portrait, a boulder
  // field, two Jupiter passes, a second cruise, the divergence pair, the
  // record. The escort below has to stand down in exactly those windows, or
  // the frame holds two Voyagers.
  //
  // The windows live HERE rather than at the call sites because the escort and
  // the hero layer would otherwise be two numbers that are supposed to agree —
  // the failure mode this journey has already paid for twice (a layer offset
  // and a camera aim, 70° apart; a beat mark and a body's true orbit, 0.5 AU
  // apart). One table, read by both.
  // Only the shots that draw the craft LARGE belong in here. The first pass
  // also listed the belt and the Jupiter approach, which drew it at 0.045 and
  // 0.075 of the frame — 25 and 40 px — while muting a 140 px escort to do it.
  // A mute is a promise that something better is taking over; those two were
  // trading a legible spacecraft for an invisible one, and both layers are gone.
  const HERO = {
    cruise:   [1.35, 1.62, 2.25, 2.6],
    assist:   [5.20060, 5.200635, 5.200745, 5.20080],
    cruise2:  [7.4, 8.1, 9.0, 9.3],
    diverge:  [10.6, 11.5, 13.6, 15.6],
    record:   [158, 165, 178, 240],
  };
  const hero = (d, k) => win(d, ...HERO[k]);
  const heroAny = (d) => Math.max(...Object.values(HERO).map((w) => win(d, ...w)));

  // WHILE THE BOOSTER IS BURNING THERE IS NO DEPLOYED SPACECRAFT.
  //
  // The escort's first pass put a fully deployed Voyager — magnetometer boom
  // extended, RTGs swung out, scan platform clear — in frame beside its own
  // launch vehicle, which cannot happen: at that moment the craft is still
  // attached to the Centaur inside the shroud with every boom stowed. The
  // booms deploy AFTER separation. "Always visible" is right for the cruise
  // and wrong for the ascent, and the distinction is physical, not aesthetic.
  //
  // The window is the booster's OWN, declared here and read by both layers,
  // for the same reason `HERO` is: an escort that fades in on one set of
  // numbers while the booster fades out on another is two numbers that have
  // to agree, and they drift. The `frames` term is load-bearing — beat 1 and
  // beat 2 sit at the same heliocentric range and only SCALE tells them
  // apart, which is a trap this file already documents at the booster itself.
  const ASCENT = [1.0000006, 1.000004, 1.00022, 1.0004];
  const ascending = (d, rebase) => win(d, ...ASCENT) * frames(rebase, 2.0e6, 2.0e8);

  // POWERED FLIGHT IS OVER LONG BEFORE THIS BEAT IS REVIEWED, and the first
  // pass had it burning right through the frame. `1 AU + x metres` is an
  // awkward way to read an altitude, so the conversions are written out:
  //
  //     400 km  = 1.0000027 AU      14,000 km = 1.0000936 AU   (beat 2's mark)
  //   1,000 km  = 1.0000067 AU      24,000 km = 1.0001604 AU
  //
  // The Titan's solids and both core stages burn out below roughly 200 km; the
  // Centaur's escape burn and the solid propulsion module that follows it are
  // both finished far under 1,000 km. At beat 2's own 14,000 km mark nothing
  // is thrusting — the stack is coasting on a hyperbola. The plume's throttle
  // table used to hold FULL until 1.00009, which is 13,500 km, so the beat
  // showed an engine firing four hundred kilometres of altitude after the
  // propellant was gone.
  //
  // Gated on the frame for the same reason `ascending` is: beat 1 sits at
  // exactly 1.0 AU too, and only SCALE tells the two apart.
  const BURN = [0.999999, 0.9999995, 1.0000027, 1.0000047];
  const burning = (d, rebase) => win(d, ...BURN) * frames(rebase, 2.0e6, 2.0e8);

  // Booms folded against the bus until after separation, then out. Real
  // Voyager deployed its science and magnetometer booms within about an hour
  // of launch, which on this axis is the stretch beat 2 covers — so the beat's
  // own midpoint lands mid-deployment rather than on a craft that is either
  // still packed or already finished.
  const deployAt = (d) => plin([[1.0000201, 0], [1.0001604, 1]], d / AU);

  return [
    // ======================================================================
    // THE NEAR PLANE — the spacecraft, on screen from the first frame to the
    // last.
    //
    // WHY THIS LAYER EXISTS. Measured on the contact sheet, a journey named
    // after a spacecraft contained one in 5 of its 22 beats. Every appearance
    // was its own windowed layer, so the craft blinked in and out, and between
    // the windows — which is most of the journey — the protagonist was simply
    // absent. The beats became a slideshow of planets that happened to be in
    // the right order. Worse, the five appearances were at five different
    // sizes in four different corners, so even where it WAS on screen there
    // was nothing for a reader to track from one beat to the next.
    //
    // So this is one continuous presence: same corner, same size, every beat.
    // Its position comes from `screenAnchoredMeters`, which rebuilds the camera's
    // own basis rather than authoring a world offset that would slide out of
    // frame as `azimuthAt` swings the camera 44° across the journey.
    //
    // It is NOT a HUD and must not read as a sticker, which is the obvious way
    // this fails. Three things keep it a real object in a real place: it sits
    // at a true 3.1 units in front of the lens, so it is genuinely nearer than
    // everything it passes and parallaxes against it; it is lit by the same
    // `SUN` vector as every world in the journey, so it dims with distance
    // along with them; and its attitude is a slow authored function of `u`, so
    // it turns across the journey and is never twice at the same angle. All
    // three are pure functions of `u` — rule 8 is intact, and the craft is
    // handed no clock any more than the camera is.
    // ======================================================================
    L('escort', 1.0, END_AU, () =>
      instrumentedProbe({
        ...PROBE(),
        // 0.115 of the frame, but seen from 3.1 units instead of the 6.2 the
        // frame law assumes, so it draws at about 140 px — big enough that the
        // dish ribs, the RTG cans and the magnetometer boom all resolve, small
        // enough to leave the beat's actual subject the subject.
        spanMeters: ({ rebase }) => rebase.frameMeters() * 0.115,
        lightDir: SUN,
        ambient: 0.16,
        // Lower right for the whole cruise — the copy panel is bottom-LEFT and
        // the ribbon runs along the bottom edge, so this is the one corner that
        // is never spoken for.
        //
        // Through the departure it is somewhere else: the LEADING half of the
        // separation pair, coming off the same centroid and tangent as the
        // spent stage, so the two read as one event rather than as two props at
        // two unrelated screen positions. It eases to its cruise corner as the
        // separation completes, and by the time beat 3 begins it is home.
        offsetMeters: ({ u, rebase }) => voyagerPositionMeters(dAt(u), rebase.frameMeters()),
        // A rear three-quarter that rolls slowly through the journey. The base
        // pitch is NEGATIVE on purpose: the dish's model direction is +y, so a
        // positive pitch turns its concave face to a camera on +z and the craft
        // collapses back into the lampshade this archetype was built to escape.
        attitude: ({ u }) => [
          -0.46 + 0.26 * Math.sin(u * 5.1),
          -0.70 + u * 1.9,
          0.16 + 0.10 * Math.cos(u * 3.4),
        ],
        // Folded until after separation. This is what lets beat 2 be an event
        // rather than a caption: the craft arrives packed, and the booms go
        // out across the beat.
        deploy: ({ u }) => deployAt(dAt(u)),
        respectBand: false,
        // Stands down for the hero shots, and while the stack is still under
        // power — but no longer for the whole ascent. Suppressing it all the
        // way to 22,000 km was an over-correction: a deployed Voyager cannot
        // fly beside a burning booster, but by 14,000 km it had separated and
        // its booms were already going out, so hiding it there was as wrong as
        // showing it deployed at 200 km. The honest boundary is BURNOUT, not
        // altitude.
        opacity: ({ u, rebase }) => {
          const d = dAt(u);
          return (1 - heroAny(d)) * (1 - burning(d, rebase));
        },
      })),

    // ======================================================================
    // THE FAR PLANE — on screen from the first frame to the last.
    // ======================================================================

    // The general starfield. Nine thousand points, not the first build's
    // 2,600 at half opacity: measured on `earth-to-moon`, a sparse field is
    // what an empty frame is made of, and deep space is not empty to look at.
    L('stars', 1.0, END_AU, () =>
      particleField({
        count: 9000,
        distribution: 'ball',
        seed: 11,
        colorA: 0xffffff,
        colorB: 0xc8d8ff,
        colorMode: 'random',
        size: 1.3,
        maxSize: 4.5,
        twinkle: 0.35,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 4.2,
        respectBand: false,
        opacity: () => 0.62,
      })),

    // THE MILKY WAY, in three layers, because it is three things.
    //
    // This is the single most consequential addition in the rework. From
    // outside an atmosphere the galactic band is the brightest structure in
    // the sky and it is there in every direction the spacecraft ever points;
    // drawing it is not decoration, it is the difference between a cruise beat
    // being a composition and being a black rectangle with a caption. It also
    // does the work `journey-craft` asks of the FLANKS: drag the view 32° and
    // the band sweeps through, so the world off to the sides is never void.
    //
    // (a) the diffuse glow — large soft sprites, well under full opacity,
    // because 4,000 additive sprites at 1.0 is a white wash and not a galaxy.
    L('galaxy-glow', 1.0, END_AU, () =>
      particleField({
        count: 4200,
        distribution: 'ball',
        seed: 17,
        flattenY: 0.075,
        rotation: GALACTIC,
        colorA: 0x5c6890,
        colorB: 0x232a46,
        colorMode: 'random',
        size: 2.4,
        maxSize: 96,
        twinkle: 0.05,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 3.0,
        respectBand: false,
        opacity: () => 0.20,
      })),
    // (b) the stars in it — dense, small, and pressed flatter than the glow so
    // the band has a bright spine rather than a uniform slab.
    L('galaxy-stars', 1.0, END_AU, () =>
      particleField({
        count: 22000,
        distribution: 'ball',
        seed: 19,
        flattenY: 0.055,
        rotation: GALACTIC,
        colorA: 0xf4f7ff,
        colorB: 0x93a8d8,
        colorMode: 'random',
        size: 1.0,
        maxSize: 3.0,
        twinkle: 0.22,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 3.4,
        respectBand: false,
        opacity: () => 0.5,
      })),
    // (c) the dark lanes. NORMAL blending, deliberately: additive cannot draw
    // a hole, and the great rift through Cygnus is a hole — the lesson
    // big-bang paid for three separate times with ash, dust and a molecular
    // cloud. It is also where most of this layer's CONTRAST comes from.
    L('galaxy-dust', 1.0, END_AU, () =>
      particleField({
        count: 1100,
        distribution: 'cloud',
        clumps: 26,
        clumpSpread: 0.13,
        seed: 23,
        flattenY: 0.045,
        rotation: GALACTIC,
        blending: 'normal',
        colorA: 0x0a0c14,
        colorB: 0x05060b,
        colorMode: 'random',
        size: 3.0,
        maxSize: 120,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 2.5,
        respectBand: false,
        opacity: () => 0.5,
      })),

    // THE SUN. The one subject on screen for the whole journey, and the thing
    // that carries continuity now that the probe does not.
    //
    // Its drawn glare is `0.103 × (d/AU)^-0.6` of the frame — 220 px at Earth,
    // 61 at Saturn, 24 at Pluto's distance, floored at 4 px so it survives as
    // a point in the closing frame. Its brightness is real inverse-square
    // flux. Only its BEARING is authored, and only because the honest one is
    // unrenderable: at 8 AU the Sun's true position is eight thousand
    // frame-widths off to the left. See plan.js for the blend that hands it
    // back to its true position at the one beat where that is renderable.
    // `planView` damps the drawn glare once the frame is wider than about
    // seven AU. The glare law is a fraction of the FRAME, which is right
    // everywhere the frame is sized to a subject and absurd in the opening
    // plan view, where 0.125 of 35 AU is a flare three astronomical units
    // across — wide enough to swallow Jupiter's and Saturn's own orbits, which
    // are the thing that beat is about. A camera artefact does not scale with
    // the map.
    L('sun', 1.0, END_AU, () =>
      glowSphere({
        radiusMeters: ({ u, rebase }) =>
          rebase.frameMeters() * sunGlare(dAt(u)) * planView(rebase),
        offsetMeters: ({ u, rebase }) => sunOffsetMeters(dAt(u), rebase.frameMeters()),
        color: 0xfff4e0,
        haloColor: 0xffdca4,
        haloScale: 4.0,
        respectBand: false,
        opacity: ({ u }) => 0.45 + 0.5 * clamp01(sunFlux(dAt(u)) * 2.2),
      })),
    // A tight hard core inside the glare, so the Sun still reads as a DISC at
    // 1 AU and as a star past 40 — one object, two regimes, no swap.
    L('sun-core', 1.0, END_AU, () =>
      glowSphere({
        radiusMeters: ({ u, rebase }) =>
          rebase.frameMeters() * sunGlare(dAt(u)) * planView(rebase) * 0.26,
        offsetMeters: ({ u, rebase }) => sunOffsetMeters(dAt(u), rebase.frameMeters()),
        color: 0xfffdf4,
        haloColor: 0xfff6e2,
        haloScale: 2.2,
        respectBand: false,
        opacity: () => 0.85,
      })),

    // THE PLAN. Flown part bright, unflown part faint — the distinction is the
    // whole archetype, and out here it is often the only thing in frame that
    // says where in the journey the reader is. Gated on the frame: at an
    // encounter the path is thousands of frame-widths long and would be a bare
    // ray through the middle of the picture.
    L('grand-tour-path', 1.0, 300, () =>
      trajectory({
        path: (s) => tourAt(s * TOUR_END),
        samples: 420,
        ticks: 30,
        tickSize: 3.2,
        color: 0xbfe0ff,
        colorAhead: 0x3c5a80,
        aheadOpacity: 0.30,
        offsetMeters: ({ u }) => {
          const p = tourAt(dAt(u));
          return [-p[0], -p[1], -p[2]];
        },
        progress: ({ u }) => dAt(u) / TOUR_END,
        opacity: ({ rebase }) => frames(rebase, 3.0e9, 3.0e13) * 0.75,
      })),

    // ======================================================================
    // BEAT 1 — THE GRAND TOUR ALIGNMENT.  frame 5.2e12 m (35 AU)
    // The one frame in the journey drawn as a PLAN rather than as a place:
    // the whole outer solar system at once, the Sun at its true centre, the
    // four targets strung left to right, and the path that visits them.
    // ======================================================================

    // The zodiacal cloud, and the debris disc beyond it — the plane everything
    // in this journey happens in, and the reason the opening frame is not four
    // dots on black. Real: the zodiacal light is the brightest diffuse feature
    // in the inner solar system's sky, and the dust extends out through the
    // belt and on into the Kuiper region.
    L('ecliptic-plane', 1.0, 1.02, () =>
      particleField({
        count: 17000,
        distribution: 'disk',
        innerRadius: 0.055,
        thickness: 0.028,
        seed: 29,
        rotation: [0.30, 0, 0.13],
        colorA: 0xffd6a2,
        colorB: 0x6a4c34,
        colorMode: 'random',
        size: 1.7,
        maxSize: 7,
        twinkle: 0.12,
        spin: 0.004,
        radiusMeters: A(31),
        offsetMeters: ({ u }) => [-dAt(u), 0, 0], // centred on the Sun, where it is
        opacity: ({ u }) => win(dAt(u), 1.0, 1.00002, 1.0004, 1.002) * 0.55,
      })),
    // The inner cloud is denser and warmer than the outer disc — two fields,
    // not one, so the plane has a bright core to sit the Sun in.
    L('ecliptic-core', 1.0, 1.02, () =>
      particleField({
        count: 9000,
        distribution: 'disk',
        innerRadius: 0.03,
        thickness: 0.05,
        seed: 31,
        rotation: [0.30, 0, 0.13],
        colorA: 0xffe6c0,
        colorB: 0xc08a58,
        colorMode: 'random',
        size: 2.0,
        maxSize: 9,
        twinkle: 0.18,
        radiusMeters: A(4.6),
        offsetMeters: ({ u }) => [-dAt(u), 0, 0],
        // Kept well under the outer disc's brightness: at 0.42 the inner cloud
        // was the brightest thing in the frame and the four markers this beat
        // is actually about were lost inside it.
        opacity: ({ u }) => win(dAt(u), 1.0, 1.00002, 1.0004, 1.002) * 0.16,
      })),

    // The four targets, as MARKERS. At a 35 AU frame Jupiter's true disc is a
    // fourteenth of a pixel, so these are diagram symbols drawn at true
    // RELATIVE sizes — Jupiter 70 px, Saturn 59, Uranus 26, Neptune 25, the
    // real radius ratios — sitting at their true orbital positions on the
    // plane. A plan is allowed to be a plan; what it is not allowed to do is
    // lie about which is bigger or where they are.
    ...[
      ['jupiter', R_JUPITER_AU, R_JUPITER, 0xffd9a0, 0xd8964a],
      ['saturn', R_SATURN_AU, R_SATURN, 0xf0dfae, 0xc8a25e],
      ['uranus', R_URANUS_AU, R_URANUS, 0xbdeef0, 0x6fb4bc],
      ['neptune', R_NEPTUNE_AU, R_NEPTUNE, 0x8aa8ff, 0x4058c8],
    ].map(([name, rAU, radius, color, halo]) =>
      L(`plan-${name}`, 1.0, 1.02, () =>
        glowSphere({
          radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.075 * (radius / R_JUPITER),
          // ON the tilted plane, not floating above it. The disc carries
          // `rotation: [0.30, 0, 0.13]` and THREE applies that XYZ, so a point
          // at radius `a` along the disc's own +x lands here — the same
          // transform the dust went through, written out rather than assumed
          // to be zero, which is what the first pass accidentally did.
          offsetMeters: ({ u }) => {
            const a = ahead(u, rAU);
            return [a * 0.9916, a * 0.1239, a * 0.0383];
          },
          color,
          haloColor: halo,
          haloScale: 4.2,
          solid: true,
          solidColor: color,
          segments: 20,
          respectBand: false,
          opacity: ({ u }) => win(dAt(u), 1.0, 1.00002, 1.0004, 1.002),
        }))),

    // Their orbits, on the plane. This is what turns four bright dots into an
    // ALIGNMENT: the copy's whole claim is that these four are on the same
    // side of the Sun at the same time, and four concentric circles with the
    // markers strung along one radius is the only way a still frame says it.
    ...[
      [R_JUPITER_AU, 0xd8a868],
      [R_SATURN_AU, 0xd0bc88],
      [R_URANUS_AU, 0x86c2cc],
      [R_NEPTUNE_AU, 0x6f86e0],
    ].map(([rAU, color], i) =>
      L(`plan-orbit-${i}`, 1.0, 1.02, () =>
        trajectory({
          path: (s) => {
            const th = s * Math.PI * 2;
            const r = A(rAU);
            // The same XYZ tilt the dust disc carries, applied to a circle in
            // the disc's own plane.
            const x = Math.cos(th) * r;
            const z = Math.sin(th) * r;
            const x2 = x * Math.cos(0.13);
            const y2 = x * Math.sin(0.13);
            return [x2, y2 * Math.cos(0.30) - z * Math.sin(0.30), y2 * Math.sin(0.30) + z * Math.cos(0.30)];
          },
          samples: 260,
          color,
          colorAhead: color,
          aheadOpacity: 1,
          progress: () => 1,
          offsetMeters: ({ u }) => [-dAt(u), 0, 0],
          respectBand: false,
          opacity: ({ u }) => win(dAt(u), 1.0, 1.00002, 1.0004, 1.002) * 0.75,
        }))),

    // ======================================================================
    // BEAT 2 — LEAVING EARTH.  frame 1.5e7 m
    // ======================================================================

    // EARTH HAS TO RECEDE, NOT POP.
    //
    // This layer used to be `L('earth', 1.0, 1.02, …)`, and 1.02 AU is three
    // million kilometres — the streamer hard-UNMOUNTED the planet there no
    // matter what its opacity said, so the world you are leaving vanished
    // between one beat and the next and no fade could have saved it. Measured
    // across the departure: Earth was absent at 4,655 km, absent at 6,410 km,
    // suddenly large at 8,758 km, and gone again by 1.18 AU. A journey whose
    // second beat is called "Leaving Earth" never showed Earth getting
    // smaller.
    //
    // Mounted now to 3 AU, so the planet survives as a shrinking disc and then
    // a point all the way into the cruise, which is what leaving somewhere
    // looks like.
    L('earth', 1.0, 3.0, () =>
      planet({
        radiusMeters: R_EARTH,
        // `+ R_EARTH`, and it is not a nicety. `fromEarth(m) = (AU + m)/AU`,
        // and the ribbon prints `m` as "km from Earth" — an ALTITUDE. This
        // layer was placing Earth's CENTRE at `m`, so the two disagreed by one
        // planetary radius, and since beat 1 holds to `fromEarth(6e6)` — 6,000
        // km, well inside a 6,371 km planet — the opening of this journey put
        // the camera underground. A sphere with front-face culling seen from
        // inside draws nothing at all, which is exactly what the first three
        // departure samples showed: no Earth, then Earth enormous the moment
        // the axis climbed out through the crust.
        offsetMeters: ({ u }) => [-(dAt(u) - AU + R_EARTH), 0, 0],
        lightDir: EARTH_SUN,
        rock: 0x5b5140,
        atmosphere: 0x6ab4ff,
        atmosphereScale: 1.016,
        spin: 0.006,
        // 256, not 128: the disc is a third of the frame here, and at 128 the
        // limb shows as visible facets — a polygon where a world should be.
        segments: 256,
        respectBand: false,
        surface: () => ({
          magma: 0, seaLevel: 0.5, green: 0.85, ice: 0.26,
          night: 1, atmosphere: 1, bands: 0,
        }),
        // The old gate was `frames(rebase, 2.0e6, 9.0e8)`, which is zero above
        // 9e8 m of frame. The FRAME table runs 5.2e12 at beat 1 down to 1.5e7
        // at beat 2 and back out to 1.0e11 at beat 3, so that gate could only
        // ever be open in a thin slice in the middle — the pop, in one line.
        // The upper bound now reaches past the cruise frame, and Earth simply
        // becomes small, which is correct: at 1.5 AU it is a couple of pixels
        // and it should be.
        opacity: ({ rebase }) => frames(rebase, 2.0e6, 2.4e11),
      })),

    // The Titan-Centaur, still burning. Drawn at a formation-camera size —
    // 0.083 of the frame, about 55 px — because a real 48 m stack at a
    // 15,000 km frame is four thousandths of a pixel. Same trade every
    // spacecraft in this project makes; the BODIES stay true.
    L('booster', 1.0, 1.0006, () =>
      vehicle({
        lengthMeters: ({ rebase }) => rebase.frameMeters() * 0.20,
        bands: 6,
        bandDepth: 0.5,
        lightDir: SUN,
        // The stack SHEDS, which is the whole reason `vehicle` has `shed` and
        // this layer was not using it. By beat 2's own mark the Titan core is
        // long gone and what is still flying is the Centaur and the payload —
        // so those two stages leave, on the axis, at the altitudes they really
        // left at, and the beat shows discarded hardware rather than a full
        // launch vehicle parked in orbit.
        stages: [
          { span: 0.34, r: 0.055, color: 0xe8ebef, nozzles: 2, nozzleR: 0.02,
            shed: ({ u }) => plin([[1.0000007, 0], [1.0000015, 1]], dAt(u) / AU) },
          { span: 0.22, r: 0.050, color: 0xdfe3e8, nozzles: 1, nozzleR: 0.018,
            shed: ({ u }) => plin([[1.0000020, 0], [1.0000031, 1]], dAt(u) / AU) },
          { span: 0.18, r: 0.036, color: 0xd6dbe2, nozzles: 1, nozzleR: 0.016 },
        ],
        capsule: { span: 0.10, r: 0.026, color: 0xb9c2cc, cone: 1 },
        // No `fins` here any more, and not because a coasting stage has no use
        // for them: `vehicle` DECLARES a `fins` parameter and never reads it.
        // Nothing was ever drawn. The config sat here looking like a feature
        // for as long as this journey has existed.
        plume: {
          span: 0.8, r: 0.05, core: 0xdff0ff, edge: 0x6aa4ff, gain: 0.8,
          smoke: 0x14181e, smokeEdge: 0x080a0c, smokeGain: 0.1, soft: 1.4,
          // Out by 700 km. See BURN above for why the old table — full thrust
          // until 1.00009, which is 13,500 km — was showing a dead engine
          // firing.
          throttle: ({ u }) => plin([[1.0000027, 1], [1.0000047, 0]], dAt(u) / AU),
        },
        // Discarded hardware TUMBLES. A spent stage holding a rigid attitude
        // reads as a second working spacecraft flying in formation, which is
        // most of why this frame looked like two unrelated props: nothing about
        // either object said which one was still under control.
        attitude: ({ u }) => {
          const p = separationProgress(dAt(u));
          return [1.05 + 2.30 * p, 0.35 + 0.62 * p, 0.20 + 2.85 * p];
        },
        // TRAILING half of the separation pair. It used to be independently
        // screen-anchored at its own `right`/`up`/`ahead`, which pinned it at a
        // fixed spot in the frame forever — so it never fell behind, never
        // moved relative to the spacecraft it had just released, and never
        // shared a direction of travel with it. Both bodies now come off one
        // centroid and one tangent in `plan.js`; see `separationFormation`.
        offsetMeters: ({ u, rebase }) =>
          separationFormation(dAt(u), rebase.frameMeters()).stage,
        respectBand: false,
        // Gated on the FRAME as well as on the axis. Beat 1 sits at almost the
        // same heliocentric range as beat 2 — they are 4,000 km apart on an
        // axis 5.5 decades long — so a window in `d` alone cannot separate
        // them, and the launch stack turned up in the plan view drawn at
        // 0.20 of a 35 AU frame: a rocket seven astronomical units long
        // lying across the solar system. What actually distinguishes the two
        // beats is the SCALE, so that is what this reads.
        opacity: ({ u, rebase }) => ascending(dAt(u), rebase),
      })),

    // The escape trajectory, leaving Earth and arcing away to frame right.
    // Its own short path, not the Grand Tour one — at this frame that spans
    // 340,000 frame-widths and is a bare ray through the picture.
    L('departure-path', 1.0, 1.0008, () =>
      trajectory({
        path: departurePathAt,
        samples: 220,
        ticks: 14,
        tickSize: 3.0,
        color: 0xbfe0ff,
        colorAhead: 0x3c5a80,
        aheadOpacity: 0.32,
        // Translated so the path's own progress point lands ON the spacecraft.
        // It used to be `[0, 0, 0]` — the line drawn wherever its formula put
        // it in world space, while the craft was placed by screen anchoring, so
        // the trajectory ran across empty frame and Voyager flew beside it.
        // With this the line comes out from behind the craft, through it, and
        // on ahead along the same tangent the separation splits along.
        offsetMeters: ({ u, rebase }) => departurePathOffsetMeters(dAt(u), rebase.frameMeters()),
        progress: ({ u }) => departureProgress(dAt(u)),
        opacity: ({ u, rebase }) =>
          win(dAt(u), 1.000002, 1.00001, 1.00025, 1.0006) * frames(rebase, 2.0e6, 4.0e8) * 0.8,
      })),

    // ======================================================================
    // BEAT 3 — INTO DEEP CRUISE.  frame 1.0e11 m, at 1.95 AU
    // The spacecraft is the subject here and it is the only beat where it is
    // drawn large enough to be looked at rather than found.
    // ======================================================================

    // Local zodiacal dust — we are inside the cloud now, so it is a band
    // across the frame rather than a disc seen from outside it.
    L('cruise-dust', 1.1, 6.0, () =>
      particleField({
        count: 17000,
        distribution: 'disk',
        innerRadius: 0.02,
        thickness: 0.10,
        seed: 37,
        rotation: [0.20, 0, 0.16],
        colorA: 0xf0cfa4,
        colorB: 0x6e5138,
        colorMode: 'random',
        size: 1.9,
        maxSize: 9,
        twinkle: 0.15,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 2.6,
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 1.15, 1.5, 2.6, 4.4) * 0.62,
      })),

    // Mars, already behind. A point of light with a halo, never geometry: at
    // 0.43 AU its true disc is a fifth of a pixel, and inflating it would be a
    // lie the reader can measure. Its bearing is authored — heliocentric range
    // cannot say where Mars is in its own orbit — and pushed off the ecliptic
    // line so it does not collide with the Sun's glare.
    L('mars-point', 1.2, 2.8, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.012,
        offsetMeters: ({ u, rebase }) => {
          const k = rebase.frameMeters() / 4;
          return [ahead(u, R_MARS_AU), -0.45 * k, -0.7 * k];
        },
        color: 0xe08a52,
        haloColor: 0xc06030,
        haloScale: 3.6,
        solid: true,
        solidColor: 0xe89a62,
        segments: 16,
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 1.25, 1.45, 2.3, 2.7) * 0.95,
      })),

    // The bus itself: no wings — Voyager is RTG-powered, not solar — a big
    // high-gain dish, and a boom. This is the one beat where the spacecraft is
    // the subject rather than a speck, so it is drawn to be LOOKED AT: 0.32 of
    // the frame, about 180 px. The first pass drew it at 0.135 and produced a
    // white fleck in the corner of an empty picture — "the beat about the
    // spacecraft contained no visible spacecraft", which is the exact defect
    // `journey-craft` records for earth-to-moon's mid-coast.
    L('probe-cruise', 1.3, 2.6, () =>
      instrumentedProbe({
        ...PROBE(),
        spanMeters: ({ rebase }) => rebase.frameMeters() * 0.32,
        lightDir: SUN,
        ambient: 0.14,
        // Three-quarter, not dish-on. A parabolic antenna pointed at the
        // camera is a white circle — a lampshade — and the whole reason this
        // beat draws the craft large is so the bus, the booms and the dish
        // read as different things. Tipped AWAY rather than toward: the back
        // of the dish carries the radial ribs and the rim ring, which is far
        // more structure than the smooth concave face has, and at this angle
        // the feed on its tripod clears the rim and is silhouetted against
        // sky. Tipping it toward the camera instead gave a flat dark ellipse
        // with the tripod lost inside it — measured by looking at both.
        attitude: () => [0.45, -0.62, 0.24],
        offsetMeters: ({ rebase }) => units(rebase, 1.05, 0.30, 1.9),
        respectBand: false,
        opacity: ({ u }) => hero(dAt(u), 'cruise'),
      })),

    // ======================================================================
    // BEAT 4 — THE ASTEROID BELT.  frame 1.2e4 m, at 3.35 AU
    // The journey dives to the scale of a single body, the way big-bang dives
    // to a cell and to a clay tablet. The copy's whole point is that the belt
    // is mostly empty — which is a statement you can only make believable by
    // showing what the rock actually looks like when you do meet some.
    // ======================================================================

    // Three scatters at three different heights and three different distances,
    // because `rocks` lays its instances on one plane and one plane seen from
    // inside it is a ROW of lumps at one size — which is what the first pass
    // rendered. Depth in this beat has to be built out of separate layers.
    L('belt-rock-near', 2.4, 4.2, () =>
      rocks({
        count: 4,
        seed: 39,
        sizeMeters: [1400, 2600],
        areaMeters: 9000,
        centreClear: 4200,
        spreadYMeters: 3200,
        buryFraction: 0.5,
        angularity: 0.42,
        rock: 0x342e26,
        dry: 0x8a7a60,
        ambient: 0x262218,
        lightDir: SUN,
        // Back off the lens. At 2.1 units in front of the origin these filled
        // the whole frame and the beat read as a rockslide rather than as the
        // emptiest place a spacecraft crosses.
        offsetMeters: ({ rebase }) => units(rebase, -1.5, 0.35, 0.6),
        respectBand: false,
        opacity: ({ u, rebase }) => win(dAt(u), 2.6, 2.95, 3.7, 4.1) * frames(rebase, 2.0e3, 1.2e5),
      })),
    L('belt-rocks', 2.4, 4.2, () =>
      rocks({
        count: 34,
        seed: 41,
        sizeMeters: [140, 2500],
        areaMeters: 11000,
        centreClear: 1300,
        spreadYMeters: 5000,
        buryFraction: 0.5, // floating, not sitting on anything
        angularity: 0.38,
        rock: 0x3a342c,
        dry: 0x8a7c64,
        ambient: 0x262218,
        lightDir: SUN,
        offsetMeters: ({ rebase }) => units(rebase, -0.4, -0.75, -0.6),
        respectBand: false,
        opacity: ({ u, rebase }) => win(dAt(u), 2.6, 2.95, 3.7, 4.1) * frames(rebase, 2.0e3, 1.2e5),
      })),
    // A second scatter, small and far, so the field recedes instead of being
    // one row of boulders at one distance.
    L('belt-rocks-far', 2.4, 4.2, () =>
      rocks({
        count: 60,
        seed: 43,
        sizeMeters: [60, 500],
        areaMeters: 34000,
        centreClear: 9000,
        spreadYMeters: 14000,
        buryFraction: 0.5,
        angularity: 0.34,
        rock: 0x2e2a24,
        dry: 0x6e6454,
        ambient: 0x1c1a16,
        lightDir: SUN,
        offsetMeters: ({ rebase }) => units(rebase, 0.6, 0.15, -3.0),
        respectBand: false,
        opacity: ({ u, rebase }) => win(dAt(u), 2.6, 2.95, 3.7, 4.1) * frames(rebase, 2.0e3, 1.2e5) * 0.9,
      })),
    // Chips and grit off the same population — the thing that makes a rock
    // field read as a place with weather rather than as five props.
    L('belt-grit', 2.4, 4.2, () =>
      particleField({
        count: 4200,
        distribution: 'cloud',
        clumps: 40,
        clumpSpread: 0.22,
        seed: 47,
        flattenY: 0.35,
        colorA: 0xa89880,
        colorB: 0x4a4238,
        colorMode: 'random',
        size: 2.2,
        maxSize: 9,
        twinkle: 0.25,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 2.2,
        respectBand: false,
        opacity: ({ u, rebase }) => win(dAt(u), 2.6, 2.95, 3.7, 4.1) * frames(rebase, 2.0e3, 1.2e5) * 0.55,
      })),
    // No probe layer here any more. There used to be one at 0.045 of the frame
    // — about 25 px, a speck — and it was standing the escort DOWN to do it, so
    // the belt beat traded a legible spacecraft for an invisible one. The
    // escort in the near foreground is the craft for this beat.

    // ======================================================================
    // BEATS 5–9 — JUPITER.
    // One planet layer serves the approach, the Great Red Spot beat and the
    // assist; the two moon beats get their own frames and their own Jupiter,
    // placed at the moon's real orbital radius so the giant subtends its true
    // angle from there — 19° from Io, 12° from Europa. Those two numbers are
    // where the "huge curved band" and the "bright crescent edge" come from,
    // and they are measured rather than composed.
    // ======================================================================

    // TWO layers, not one, and the split is a bug fix rather than a style
    // choice: the first pass ran a single `jupiter` from 4.0 to 5.2002 AU,
    // which unmounts before the gravity-assist beat at 5.20067 — so the beat
    // whose entire subject is Jupiter's limb rendered with no Jupiter in it,
    // and scored 0.267 occupancy off the galactic band alone. The moon beats
    // in between draw their own Jupiter at their own moon's orbital radius, so
    // the main planet has to be OUT across that stretch and back for the
    // assist.
    ...[
      ['jupiter', 4.0, 5.20024, [5.19, 5.192, 5.20019, 5.20024]],
      ['jupiter-assist', 5.20056, 5.2009, [5.20057, 5.20061, 5.200755, 5.2009]],
    ].map(([id, fromAU, toAU, env]) =>
      L(id, fromAU, toAU, () =>
        planet({
          radiusMeters: R_JUPITER,
          offsetMeters: ({ u }) => [ahead(u, R_JUPITER_AU), 0, 0],
          lightDir: SUN,
          rock: 0xd8bd93,
          atmosphere: 0xf0d8ae,
          atmosphereScale: 1.012,
          bands: 0.85,
          bandColor: 0x9c6a44,
          bandFreq: 24,
          spin: 0.03,
          segments: 192,
          respectBand: false,
          surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0, night: 0, atmosphere: 0.55 }),
          opacity: ({ u, rebase }) => win(dAt(u), ...env) * frames(rebase, 2.0e7, 4.0e9),
        }))),
    // The Great Red Spot: a storm wider than Earth, placed on the near face
    // below the equator. `blob` because it is a fluid vortex with a soft edge,
    // not a marking — and drawn in front of the sphere's own surface, so
    // depth-testing keeps it on the near hemisphere where it belongs.
    L('great-red-spot', 5.19995, 5.20024, () =>
      blob({
        count: 1,
        radiusMeters: R_JUPITER * 0.21,
        seed: 53,
        wobble: 0.10,
        // On the disc, not on the limb. The first placement sat 38° from the
        // sub-camera point on a body whose visible half-angle is 28°, so the
        // storm was hanging off the edge of the planet like a bead; 21° puts
        // it inside the disc and below the equator, where it is.
        offsetMeters: ({ u }) => [
          ahead(u, R_JUPITER_AU) - R_JUPITER * 0.10,
          -R_JUPITER * 0.36,
          R_JUPITER * 0.93,
        ],
        fill: 0xa8492a,
        rim: 0xe08a5c,
        rimPower: 1.7,
        fillAlpha: 0.7,
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 5.19998, 5.20004, 5.20019, 5.20024),
      })),
    // …and the pale wake that trails it round the belt, which is the thing
    // that makes the spot read as something MOVING in a fluid.
    L('grs-wake', 5.19995, 5.20024, () =>
      particleField({
        count: 1800,
        distribution: 'cloud',
        clumps: 16,
        clumpSpread: 0.30,
        seed: 59,
        flattenY: 0.16,
        blending: 'normal',
        colorA: 0xe8d0a8,
        colorB: 0xa87a52,
        colorMode: 'random',
        size: 6,
        maxSize: 30,
        radiusMeters: R_JUPITER * 0.50,
        offsetMeters: ({ u }) => [
          ahead(u, R_JUPITER_AU) - R_JUPITER * 0.52,
          -R_JUPITER * 0.36,
          R_JUPITER * 0.80,
        ],
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 5.19998, 5.20005, 5.20019, 5.20024) * 0.5,
      })),

    // The approach used to draw its own probe here, at 0.075 of the frame and
    // muting the escort to do it. Same bad trade as the belt: 40 px of
    // spacecraft in place of 140. Jupiter's lit face is still the subject of
    // this beat and the escort still crosses it, near and legible.

    // --- Io ---------------------------------------------------------------
    // The most volcanically active body in the solar system, and the one place
    // in this journey where `planet`'s magma term is the honest setting rather
    // than an effect: Io's surface really is repaved by sulphur and silicate
    // volcanism faster than craters can accumulate on it.
    L('io', 5.20026, 5.20040, () =>
      planet({
        radiusMeters: R_IO,
        offsetMeters: ({ rebase }) => units(rebase, 0.15, -0.30, 0.9),
        lightDir: SUN,
        rock: 0xd8c268,
        atmosphere: 0xffe08a,
        atmosphereScale: 1.006,
        spin: 0.02,
        segments: 160,
        respectBand: false,
        surface: () => ({ magma: 0.30, seaLevel: -1, green: 0, ice: 0, night: 0, atmosphere: 0.25 }),
        opacity: ({ u }) => win(dAt(u), 5.200265, 5.20029, 5.200375, 5.20040),
      })),
    // The plume. Hundreds of kilometres high, off the limb and against black —
    // an event has to be composed against something that is not the thing it
    // is happening to, or the reader assigns it to the wrong object.
    L('io-plume', 5.20026, 5.20040, () =>
      particleField({
        count: 2600,
        distribution: 'cloud',
        clumps: 3,
        clumpSpread: 0.14,
        seed: 61,
        // Stretched hard along y: a plume is a COLUMN, and a cloud archetype
        // with round clumps reads as a firework going off beside the moon.
        flattenY: 4.2,
        colorA: 0xfff0c0,
        colorB: 0xd87a2a,
        colorMode: 'random',
        size: 3.4,
        maxSize: 16,
        twinkle: 0.3,
        radiusMeters: R_IO * 0.42,
        offsetMeters: ({ rebase }) => {
          const k = rebase.frameMeters() / 4;
          return [0.15 * k - R_IO * 0.62, -0.30 * k + R_IO * 1.05, 0.9 * k + R_IO * 0.3];
        },
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 5.20027, 5.200295, 5.200375, 5.20040) * 0.75,
      })),
    // A second, older plume on the far limb, low and wide.
    L('io-plume-b', 5.20026, 5.20040, () =>
      particleField({
        count: 1200,
        distribution: 'cloud',
        clumps: 4,
        clumpSpread: 0.26,
        seed: 67,
        flattenY: 1.4,
        colorA: 0xffd08a,
        colorB: 0xa8522a,
        colorMode: 'random',
        size: 3.0,
        maxSize: 13,
        radiusMeters: R_IO * 0.30,
        offsetMeters: ({ rebase }) => {
          const k = rebase.frameMeters() / 4;
          return [0.15 * k + R_IO * 0.86, -0.30 * k + R_IO * 0.62, 0.9 * k - R_IO * 0.2];
        },
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 5.20027, 5.200295, 5.200375, 5.20040) * 0.55,
      })),
    // Jupiter, from Io's orbit: 4.217e8 m away, 19° across, filling the top of
    // the frame. The distance is real and the angle falls out of it.
    L('jupiter-from-io', 5.20026, 5.20040, () =>
      planet({
        radiusMeters: R_JUPITER,
        offsetMeters: () => {
          const d = [-0.42, 0.36, -0.83];
          const n = Math.hypot(...d);
          return d.map((v) => (v / n) * D_IO);
        },
        lightDir: SUN,
        rock: 0xd8bd93,
        atmosphere: 0xf0d8ae,
        atmosphereScale: 1.012,
        bands: 0.85,
        bandColor: 0x9c6a44,
        bandFreq: 24,
        spin: 0.03,
        segments: 160,
        respectBand: false,
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0, night: 0, atmosphere: 0.5 }),
        opacity: ({ u }) => win(dAt(u), 5.200265, 5.20029, 5.200375, 5.20040),
      })),

    // --- Europa -----------------------------------------------------------
    L('europa', 5.20044, 5.20058, () =>
      planet({
        radiusMeters: R_EUROPA,
        offsetMeters: ({ rebase }) => units(rebase, 0.35, -0.10, 1.0),
        lightDir: SUN,
        // Not white. `trajectory` is additive-only, so the fractures can only
        // be drawn BRIGHTER than what is under them — and on a white ball
        // there is no headroom left to be brighter in. A blue-grey ice with
        // bright ridges is also closer to what the images show: the lineae are
        // double ridges catching the light, not scratches.
        rock: 0xa8b6c2,
        atmosphere: 0xdcecf6,
        atmosphereScale: 1.004,
        spin: 0.015,
        segments: 160,
        respectBand: false,
        // seaLevel below zero so the shader's land term is 1 everywhere —
        // there is no exposed water here and the ocean stops would paint the
        // ice blue. What is left is the ice's own mottling.
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0.55, night: 0, atmosphere: 0.2 }),
        opacity: ({ u }) => win(dAt(u), 5.200445, 5.20047, 5.200555, 5.20058),
      })),
    // The lineae. Long straight fractures with almost no craters between them
    // is the entire content of this beat, and `planet`'s fbm cannot make a
    // line — so the cracks are drawn as arcs on the sphere with `trajectory`,
    // which is what that archetype is for (a path through space, and a great
    // circle is a path). Six of them, at different inclinations, standing a
    // hair proud of the surface so depth-testing hides the far halves.
    // ARCS, not circles. The first pass drew ten complete great circles, and
    // ten complete great circles on a sphere is a lat/long WIREFRAME — the
    // frame read as a globe in a physics diagram, not as cracked ice. Real
    // lineae are finite: they start somewhere, run a few thousand kilometres
    // and stop. Each entry below carries where its arc begins and how much of
    // the circle it covers, and no two are the same length.
    ...[
      [0.15, 0.9, 0.42, 0.05, 0.30, 71],
      [-0.35, 0.7, -0.6, 0.62, 0.22, 73],
      [0.62, 0.2, 0.75, 0.18, 0.38, 79],
      [-0.75, 0.45, 0.48, 0.44, 0.19, 83],
      [0.05, -0.55, 0.83, 0.71, 0.26, 89],
      [0.85, 0.5, -0.2, 0.33, 0.34, 97],
      [0.30, 0.85, -0.45, 0.80, 0.17, 101],
      [-0.55, 0.25, 0.79, 0.12, 0.28, 103],
      [0.72, -0.35, 0.60, 0.55, 0.23, 107],
      [-0.15, 0.62, 0.77, 0.26, 0.31, 109],
      [0.44, 0.10, -0.89, 0.66, 0.20, 113],
      [-0.88, 0.32, 0.35, 0.08, 0.25, 127],
    ].map(([ax, ay, az, arc0, arcLen, seed], i) =>
      L(`europa-linea-${i}`, 5.20044, 5.20058, () =>
        trajectory({
          // An arc of the great circle about the axis (ax, ay, az), a hair
          // above the surface. Two perpendicular basis vectors are built from
          // the axis so the arc is genuinely on the sphere at any inclination.
          path: (s) => {
            const n = Math.hypot(ax, ay, az);
            const a = [ax / n, ay / n, az / n];
            const t = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
            const e1 = [
              a[1] * t[2] - a[2] * t[1],
              a[2] * t[0] - a[0] * t[2],
              a[0] * t[1] - a[1] * t[0],
            ];
            const l1 = Math.hypot(...e1);
            const u1 = e1.map((v) => v / l1);
            const u2 = [
              a[1] * u1[2] - a[2] * u1[1],
              a[2] * u1[0] - a[0] * u1[2],
              a[0] * u1[1] - a[1] * u1[0],
            ];
            const th = (arc0 + s * arcLen) * Math.PI * 2;
            const r = R_EUROPA * 1.004;
            return [
              (u1[0] * Math.cos(th) + u2[0] * Math.sin(th)) * r,
              (u1[1] * Math.cos(th) + u2[1] * Math.sin(th)) * r,
              (u1[2] * Math.cos(th) + u2[2] * Math.sin(th)) * r,
            ];
          },
          samples: 120,
          color: 0xffc898,
          colorAhead: 0xffc898,
          aheadOpacity: 1,
          progress: () => 1,
          offsetMeters: ({ rebase }) => units(rebase, 0.35, -0.10, 1.0),
          respectBand: false,
          opacity: ({ u }) => win(dAt(u), 5.20045, 5.200475, 5.200555, 5.20058) * (0.62 + (seed % 7) * 0.055),
        }))),
    // Jupiter from Europa's orbit: 6.711e8 m, 12° across, and mostly on its
    // night side from here — the "bright crescent edge" is the real phase.
    L('jupiter-from-europa', 5.20044, 5.20058, () =>
      planet({
        radiusMeters: R_JUPITER,
        offsetMeters: () => {
          const d = [-0.52, 0.10, -0.85];
          const n = Math.hypot(...d);
          return d.map((v) => (v / n) * D_EUROPA);
        },
        lightDir: SUN,
        rock: 0xd8bd93,
        atmosphere: 0xf0d8ae,
        atmosphereScale: 1.014,
        bands: 0.85,
        bandColor: 0x9c6a44,
        bandFreq: 24,
        spin: 0.03,
        segments: 128,
        respectBand: false,
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0, night: 0, atmosphere: 0.9 }),
        opacity: ({ u }) => win(dAt(u), 5.200445, 5.20047, 5.200555, 5.20058),
      })),

    // --- the gravity assist ------------------------------------------------
    // The bend, drawn. The path comes in from frame left, wraps Jupiter's limb
    // and leaves faster and in a different direction — flown bright, unflown
    // faint, which is the only way a reader can see that this is a manoeuvre
    // rather than a coast.
    L('assist-path', 5.20058, 5.20080, () =>
      trajectory({
        // A REAL HYPERBOLA, and — this is the part the first pass got wrong —
        // drawn in the x–y plane. The bend was authored in z, and z is the
        // camera's own axis: a curve that deflects toward the lens projects to
        // a straight line, so the beat about a trajectory being bent rendered
        // as a ruler laid across the frame. The deflection has to happen in
        // the SCREEN plane to be a deflection at all.
        //
        // e = 1.5, periapsis 4.9 Jupiter radii — Voyager 1's real closest
        // approach — a hyperbolic flyby that turns
        // the incoming asymptote by about 84°, which is the order of the real
        // Voyager 1 Jupiter encounter.
        path: (s) => {
          const e = 1.5;
          const p = 4.9 * R_JUPITER;
          // ±0.45π, not ±0.72π. A hyperbola's radius runs away as the true
          // anomaly approaches acos(-1/e), and at 0.72π this path reached
          // 135 Jupiter radii — 284 world units — so all but a sliver of it,
          // and all but two of its ticks, were outside the frame. Clipped
          // here at 9.9 R_J, which keeps the whole turn inside the frustum.
          const th = (-0.45 + s * 0.90) * Math.PI;
          const r = (p * (1 + e)) / (1 + e * Math.cos(th));
          // Periapsis on the RIGHT of the planet — the side the frame has room
          // on. Jupiter's own centre already sits three units off-axis to the
          // left at this beat, so a periapsis swung left put the closest
          // approach, the ticks and the ship all outside the frustum.
          const a = th - 0.35;
          return [Math.cos(a) * r, Math.sin(a) * r, 0];
        },
        samples: 360,
        ticks: 46,
        tickSize: 5.4,
        color: 0xeaf6ff,
        colorAhead: 0x5478a4,
        aheadOpacity: 0.38,
        // Centred on Jupiter, because that is what it is orbiting.
        offsetMeters: ({ u }) => [ahead(u, R_JUPITER_AU), 0, R_JUPITER * 1.15],
        progress: ({ u }) => clamp01((dAt(u) / AU - 5.20060) / 0.00013),
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 5.200595, 5.20062, 5.200745, 5.20080) * 0.95,
      })),
    L('probe-assist', 5.20058, 5.20080, () =>
      instrumentedProbe({
        ...PROBE(),
        spanMeters: ({ rebase }) => rebase.frameMeters() * 0.095,
        lightDir: SUN,
        ambient: 0.12,
        attitude: () => [0.3, -1.1, 0.25],
        // ON the path, at the point `progress` has reached — one formula, not
        // two that have to agree. The hyperbola above is evaluated here with
        // the same parameters, so the craft cannot drift off its own
        // trajectory whatever the frame does.
        offsetMeters: ({ u }) => {
          const e = 1.5;
          const p = 4.9 * R_JUPITER;
          const s = clamp01((dAt(u) / AU - 5.20060) / 0.00013);
          const th = (-0.45 + s * 0.90) * Math.PI;
          const r = (p * (1 + e)) / (1 + e * Math.cos(th));
          const a = th - 0.35;
          return [ahead(u, R_JUPITER_AU) + Math.cos(a) * r, Math.sin(a) * r, R_JUPITER * 1.15];
        },
        respectBand: false,
        opacity: ({ u }) => hero(dAt(u), 'assist'),
      })),

    // ======================================================================
    // BEAT 10 — CRUISE TO SATURN.  frame 2.3e11 m, at 8.6 AU
    // The emptiest beat that survived the cut, and the test of whether the
    // far plane is doing its job: the ship in a new attitude, Saturn a point
    // at its TRUE offset a full AU ahead, Jupiter a brighter point behind, and
    // the galactic band across everything.
    // ======================================================================

    L('saturn-point', 6.2, 9.3, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.010,
        offsetMeters: ({ u, rebase }) => {
          const k = rebase.frameMeters() / 4;
          return [ahead(u, R_SATURN_AU), 0.18 * k, -0.5 * k];
        },
        color: 0xf0dfae,
        haloColor: 0xc8a25e,
        haloScale: 4.2,
        solid: true,
        solidColor: 0xf4e6c0,
        segments: 18,
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 6.6, 7.4, 9.0, 9.3),
      })),
    L('jupiter-behind', 5.6, 9.3, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.011,
        offsetMeters: ({ u, rebase }) => {
          const k = rebase.frameMeters() / 4;
          return [ahead(u, R_JUPITER_AU), -0.35 * k, 0.7 * k];
        },
        color: 0xffd9a0,
        haloColor: 0xd8964a,
        haloScale: 4.0,
        solid: true,
        solidColor: 0xffe0b0,
        segments: 18,
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 5.9, 6.6, 8.9, 9.3) * 0.9,
      })),
    L('probe-cruise-2', 7.0, 9.3, () =>
      instrumentedProbe({
        ...PROBE(),
        spanMeters: ({ rebase }) => rebase.frameMeters() * 0.36,
        lightDir: SUN,
        ambient: 0.13,
        // Seen from BELOW and from the far side, which is a genuinely
        // different read from the cruise portrait without being edge-on. The
        // first pass at this held `vehicle`'s 77° pitch, which on a craft made
        // of thin booms turns the dish into a sliver and cost the beat half
        // its occupancy — a solid bowl-and-tube could afford that and a real
        // probe cannot.
        // Dish tipped toward the camera from under it and the bus rolled:
        // measurably a different object from the cruise portrait five beats
        // earlier, which is the whole reason it is drawn again at all. Seen
        // from here the RTG boom crosses the dish rather than hanging beneath
        // it, which is a silhouette `vehicle` could not produce at any angle.
        attitude: () => [-0.85, 1.15, -0.55],
        offsetMeters: ({ rebase }) => units(rebase, -1.35, -0.5, 2.2),
        respectBand: false,
        opacity: ({ u }) => hero(dAt(u), 'cruise2'),
      })),
    // Interplanetary dust, thinning with distance — the same population as the
    // inner-system band, honestly sparser out here.
    L('outer-dust', 5.6, 16, () =>
      particleField({
        count: 6000,
        distribution: 'disk',
        innerRadius: 0.02,
        thickness: 0.055,
        seed: 101,
        rotation: [0.22, 0, 0.18],
        colorA: 0xbcc4d8,
        colorB: 0x4a5064,
        colorMode: 'random',
        size: 1.5,
        maxSize: 6,
        twinkle: 0.2,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 2.4,
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 6.0, 7.2, 12, 15) * 0.34,
      })),

    // ======================================================================
    // BEATS 11–13 — SATURN.
    // ======================================================================

    L('saturn', 9.2, 9.5806, () =>
      planet({
        radiusMeters: R_SATURN,
        offsetMeters: ({ u }) => [ahead(u, R_SATURN_AU), 0, 0],
        lightDir: SUN,
        rock: 0xe4cc9e,
        atmosphere: 0xf4e2b6,
        atmosphereScale: 1.014,
        bands: 0.55,
        bandColor: 0xc0a068,
        bandFreq: 20,
        spin: 0.026,
        segments: 192,
        respectBand: false,
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0, night: 0, atmosphere: 0.5 }),
        opacity: ({ rebase }) => frames(rebase, 2.0e7, 3.0e9),
      })),

    // THE RINGS, as particles rather than as a sheet — which is what the copy
    // says they are, and also the only way the Cassini division can be a real
    // gap rather than a painted line. Two annuli at their true radii with the
    // division genuinely empty between them, plus the dim C ring inside.
    //
    // Two SETS of these exist: one lying in the y=0 plane, which the camera
    // (also at y=0) sees exactly edge-on as a razor line, and one tilted 25°
    // into the light. The swap between them is the swap the copy describes —
    // "from certain angles… tilted into sunlight" — and it happens in the gap
    // between the two beats, not inside either of them.
    ...[
      ['edge', [0.010, 0, 0.02], 9.2, 9.5801, 9.5802, [9.30, 9.50, 9.58015, 9.58021]],
      ['lit', [0.44, 0, 0.14], 9.58015, 9.5806, 9.5806, [9.58018, 9.58023, 9.58048, 9.5806]],
    ].flatMap(([tag, rot, fromAU, toAU, , env]) => [
      L(`ring-c-${tag}`, fromAU, toAU, () =>
        particleField({
          count: 7000,
          distribution: 'disk',
          innerRadius: RING_C_IN / RING_B_IN,
          thickness: 0.0016,
          seed: 103,
          rotation: rot,
          colorA: 0xbfae8a,
          colorB: 0x7a6c52,
          colorMode: 'random',
          size: 1.5,
          maxSize: 6,
          spin: 0.05,
          radiusMeters: RING_B_IN,
          offsetMeters: ({ u }) => [ahead(u, R_SATURN_AU), 0, 0],
          respectBand: false,
          opacity: ({ u }) => win(dAt(u), env[0], env[1], env[2], env[3]) * 0.45,
        })),
      L(`ring-b-${tag}`, fromAU, toAU, () =>
        particleField({
          count: 24000,
          distribution: 'disk',
          innerRadius: RING_B_IN / RING_B_OUT,
          thickness: 0.0012,
          seed: 107,
          rotation: rot,
          colorA: 0xfff0cc,
          colorB: 0xc8ac7a,
          colorMode: 'random',
          size: 2.0,
          maxSize: 8,
          spin: 0.06,
          radiusMeters: RING_B_OUT,
          offsetMeters: ({ u }) => [ahead(u, R_SATURN_AU), 0, 0],
          respectBand: false,
          opacity: ({ u }) => win(dAt(u), env[0], env[1], env[2], env[3]) * 0.75,
        })),
      L(`ring-a-${tag}`, fromAU, toAU, () =>
        particleField({
          count: 14000,
          distribution: 'disk',
          innerRadius: RING_A_IN / RING_A_OUT,
          thickness: 0.0012,
          seed: 109,
          rotation: rot,
          colorA: 0xf0dcb4,
          colorB: 0xa8946e,
          colorMode: 'random',
          size: 1.8,
          maxSize: 7,
          spin: 0.045,
          radiusMeters: RING_A_OUT,
          offsetMeters: ({ u }) => [ahead(u, R_SATURN_AU), 0, 0],
          respectBand: false,
          opacity: ({ u }) => win(dAt(u), env[0], env[1], env[2], env[3]) * 0.62,
        })),
      L(`ring-f-${tag}`, fromAU, toAU, () =>
        trajectory({
          path: (s) => {
            const th = s * Math.PI * 2;
            return [Math.cos(th) * RING_F, 0, Math.sin(th) * RING_F];
          },
          samples: 260,
          color: 0xffe8bc,
          colorAhead: 0xffe8bc,
          aheadOpacity: 1,
          progress: () => 1,
          offsetMeters: ({ u }) => [ahead(u, R_SATURN_AU), 0, 0],
          respectBand: false,
          opacity: ({ u }) => win(dAt(u), env[0], env[1], env[2], env[3]) * 0.55,
        })),
    ]),
    // Individual ringlets inside the A and B rings, for the beat that is about
    // exactly that. Thin bright circles at authored radii — a structure the
    // particle annuli cannot show, because a scatter has no edges in it.
    ...[0.795, 0.845, 0.878, 0.905, 0.936, 0.958, 0.980].map((f, i) =>
      L(`ringlet-${i}`, 9.58015, 9.5806, () =>
        trajectory({
          path: (s) => {
            const th = s * Math.PI * 2;
            const r = RING_A_OUT * f;
            const tilt = 0.44;
            return [
              Math.cos(th) * r,
              Math.sin(th) * r * Math.sin(tilt),
              Math.sin(th) * r * Math.cos(tilt),
            ];
          },
          samples: 240,
          color: i % 2 ? 0xfff2d4 : 0xd8bc90,
          colorAhead: i % 2 ? 0xfff2d4 : 0xd8bc90,
          aheadOpacity: 1,
          progress: () => 1,
          offsetMeters: ({ u }) => [ahead(u, R_SATURN_AU), 0, 0],
          respectBand: false,
          opacity: ({ u }) => win(dAt(u), 9.58019, 9.58023, 9.58048, 9.5806) * 0.5,
        }))),

    // --- Titan -------------------------------------------------------------
    L('titan', 9.58038, 9.58052, () =>
      planet({
        radiusMeters: R_TITAN,
        offsetMeters: ({ rebase }) => units(rebase, -0.45, -0.05, 1.1),
        lightDir: SUN,
        rock: 0xd08a34,
        atmosphere: 0xffb050,
        // A genuinely thick atmosphere: Titan's haze layer is hundreds of
        // kilometres deep and is the reason Voyager's cameras came back with
        // an orange billiard ball and no ground at all.
        atmosphereScale: 1.09,
        spin: 0.01,
        segments: 160,
        respectBand: false,
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0, night: 0, atmosphere: 1.35 }),
        opacity: ({ u }) => win(dAt(u), 9.580385, 9.58041, 9.580495, 9.58052),
      })),
    // The haze itself, as a glow beyond the limb — the softened edge is the
    // whole subject of the beat and a hard-edged sphere cannot say it.
    L('titan-haze', 9.58038, 9.58052, () =>
      glowSphere({
        radiusMeters: R_TITAN * 1.25,
        offsetMeters: ({ rebase }) => units(rebase, -0.45, -0.05, 1.1),
        color: 0xffa040,
        haloColor: 0xd8701c,
        haloScale: 1.9,
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 9.580385, 9.58041, 9.580495, 9.58052) * 0.55,
      })),
    // Saturn, from Titan's orbit: 1.22e9 m away, the globe 5.5° across inside
    // 13° of ring. Reduced brightness — it is a backdrop here, not the subject.
    L('saturn-from-titan', 9.58038, 9.58052, () =>
      planet({
        radiusMeters: R_SATURN,
        offsetMeters: () => {
          const d = [0.58, 0.28, -0.76];
          const n = Math.hypot(...d);
          return d.map((v) => (v / n) * D_TITAN);
        },
        lightDir: SUN,
        rock: 0xc0ab84,
        atmosphere: 0xd0bc90,
        atmosphereScale: 1.014,
        bands: 0.5,
        bandColor: 0x9c8250,
        bandFreq: 20,
        spin: 0.02,
        segments: 96,
        respectBand: false,
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0, night: 0, atmosphere: 0.4 }),
        opacity: ({ u }) => win(dAt(u), 9.580385, 9.58041, 9.580495, 9.58052) * 0.9,
      })),
    L('rings-from-titan', 9.58038, 9.58052, () =>
      particleField({
        count: 16000,
        distribution: 'disk',
        innerRadius: RING_C_IN / RING_A_OUT,
        thickness: 0.0016,
        seed: 113,
        rotation: [0.40, 0, 0.16],
        colorA: 0xe8d4a8,
        colorB: 0x8a7a5c,
        colorMode: 'random',
        size: 1.6,
        maxSize: 6,
        radiusMeters: RING_A_OUT,
        offsetMeters: () => {
          const d = [0.58, 0.28, -0.76];
          const n = Math.hypot(...d);
          return d.map((v) => (v / n) * D_TITAN);
        },
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 9.580385, 9.58041, 9.580495, 9.58052) * 0.55,
      })),

    // ======================================================================
    // BEAT 14 — VOYAGER 1 AND 2 DIVERGE.  frame 3.0e9 m, at 12 AU
    // Two paths out of one point, and two spacecraft on them at genuinely
    // different attitudes. The only beat in the journey with two of anything.
    // ======================================================================

    ...[
      // Both attitudes pulled back off edge-on. `vehicle`'s craft was a solid
      // bowl-and-tube that presented roughly the same area from any angle; a
      // real probe is mostly holes and thin booms, so an edge-on dish is a
      // sliver and the beat measurably lost a third of its occupancy. The two
      // are still clearly at different attitudes — that is the point of the
      // beat — they are just both showing the reader a dish now.
      ['v1', 1, 0xdff0ff, 0x2f5a80, [0.55, -0.55, 0.30], [1.35, 1.45, 1.8]],
      ['v2', -1, 0xbfe0c8, 0x2f6050, [0.72, 0.95, -0.25], [1.9, -1.30, 1.2]],
    ].flatMap(([tag, sign, colorA, colorB, att, pos]) => [
      L(`diverge-path-${tag}`, 9.8, 16.5, () =>
        trajectory({
          path: (s) => {
            const m = (s - 0.35) * 9.0e9;
            const t = clamp01(s - 0.35) / 0.65;
            // One shared inbound leg, then the two lines part: Voyager 1 is
            // thrown north out of the plane by the Titan pass, Voyager 2 stays
            // in it and keeps its options on Uranus and Neptune. The split has
            // to be WIDE — two lines a few degrees apart read as one line with
            // a rendering artefact on it.
            return [m, sign > 0 ? t * t * 4.4e9 : -t * t * 0.6e9, sign > 0 ? -t * t * 0.8e9 : t * t * 3.4e9];
          },
          samples: 300,
          ticks: 40,
          tickSize: 4.6,
          color: colorA,
          colorAhead: colorB,
          aheadOpacity: 0.3,
          offsetMeters: ({ rebase }) => units(rebase, -1.2, -0.5, 0),
          progress: () => 0.42,
          respectBand: false,
          opacity: ({ u }) => win(dAt(u), 10.4, 11.4, 13.8, 16.0) * 0.95,
        })),
      L(`probe-${tag}`, 9.8, 16.5, () =>
        instrumentedProbe({
          // Slightly cooled off from the cruise portrait: at 10 AU the Sun
          // delivers a hundredth of the light it did at 1.5, and a craft
          // rendered the same white at both is one of the ways this journey
          // used to read as a sticker rather than as a place.
          ...PROBE({ dishFace: 0xd2d8e0, dishBack: 0x8b939d, hull: 0x9aa0a8 }),
          spanMeters: ({ rebase }) => rebase.frameMeters() * 0.30,
          lightDir: SUN,
          ambient: 0.13,
          attitude: () => att,
          offsetMeters: ({ rebase }) => units(rebase, pos[0], pos[1], pos[2]),
          respectBand: false,
          opacity: ({ u }) => hero(dAt(u), 'diverge'),
        })),
    ]),
    // Saturn, receding. A bright point at an authored bearing — at 2.4 AU
    // behind, in a 3e9 m frame, its true position is 120 frame-widths off, and
    // a body that cannot be drawn where it is gets drawn where it reads.
    L('saturn-receding', 9.8, 16.5, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.009,
        offsetMeters: ({ rebase }) => units(rebase, -3.0, 0.9, 1.4),
        color: 0xf0dfae,
        haloColor: 0xc8a25e,
        haloScale: 4.0,
        solid: true,
        solidColor: 0xf4e6c0,
        segments: 16,
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 10.4, 11.3, 14.0, 16.2) * 0.9,
      })),

    // ======================================================================
    // BEAT 15 — URANUS.  frame 6.7e7 m
    // ======================================================================

    L('uranus', 18.6, 19.2004, () =>
      planet({
        radiusMeters: R_URANUS,
        offsetMeters: ({ u }) => [ahead(u, R_URANUS_AU), 0, 0],
        lightDir: SUN,
        rock: 0x9fdce2,
        atmosphere: 0xc4f0f4,
        atmosphereScale: 1.012,
        // Almost nothing: Voyager 2 found a disc so featureless that the
        // imaging team had to stretch the contrast to find anything at all.
        // 0.10 is what "nearly featureless" looks like next to Jupiter's 0.85.
        bands: 0.10,
        bandColor: 0x86c2cc,
        bandFreq: 16,
        spin: 0.012,
        segments: 176,
        respectBand: false,
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0.15, night: 0, atmosphere: 0.45 }),
        opacity: ({ rebase }) => frames(rebase, 1.5e7, 2.0e9),
      })),
    // THE TILT, in one look. Uranus' rings run vertically because the planet
    // is knocked over 98°, and a ring system standing on end is the only way
    // to say that in a still frame — the copy can assert a number, the picture
    // has to show a world lying on its side.
    // The ring plane's normal has to land along the world +x axis for the ring
    // to project as a TALL NARROW ellipse; the first pass put it 37° off
    // edge-on and the result read as an ordinary hoop round an ordinary
    // planet, which is the one thing this beat must not say. `rotation` is
    // applied XYZ, so a -90° roll about z takes the disc's +y normal onto +x
    // and the small y term opens the ellipse just enough to see it is a ring.
    L('uranus-rings', 19.1998, 19.2004, () =>
      particleField({
        count: 12000,
        distribution: 'disk',
        innerRadius: 0.86,
        thickness: 0.004,
        seed: 127,
        rotation: [0.05, 0.15, -1.535],
        colorA: 0xa8d4dc,
        colorB: 0x486068,
        colorMode: 'random',
        size: 1.7,
        maxSize: 7,
        spin: 0.03,
        radiusMeters: RING_EPSILON,
        offsetMeters: ({ u }) => [ahead(u, R_URANUS_AU), 0, 0],
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 19.19985, 19.20002, 19.200135, 19.2004) * 0.8,
      })),
    // The inner, narrower rings — nine of them were known before Voyager got
    // there, and a single bright hoop reads as a hoop rather than as a system.
    ...[0.55, 0.64, 0.72, 0.80].map((f, i) =>
      L(`uranus-ring-${i}`, 19.1998, 19.2004, () =>
        trajectory({
          // The same plane as the epsilon annulus, written as an explicit
          // basis rather than as an Euler triple — a circle in the plane whose
          // normal is n is `u1·cos + u2·sin`, and spelling that out is the
          // difference between a ring that is where it should be and two
          // numbers that are supposed to agree.
          path: (s) => {
            const th = s * Math.PI * 2;
            const r = RING_EPSILON * f;
            const n = [Math.cos(0.15), 0, -Math.sin(0.15)];
            const u1 = [0, 1, 0];
            const u2 = [
              n[1] * u1[2] - n[2] * u1[1],
              n[2] * u1[0] - n[0] * u1[2],
              n[0] * u1[1] - n[1] * u1[0],
            ];
            return [
              (u1[0] * Math.cos(th) + u2[0] * Math.sin(th)) * r,
              (u1[1] * Math.cos(th) + u2[1] * Math.sin(th)) * r,
              (u1[2] * Math.cos(th) + u2[2] * Math.sin(th)) * r,
            ];
          },
          samples: 220,
          color: 0x9cc8d4,
          colorAhead: 0x9cc8d4,
          aheadOpacity: 1,
          progress: () => 1,
          offsetMeters: ({ u }) => [ahead(u, R_URANUS_AU), 0, 0],
          respectBand: false,
          opacity: ({ u }) => win(dAt(u), 19.19988, 19.20003, 19.200135, 19.2004) * 0.4,
        }))),

    // ======================================================================
    // BEATS 16–17 — NEPTUNE AND TRITON.
    // ======================================================================

    L('neptune', 29.2, 30.1004, () =>
      planet({
        radiusMeters: R_NEPTUNE,
        offsetMeters: ({ u }) => [ahead(u, R_NEPTUNE_AU), 0, 0],
        lightDir: SUN,
        // Lifted off near-black. The deepest blue in the solar system is still
        // a LIT body, and at 0x2f52c8 under sunlight 1/900th of Earth's the
        // disc came out as a flat navy circle with nothing in it. The colour
        // is the copy's claim; the exposure is the frame's job.
        rock: 0x3d68e8,
        atmosphere: 0x6a92ff,
        atmosphereScale: 1.014,
        bands: 0.5,
        bandColor: 0x2748b4,
        bandFreq: 16,
        spin: 0.022,
        segments: 176,
        respectBand: false,
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0, night: 0, atmosphere: 0.75 }),
        opacity: ({ rebase }) => frames(rebase, 1.0e7, 2.0e9),
      })),
    // The Great Dark Spot — an anticyclone the size of Earth, and the one
    // feature on the planet a reader can point at.
    L('dark-spot', 30.0999, 30.1004, () =>
      blob({
        count: 1,
        // 0.19 R, not 0.30. `blob` draws a rim-lit membrane, so a large one
        // sitting proud of the limb renders as a SECOND SPHERE in front of the
        // planet — which is exactly what the first pass looked like. Small,
        // pressed against the disc and with a tight rim, it reads as what it
        // is: a hole in the cloud deck.
        radiusMeters: R_NEPTUNE * 0.19,
        seed: 131,
        wobble: 0.07,
        offsetMeters: ({ u }) => [
          ahead(u, R_NEPTUNE_AU) - R_NEPTUNE * 0.22,
          R_NEPTUNE * 0.16,
          R_NEPTUNE * 0.955,
        ],
        fill: 0x081642,
        rim: 0x2f56a8,
        rimPower: 3.2,
        fillAlpha: 0.94,
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 30.09993, 30.10002, 30.100135, 30.1004),
      })),
    // The bright methane cirrus streaks that run alongside it, driven by the
    // fastest winds measured anywhere in the solar system.
    L('neptune-cirrus', 30.0999, 30.1004, () =>
      particleField({
        count: 2400,
        distribution: 'cloud',
        clumps: 20,
        clumpSpread: 0.42,
        seed: 137,
        flattenY: 0.30,
        colorA: 0x9fb8e8,
        colorB: 0x4a6098,
        colorMode: 'random',
        // Big and soft, not small and sharp. At size 2 this layer drew a
        // speckled white line across the planet that read as a rendering
        // artefact; cloud has to be cloud-SHAPED, which for a point field
        // means sprites wide enough to overlap. Dim, too — bright methane
        // cirrus on a dark blue disc at any real opacity reads as a RING,
        // and Neptune's actual rings are far too faint for Voyager to have
        // shown them this way.
        size: 7,
        maxSize: 26,
        // Pressed onto the disc rather than floating a radius off it: at
        // 0.80 R the cloud deck sat proud of the limb and read as a bright bar
        // laid across the planet instead of as weather on it.
        radiusMeters: R_NEPTUNE * 0.62,
        offsetMeters: ({ u }) => [
          ahead(u, R_NEPTUNE_AU) + R_NEPTUNE * 0.10,
          -R_NEPTUNE * 0.32,
          R_NEPTUNE * 0.66,
        ],
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 30.09995, 30.10003, 30.100135, 30.1004) * 0.09,
      })),

    L('triton', 30.10026, 30.10040, () =>
      planet({
        radiusMeters: R_TRITON,
        offsetMeters: ({ rebase }) => units(rebase, -0.75, 0.28, 1.05),
        lightDir: SUN,
        rock: 0xe0c8c0,
        atmosphere: 0xf0e0e8,
        atmosphereScale: 1.006,
        spin: 0.008,
        segments: 160,
        respectBand: false,
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0.65, night: 0, atmosphere: 0.3 }),
        opacity: ({ u }) => win(dAt(u), 30.100265, 30.10029, 30.100375, 30.10040),
      })),
    // The geysers. DARK, and normal-blended: what Voyager 2 photographed was
    // nitrogen carrying dark surface material kilometres up and then downwind
    // in plumes that streak the ice black. Additive would draw them as light,
    // which is the opposite of what they are.
    //
    // And they have to be OVER THE LIT DISC, not off the limb. The first pass
    // put them a radius above the pole, where the thing behind them is empty
    // space — and a dark, occluding layer drawn against black is exactly as
    // invisible as a bright one drawn against white. Dark material only reads
    // when it has something bright to take away.
    L('triton-geysers', 30.10026, 30.10040, () =>
      particleField({
        count: 2600,
        distribution: 'cloud',
        clumps: 5,
        clumpSpread: 0.10,
        seed: 139,
        flattenY: 3.0,
        blending: 'normal',
        colorA: 0x3a3038,
        colorB: 0x0c0a12,
        colorMode: 'random',
        size: 3.0,
        maxSize: 16,
        radiusMeters: R_TRITON * 0.34,
        offsetMeters: ({ rebase }) => {
          const k = rebase.frameMeters() / 4;
          return [-0.75 * k - R_TRITON * 0.30, 0.28 * k + R_TRITON * 0.42, 1.05 * k + R_TRITON * 0.80];
        },
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 30.10027, 30.100295, 30.100375, 30.10040) * 0.9,
      })),
    // The dark streaks they leave downwind across the ice — the feature that
    // is actually visible in the Voyager frames, and the reason anyone worked
    // out there were geysers at all.
    L('triton-streaks', 30.10026, 30.10040, () =>
      particleField({
        count: 1800,
        distribution: 'cloud',
        clumps: 9,
        clumpSpread: 0.09,
        seed: 141,
        flattenY: 0.22,
        blending: 'normal',
        colorA: 0x453842,
        colorB: 0x120f16,
        colorMode: 'random',
        size: 3.4,
        maxSize: 18,
        radiusMeters: R_TRITON * 0.62,
        offsetMeters: ({ rebase }) => {
          const k = rebase.frameMeters() / 4;
          return [-0.75 * k - R_TRITON * 0.10, 0.28 * k - R_TRITON * 0.24, 1.05 * k + R_TRITON * 0.72];
        },
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 30.10027, 30.100295, 30.100375, 30.10040) * 0.7,
      })),
    // Neptune, from Triton's orbit: 3.548e8 m away, an 8° crescent. Its
    // BEARING is chosen so it clears Triton's own disc — Triton is 560 px
    // across here, an 18° half-angle, and the first placement put Neptune 10°
    // from Triton's centre, i.e. straight behind it. A companion body has to
    // be composed against the angular size of whatever is in front of it, not
    // just placed at a plausible-looking direction.
    L('neptune-from-triton', 30.10026, 30.10040, () =>
      planet({
        radiusMeters: R_NEPTUNE,
        offsetMeters: () => {
          const d = [-0.095, 0.241, -0.968];
          const n = Math.hypot(...d);
          return d.map((v) => (v / n) * D_TRITON);
        },
        lightDir: SUN,
        rock: 0x2f52c8,
        atmosphere: 0x4a74e8,
        atmosphereScale: 1.016,
        bands: 0.35,
        bandColor: 0x1e3a9c,
        bandFreq: 18,
        spin: 0.022,
        segments: 128,
        respectBand: false,
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0, night: 0, atmosphere: 0.9 }),
        opacity: ({ u }) => win(dAt(u), 30.100265, 30.10029, 30.100375, 30.10040),
      })),

    // ======================================================================
    // BEAT 18 — PLUTO'S DISTANCE, AND THE KUIPER BELT.  frame 3.0e5 m
    // No dominant subject on purpose: this beat is about a POPULATION, and
    // the composition is a field receding into the frame rather than one
    // object in the middle of it.
    // ======================================================================

    // Three scatters again, for the same reason the belt needs three: `rocks`
    // lays one plane, and one plane from inside it is a row of potatoes.
    L('kuiper-close', 36, 41.5, () =>
      rocks({
        count: 4,
        seed: 147,
        sizeMeters: [3.4e4, 6.0e4],
        areaMeters: 3.0e5,
        centreClear: 1.4e5,
        spreadYMeters: 9.0e4,
        buryFraction: 0.5,
        angularity: 0.34,
        rock: 0x4e4048,
        dry: 0x9a7e74,
        ambient: 0x2a2430,
        lightDir: SUN,
        offsetMeters: ({ rebase }) => units(rebase, -1.4, -0.55, 2.0),
        respectBand: false,
        opacity: ({ u, rebase }) => win(dAt(u), 38.4, 39.3, 40.3, 41.2) * frames(rebase, 3.0e4, 3.0e6),
      })),
    L('kuiper-near', 36, 41.5, () =>
      rocks({
        count: 30,
        seed: 149,
        sizeMeters: [6.0e3, 3.2e4],
        areaMeters: 2.2e5,
        centreClear: 3.0e4,
        spreadYMeters: 1.2e5,
        buryFraction: 0.5,
        angularity: 0.30,
        // Ices, not rock: dark, red-grey, and lit by a Sun 1,600 times fainter
        // than at Earth. Nothing out here is bright.
        rock: 0x453a44,
        dry: 0x8a7068,
        ambient: 0x201c24,
        lightDir: SUN,
        offsetMeters: ({ rebase }) => units(rebase, -0.2, 0.35, 1.2),
        respectBand: false,
        opacity: ({ u, rebase }) => win(dAt(u), 38.4, 39.3, 40.3, 41.2) * frames(rebase, 3.0e4, 3.0e6),
      })),
    L('kuiper-far', 36, 41.5, () =>
      rocks({
        count: 70,
        seed: 151,
        sizeMeters: [1.2e3, 8.0e3],
        areaMeters: 1.1e6,
        centreClear: 2.4e5,
        spreadYMeters: 4.5e5,
        buryFraction: 0.5,
        angularity: 0.28,
        rock: 0x352c34,
        dry: 0x6a5854,
        ambient: 0x171419,
        lightDir: SUN,
        offsetMeters: ({ rebase }) => units(rebase, 0.6, -0.9, -2.6),
        respectBand: false,
        opacity: ({ u, rebase }) => win(dAt(u), 38.4, 39.3, 40.3, 41.2) * frames(rebase, 3.0e4, 3.0e6) * 0.9,
      })),
    L('kuiper-field', 36, 41.5, () =>
      particleField({
        count: 5000,
        distribution: 'disk',
        innerRadius: 0.05,
        thickness: 0.22,
        seed: 157,
        rotation: [0.26, 0, 0.2],
        colorA: 0x9aa4b8,
        colorB: 0x3a4050,
        colorMode: 'random',
        size: 1.8,
        maxSize: 7,
        twinkle: 0.2,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 3.0,
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 38.4, 39.2, 40.4, 41.3) * 0.45,
      })),

    // ======================================================================
    // BEAT 19 — THE PALE BLUE DOT.  frame 7.5e9 m (0.05 AU)
    // Wide enough that Earth is honestly sub-pixel, which is the only framing
    // in which this photograph means what it means. Everything else in frame
    // is the scattered light the camera was pointed into.
    // ======================================================================

    // The scattered-sunlight band. NORMAL blending, and drawn as a long thin
    // cloud rather than as a glow: the defining feature of the real frame is a
    // shaft of light crossing it diagonally with a texture to it, and additive
    // sprites at this width just brighten the whole picture uniformly.
    L('scatter-ray', 40.2, 60, () =>
      particleField({
        count: 4200,
        distribution: 'cloud',
        clumps: 54,
        clumpSpread: 0.045,
        seed: 163,
        flattenY: 0.055,
        rotation: [0, 0, -0.62],
        blending: 'normal',
        colorA: 0xe0cca2,
        colorB: 0x60533f,
        colorMode: 'random',
        size: 5,
        maxSize: 40,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 2.2,
        offsetMeters: ({ rebase }) => units(rebase, 0.4, 0.3, 0.4),
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 40.4, 40.75, 42.5, 47) * 0.55,
      })),
    // A second, fainter shaft crossing the first — the real image has several,
    // and one alone reads as a lens smear rather than as scattered light.
    L('scatter-ray-b', 40.2, 60, () =>
      particleField({
        count: 2200,
        distribution: 'cloud',
        clumps: 34,
        clumpSpread: 0.05,
        seed: 167,
        flattenY: 0.06,
        rotation: [0, 0, 0.30],
        blending: 'normal',
        colorA: 0x8e8268,
        colorB: 0x3a352a,
        colorMode: 'random',
        size: 5,
        maxSize: 30,
        // Shorter, fainter and offset well away from the main shaft: two rays
        // of equal weight crossing at the frame centre drew a symmetrical X,
        // which reads as a graphic rather than as light in a lens.
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.9,
        offsetMeters: ({ rebase }) => units(rebase, -1.5, -1.0, 0.2),
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 40.4, 40.8, 42.5, 47) * 0.26,
      })),
    // Earth. Three pixels, inside the band, and never geometry — the point of
    // light IS the subject and drawing a disc here would be the one lie in the
    // journey the copy explicitly forbids.
    L('pale-blue-dot', 40.2, 60, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.0026,
        offsetMeters: ({ rebase }) => units(rebase, 0.55, 0.42, 0.55),
        color: 0xd0e8ff,
        haloColor: 0x8fbcf0,
        haloScale: 3.2,
        solid: true,
        solidColor: 0xd8ecff,
        segments: 12,
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 40.45, 40.8, 46, 55),
      })),

    // ======================================================================
    // BEAT 20 — THE HELIOPAUSE.  frame 1.5e12 m
    // A real structure with a crossing in it, not a fact narrated over an
    // empty frame. `filaments` because the boundary is a turbulent, knotted
    // sheet — the same archetype the cosmic web uses, for the same reason:
    // it is the only one in the library that makes STRUCTURE out of a field.
    // ======================================================================

    // Inside: the heliosheath, solar-wind plasma piled up and slowed after the
    // termination shock. Warm, dense, and unmistakably on the sunward side.
    L('heliosheath', 70, 150, () =>
      particleField({
        count: 14000,
        distribution: 'ball',
        seed: 173,
        colorA: 0xffb070,
        colorB: 0x8a3c1c,
        colorMode: 'random',
        size: 2.0,
        maxSize: 9,
        twinkle: 0.3,
        jitter: 0.008,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 1.15,
        offsetMeters: ({ rebase }) => units(rebase, -2.2, 0.3, 0.4),
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 88, 112, 133, 148) * 0.42,
      })),
    // The boundary itself.
    L('heliopause', 100, 155, () =>
      filaments({
        nodes: 130,
        perStrand: 70,
        neighbours: 2,
        seed: 179,
        size: 2.6,
        spin: 0.006,
        colorA: 0xd8b4ff,
        colorB: 0x5a3aa8,
        nodeColor: 0xf0e0ff,
        strandOpacity: 0.22,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 1.1,
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 108, 120, 136, 152) * 0.85,
      })),
    // Outside: the interstellar medium, colder, sparser, and a different
    // colour — the density jump the copy describes, made visible as a change
    // in what the field is made of rather than as a caption.
    L('interstellar-medium', 110, 200, () =>
      particleField({
        count: 9000,
        distribution: 'ball',
        seed: 181,
        colorA: 0x9fd0ff,
        colorB: 0x2a4a7a,
        colorMode: 'random',
        size: 1.8,
        maxSize: 7,
        twinkle: 0.35,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 1.6,
        offsetMeters: ({ rebase }) => units(rebase, 2.0, -0.2, -0.3),
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 115, 126, 175, 200) * 0.5,
      })),

    // ======================================================================
    // BEAT 21 — THE GOLDEN RECORD.  frame 0.30 m
    // The journey's second dive to something you could hold, after the
    // asteroid. Thirty centimetres of gold-plated copper, at 700 px, with the
    // spacecraft it is bolted to as dark structure around it.
    // ======================================================================

    L('record', 150, 400, () =>
      panel({
        kind: 'record',
        count: 1,
        variants: 3,
        seed: 191,
        sizeMeters: [0.30, 0.30],
        aspect: 1,
        tiltRad: 0.52,
        bodyColor: null, // the kind draws its own disc; there is no slab here
        ambient: 0x4a4030,
        lampColor: 0xfff0d0,
        lamp: () => 1.15,
        lampAt: [0.36, 0.62],
        respectBand: false,
        opacity: ({ u, rebase }) => win(dAt(u), 160, 166.5, 176, 230) * frames(rebase, 0.05, 3.0),
      })),
    L('record-bus', 150, 400, () =>
      instrumentedProbe({
        // Nearly black: out here the only light is one hard sun, and this is
        // the SETTING for the record rather than the subject. It used to be a
        // 2.6 m `vehicle` sitting on top of the disc — a giant foreground
        // obstruction around the one thing the beat is about.
        ...PROBE({
          hull: 0x3e434a, dishFace: 0x4e545c, dishBack: 0x33373d,
          strut: 0x474d55, boom: 0x393e45, rtg: 0x141517,
        }),
        spanMeters: REC_SPAN,
        lightDir: SUN,
        ambient: 0.06,
        // The bracket the record is actually bolted to. `payloadMounts` is
        // the fix for this beat: a standoff plate with posts and a retaining
        // lip, so the disc sits ON structure instead of being swallowed by a
        // bus parked on top of it.
        payloadMounts: [{
          kind: 'recordBracket',
          at: REC_MOUNT,
          normal: [0, 0.30, 1],
          // Smaller than the record it carries. A plate the same size as the
          // disc is not a bracket, it is a wall — and it occluded most of the
          // one thing this beat is about.
          size: [0.22, 0.22],
          color: 0x454b53,
        }],
        // Attitude is deliberately IDENTITY here, and that is what makes the
        // offset below a derivation rather than a guess: with no rotation the
        // bracket's model position maps to `REC_SPAN * REC_MOUNT` in metres,
        // so placing the craft at minus that puts the bracket exactly under
        // the record at the origin. Authoring a rotation as well would leave
        // the mount and the record as two numbers that are supposed to agree,
        // which is the trap that has already cost this repo two sequences.
        attitude: () => [0, 0, 0],
        offsetMeters: [
          -REC_MOUNT[0] * REC_SPAN,
          -REC_MOUNT[1] * REC_SPAN,
          -REC_MOUNT[2] * REC_SPAN - REC_STANDOFF,
        ],
        respectBand: false,
        opacity: ({ u, rebase }) => hero(dAt(u), 'record') * frames(rebase, 0.05, 4.0),
      })),
    // A pin-sharp sun on a black sky: out here there is no air to scatter it,
    // so the record is lit by one hard source and everything it does not reach
    // is genuinely black. This is the only backdrop in the journey and it
    // exists to give the disc something to be gold AGAINST.
    L('record-sky', 150, 400, () =>
      backdrop({
        radiusFrames: 8,
        top: 0x000000,
        horizon: 0x020204,
        bottom: 0x000000,
        sunColor: 0xfff6e6,
        sunDir: LIGHT_DIR,
        sunSize: 0.99992,
        sunSoft: 0.0004,
        sunGain: 1.6,
        bandLift: 0,
        opacity: ({ u, rebase }) => win(dAt(u), 158, 166, 180, 250) * frames(rebase, 0.05, 6.0),
      })),

    // ======================================================================
    // BEAT 22 — THE SUN AS JUST ANOTHER STAR.  frame 4.0e16 m (4.2 ly)
    // The closing frame has to make one claim and make it visually: that
    // nothing here distinguishes the Sun from its neighbours. So the field is
    // dense, the Sun is at its floored 4 px, and the beat is composed to make
    // the reader fail to find it.
    // ======================================================================

    L('solar-neighbourhood', 20000, END_AU, () =>
      particleField({
        count: 26000,
        distribution: 'ball',
        seed: 193,
        colorA: 0xffffff,
        colorB: 0xffc890,
        colorMode: 'random',
        size: 2.4,
        maxSize: 8,
        twinkle: 0.45,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 1.7,
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 40000, 160000) * 0.6,
      })),
    // …and the cooler, fainter majority. Most stars are red dwarfs, which is
    // both true and the thing that keeps the closing field from being a wall
    // of identical white dots.
    L('neighbourhood-dim', 20000, END_AU, () =>
      particleField({
        count: 18000,
        distribution: 'ball',
        seed: 197,
        colorA: 0xff9a6a,
        colorB: 0x7a3a2a,
        colorMode: 'random',
        size: 1.6,
        maxSize: 5,
        twinkle: 0.5,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 2.1,
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 45000, 180000) * 0.5,
      })),
    // The local interstellar cloud the Sun is currently passing through — a
    // faint wisp, and the last piece of structure the journey has.
    L('local-cloud', 20000, END_AU, () =>
      particleField({
        count: 2200,
        distribution: 'cloud',
        clumps: 24,
        clumpSpread: 0.24,
        seed: 199,
        colorA: 0x4a5a86,
        colorB: 0x1a2038,
        colorMode: 'random',
        size: 4,
        maxSize: 80,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 1.3,
        offsetMeters: ({ rebase }) => units(rebase, 1.2, -0.6, -0.8),
        respectBand: false,
        opacity: ({ u }) => win(dAt(u), 60000, 200000) * 0.3,
      })),
  ];
}
