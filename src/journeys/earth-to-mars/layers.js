import {
  particleField, glowSphere, planet, terrain, blocks, backdrop, silhouette,
  vehicle, trajectory, blob, rocks, cloudDeck, tower, cruiseStage, entrySheath, water,
  parachute,
} from '../../archetypes/index.js';
import { R_EARTH, R_MARS, MARS_D, AU, MARS_AU, walked } from './distance.js';
import { band, plin, plog, clamp01, mixHex } from './curve.js';
import { groundRelativeOffsetMeters } from '../../kit/ground-frame.js';
import {
  earthCentre, marsCentre, marsAlt, frameAt, earthUnits, marsUnits, lookAtUnits,
  screenAnchoredMeters, pointPositionMeters, placedPositionMeters,
  hohmannPoint, helioFrame, helioWorldMeters, transferProgress,
  sunFlux, sunDistAU, SUN_DIR,
} from './plan.js';

// THE ORIGIN IS THE SPACECRAFT. Earth's centre sits at -(R_EARTH + d), Mars'
// centre at (MARS_D - d) + R_MARS, both recomputed every frame from the axis
// value and both read from `plan.js` so that the camera and the layers cannot
// disagree about where a world is. That disagreement is what this journey
// shipped with: eleven consecutive near-black cruise frames, every one of them
// a subject placed at one authored direction while the camera looked at
// another.
//
// WHAT THE CRUISE NEEDED, and did not have: three planes in every frame.
//
//   NEAR   the transfer stack itself, screen-anchored so it holds one corner
//          for the whole interplanetary stretch, at a true 3 units in front of
//          the lens so it parallaxes rather than sitting flat, lit by the same
//          vector as every world, and turning slowly as a function of `u`.
//   MID    the Sun, physically shrinking and dimming through 1 → 1.524 AU;
//          Earth, a real disc that genuinely gets smaller and then a point of
//          light; Mars, a point that becomes a disc; the two orbital rings; the
//          transfer arc with the flown part bright.
//   FAR    a dense starfield, the galactic band, and sunlit zodiacal dust —
//          the only things out here that are honestly always present.
export function makeLayers(uAt, dAt) {
  const L = (id, fromD, toD, build) => ({ id, from: uAt(fromD), to: uAt(toD), build });

  // "This stands on the planet, not on the vehicle." See src/kit/ground-frame.js.
  const onGround = groundRelativeOffsetMeters(dAt);

  const frames = (rebase, lo, hi) => {
    const f = rebase.frameMeters();
    return clamp01((f - lo) / (lo * 0.8)) * clamp01((hi - f) / (hi * 0.35));
  };

  // Air fraction — 1 at the pad, 0 by ~70 km.
  const airAt = (d) => clamp01(plin([[0, 1], [8e3, 0.9], [2.0e4, 0.45], [4.0e4, 0.06], [7e4, 0]], d));
  const skyAt = (d) => {
    const air = airAt(d);
    return {
      air,
      top: mixHex(0x02040a, 0x1d4f95, air),
      // The horizon keeps a real glow well past the point the sky above it has
      // gone black, which is what an atmospheric limb actually looks like from
      // 30 km up. Beat 4 (Max Q) measured 0.065 occupancy and 0.033 contrast —
      // a dark ground under a black sky — because the whole backdrop had faded
      // out by then and nothing had replaced it.
      horizon: mixHex(0x2a1408, 0xc08a52, 0.25 + air * 0.75),
      bottom: mixHex(0x02040a, 0x1a1a20, air),
      bandLift: 0.10 + air * 0.5,
      // A SUN WITH NO EDGE IS A HOLE IN THE FRAME. `backdrop`'s glare term is
      // `pow(c,90)*0.5 + pow(c,8)*0.12`, and at gain 0.8 the second of those —
      // which is tens of degrees wide — was on its own enough to drive a
      // quarter of the sky past the tone mapper before the disc was even added.
      // The pad, ignition and tower-clear beats came back from a blind review
      // as washed out, and what they actually had was no sun DISC at all: a
      // white blob with a soft boundary somewhere in the middle of it.
      sunGain: 0.16 + air * 0.30,
      light: mixHex(0xdfe8ff, 0xffc487, air),
      haze: mixHex(0x04060c, 0x8c7a68, air),
    };
  };

  // Height of the terrain plane below the ship. Negative once the walk begins.
  const marsDrop = (d) => -Math.max(0, marsAlt(d));

  // How far through the transition from "bolted to a launch vehicle at the
  // world origin" to "the cruise hero, held in one corner of the frame". Zero
  // for the whole ascent and the parking orbit, so the beats that already work
  // are untouched; one from 30,000 km out.
  const cruiseBlend = (d) => plin([[3.0e6, 0], [3.0e7, 1]], d);

  // Solar panels: out across beat 14 and only across beat 14. The old table
  // finished deploying at 2.2e11 — the beat's own opening mark — so the beat
  // whose entire subject is the panels swinging out sampled a craft that had
  // already finished doing it.
  const deployAt = (d) => plin([[2.35e11, 0], [3.05e11, 1]], d);

  // ONE FORMULA FOR "HOW LONG IS THE STACK". Read by the launch vehicle's own
  // `lengthMeters` AND by the cruise stage that rides on top of it, so the
  // payload cannot end up beside the rocket it is bolted to.
  //
  // 0.42 of `frameMeters`, not 0.20. The unit is `frameMeters / 4` and the
  // camera stands about 6.2 units out, so the visible width at the origin is
  // ~2.5 frames: at 0.20 the vehicle was 8% of the picture — about 115 px —
  // for the whole ascent AND for the parking orbit and the trans-Mars burn,
  // which is a streak, not a subject. The pad beats are unaffected, because the
  // 130 m floor wins there and 0.42 × 140 m is still under it.
  //
  // 0.42 of `frameMeters`, not 0.20. The unit is `frameMeters / 4` and the
  // camera stands about 6.2 units out, so the visible width at the origin is
  // ~2.5 frames: at 0.20 the vehicle was 8% of the picture — about 115 px —
  // for the whole ascent AND for the parking orbit and the trans-Mars burn,
  // which is a streak, not a subject. The pad beats are unaffected, because the
  // 130 m floor wins there and 0.42 × 140 m is still under it.
  //
  // AND IT HAS TO GROW AS THE STACK SHEDS. `lengthMeters` is the length of the
  // WHOLE stack, and by the parking orbit everything except the upper stage has
  // gone: the boosters at 56 km, the core at 95 km, the fairing at 135 km. What
  // is left is `span: 0.25` of the declared length, so a constant multiplier
  // drew the surviving vehicle at a quarter of the size it had at Max Q —
  // measured, 58 px at beat 7 — and the beats where the spacecraft is alone
  // against a planet were the ones where it was smallest. The ramp holds the
  // SURVIVING object at roughly one apparent size instead.
  const stackLen = (rebase, d) => Math.max(130, rebase.frameMeters() * plin([
    [1, 0.42], [6.4e4, 0.42], [1.5e5, 0.95], [1.0e6, 1.32],
  ], d));

  // The stack's attitude, authored once and used by both bodies. During the
  // ascent it is the pitch-over programme; during the cruise it is a slow rear
  // three-quarter turn. Both are pure functions of u — the layers have the
  // clock, this does not use it (rule 8).
  const ascentAttitude = (d) => [
    plin([[130, 0], [1.4e4, 0.35], [6.5e4, 0.9], [2.0e5, 1.4]], d),
    0,
    plin([[130, 0], [1.2e3, -0.5], [1.0e4, -0.55]], d),
  ];
  const cruiseAttitude = (u) => [
    1.28 + 0.30 * Math.sin(u * 5.4),
    -0.55 + u * 2.2,
    0.30 + 0.16 * Math.cos(u * 3.7),
  ];
  const stackAttitude = (u) => {
    const d = dAt(u);
    const s = cruiseBlend(d);
    const a = ascentAttitude(d);
    const c = cruiseAttitude(u);
    return [0, 1, 2].map((i) => a[i] * (1 - s) + c[i] * s);
  };

  // TWO OBJECTS THAT ARE STILL BOLTED TOGETHER ARE ONE DERIVATION. The payload
  // sits on the stack's own axis, so its world offset has to be the point
  // (0, k·length, 0) carried through the stack's OWN rotation — not an
  // independently-authored position that is supposed to agree with it. THREE's
  // default Euler order is XYZ; this applies exactly that.
  // THE STACK STANDS ON THE GROUND, IT IS NOT BURIED IN IT. `vehicle` centres
  // its model on the origin, and the origin here is the vehicle's position at
  // axis value d — which is its BASE, because the axis is distance travelled
  // from the pad and the terrain sits at -d. Leaving the model centred put 65 m
  // of a 130 m stack under the launch deck, so beat 1 showed the top of a
  // fairing and nothing else: no core, no boosters, no fins, no engines. Every
  // silhouette fix in this file is invisible until this one is made.
  // …AND THE RISE HAS TO STOP ONCE THERE IS NO GROUND. This lifts the model by
  // half its own length because during the ascent the origin is the vehicle's
  // BASE — the terrain sits at -d — so a centred model is buried to the waist.
  // Above ~250 km no terrain layer is mounted at all and the origin is simply
  // the vehicle, so the lift becomes a pure displacement. With the length ramp
  // above it grew to 2.6 units, which threw the whole stack clear of the
  // boresight at trans-Mars injection and put the beat back to a planet with
  // nothing in front of it — the exact defect this pass exists to fix, arrived
  // at from the other direction.
  const stackRise = (rebase, d) => 0.5 * stackLen(rebase, d) * clamp01((2.5e5 - d) / 1.5e5);

  const onStackAxis = (k, rebase, u) => {
    const [rx, ry, rz] = ascentAttitude(dAt(u));
    let x = 0;
    let y = k * stackLen(rebase, dAt(u));
    let z = 0;
    let c = Math.cos(rx); let s = Math.sin(rx);
    [y, z] = [y * c - z * s, y * s + z * c];
    c = Math.cos(ry); s = Math.sin(ry);
    [x, z] = [x * c + z * s, -x * s + z * c];
    c = Math.cos(rz); s = Math.sin(rz);
    [x, y] = [x * c - y * s, x * s + y * c];
    // The vehicle rotates about its own centre and is THEN translated, so the
    // rise is added after the rotation — same order the archetype applies.
    return [x, y + stackRise(rebase, dAt(u)), z];
  };

  // THE STACK'S OWN JOINTS, written down once, in the stack's own unit envelope.
  // `vehicle` lays its stages bottom-to-top from -0.5, so with spans 0.46 (core)
  // and 0.25 (upper) plus the 0.025 payload adapter above them:
  //
  //   -0.500  base of the core
  //   -0.040  core / upper-stage joint      ← the staging event happens HERE
  //    0.210  top of the upper stage
  //    0.235  top of the adapter            ← the payload's aft mount
  //
  // Anything that belongs to one of those joints is placed from this, never from
  // a fraction of the frame — see the staging-effects comment below for what a
  // frame-relative offset cost.
  const STAGE_JOINT = -0.04;
  const PAYLOAD_MOUNT = 0.235;
  const stageJointMeters = (rebase, u) => onStackAxis(STAGE_JOINT, rebase, u);

  // THE ENTRY POSE — one derivation for the aeroshell and the plasma around
  // it, so they cannot end up in two places.
  //
  // THE HALF TURN BETWEEN THEM IS WRITTEN DOWN, NOT DISCOVERED. `cruiseStage`
  // builds its aeroshell on local -y, because an aeroshell hangs UNDER a cruise
  // disc; `entrySheath` builds its shock cap on local +y, because a shock stands
  // off the direction of TRAVEL. Handing both the same attitude therefore puts
  // them exactly 180° apart — measured, it drew the heat shield above the
  // backshell with the plasma glowing on the wrong face, an aeroshell entering
  // an atmosphere backwards. One tilt, one stated π, and the relationship
  // cannot drift.
  const entryTilt = (u) => {
    // The entry flight-path angle, off vertical: descending at a slant rather
    // than dropping straight down, steepening slightly through the corridor.
    const k = clamp01((MARS_D - 3.0e4 - dAt(u)) / 9.0e4);
    return [-0.30 - 0.10 * k, 0, 0.22];
  };
  const AEROSHELL_ATTITUDE = ({ u }) => entryTilt(u);
  const SHEATH_ATTITUDE = ({ u }) => {
    const [pitch, yaw, roll] = entryTilt(u);
    return [pitch + Math.PI, yaw, roll];
  };
  const entryPose = ({ rebase, u }) => {
    const f = rebase.frameMeters();
    const k = clamp01(((MARS_D - dAt(u)) - 2.0e4) / 9.0e4);
    // A standing lift, so the entry vehicle reads against SKY rather than
    // sitting on the horizon line where its own glow competes with the lit
    // limb — plus a lateral term that converges on the origin as the lander
    // takes over, so the crossfade lands the two in the same place.
    return [f * 0.13 * k, f * 0.055 + f * 0.10 * k, -f * 0.04 * k];
  };

  // Where the hero holds the frame: lower right, the one corner the copy panel
  // and the ribbon do not own. Written once because the craft, its burn flash
  // and anything else riding with it must all read from it.
  const HERO_ANCHOR = { right: 1.05, up: -0.62, ahead: 3.0 };

  // THE SKY DOES NOT MOVE. All three celestial fields — stars, the galactic
  // band, the zodiacal disc — sit at ONE radius, far enough out that the
  // camera's own travel through a beat produces no visible parallax between
  // them. They previously sat at 5, 7 and 1.8 frames, and the zodiacal field's
  // own comment said it was deliberately near "so it parallaxes against the
  // starfield". That was the wrong ambition: at 1.8 frames the camera is
  // practically inside it, so every scroll and every `AZIMUTH` swing slid the
  // warm dust bodily across a starfield that stayed put — and a reader
  // scrolling the live journey reported exactly that, as dust "randomly moving
  // all across space". Zodiacal light and the Milky Way do not move relative to
  // the stars on any timescale a journey can show. Parallax is what the HERO
  // and the planets are for; the sky is the fixed reference they move against.
  const CELESTIAL_RADIUS_FRAMES = 8;

  return [
    // ======================================================================
    // THE SKY OVER FLORIDA, AND THE LIMB THAT REPLACES IT
    // ======================================================================
    L('sky', 1, 4.0e5, () =>
      backdrop({
        radiusFrames: 8,
        sunDir: [0.82, 0.16, -0.42],
        // 0.9992 is a 2.3° angular RADIUS — nine times the real Sun, drawn as a
        // soft-edged patch five degrees across. Tightened to about 1.3°, which
        // is still generous and is small enough to have a rim.
        // Seen from Earth the sun is 0.53° across — 0.265° of angular radius,
        // cos of which is 0.9999893. Same split as `mars-sky`: a small hard
        // disc that may clip, and a glare lobe held right down, because the
        // lobe is what took the pad and ascent beats to white.
        sunSize: 0.9999893,
        sunSoft: 0.0000260,
        glareGain: 0.18,
        drive: ({ u }) => {
          const s = skyAt(dAt(u));
          return { top: s.top, horizon: s.horizon, bottom: s.bottom, bandLift: s.bandLift, sunGain: s.sunGain };
        },
        // Carried out to a 3.0e5 m frame rather than 8.0e4, which is what puts
        // a lit limb under the black sky through Max Q and staging instead of
        // leaving those beats as a dark ground on nothing.
        opacity: ({ rebase }) => clamp01((3.0e5 - rebase.frameMeters()) / 1.4e5),
      })),

    // ======================================================================
    // THE DEEP SKY — the interplanetary backdrop, and the single measurement
    // that forced it into existence.
    //
    // `adjacent` is the mean per-channel distance between two frames' 16 × 10
    // CELL AVERAGES. In a frame that is 80% black with a few small bright
    // objects on it, every cell average is near zero, so two beats can be
    // compositionally unrelated and still measure 1.3 apart against a 6.0 bar —
    // which is exactly what beats 11 through 16 did after the hero, the Sun and
    // both planets had been fixed and the frames had genuinely stopped being
    // empty. Swinging the camera 60° between beats moved the starfield and
    // changed nothing, because moving faint points around a black frame does
    // not change what a cell AVERAGES to.
    //
    // The first answer to that was a full-frame RUST-ORANGE gradient, and it
    // worked — the number moved. It was also a lie about the subject: the space
    // between Earth and Mars is black with stars in it, and a blind reviewer
    // shown nothing but numbered frames described beat after beat as "a
    // reddish-brown star field". A tint that exists to move a ruler is the
    // ruler winning, and this project's whole reason to have a blind review is
    // that the picture is the thing being graded, not the metric.
    //
    // What is left after the tint comes off is honest and still large-area: the
    // MILKY WAY, a genuinely bright, structured band to a camera with no
    // atmosphere in front of it, and a faint warm ECLIPTIC glow — real
    // zodiacal light, sunlit dust, concentrated along one plane rather than
    // washing the whole sky. So `horizon` here is not a horizon: it is the
    // galactic band, near-neutral, and it is the only bright thing in the
    // gradient. Top and bottom go to the black they should always have been.
    // The band sits at the world y = 0 plane, so the camera-height and roll
    // swings in `plan.js` sweep it right across the frame between beats — which
    // is real parallax against the ship's own attitude, and is what has to
    // carry `adjacent` now that a tint is not allowed to.
    L('deep-sky', 6.0e6, MARS_D - 3.0e5, () =>
      backdrop({
        radiusFrames: 9,
        sunGain: 0,
        drive: ({ u }) => {
          const d = dAt(u);
          const k = clamp01((Math.log10(Math.max(d, 1.0e7)) - 7) / (Math.log10(5.6e11) - 7));
          const near = k < 0.5;
          const t = near ? k / 0.5 : (k - 0.5) / 0.5;
          const pick = (a, b, c) => mixHex(near ? a : b, near ? b : c, t);
          return {
            // Space, not a nebula. The residual hue arc is a few percent — cool
            // near Earth, faintly warm out by Mars' orbit where the dust the
            // sun is lighting is the same dust Mars is made of — and it is
            // deliberately far below the point at which anyone would call the
            // frame "orange".
            top: pick(0x05070e, 0x05060b, 0x070609),
            // MEASURED, AND LEFT ALONE. Darkening this band by ~25% to make the
            // orbital rings stand out cost beats 13, 17 and 18 a third of their
            // occupancy each (0.597 → 0.478, 0.497 → 0.263, 0.464 → 0.230) and
            // flagged a second beat. The band is not competing with the plan;
            // out here it IS most of the picture, and the rings are bright
            // enough drawn brighter rather than by making the sky dimmer.
            horizon: pick(0x3a4258, 0x3d3c46, 0x453e3c),
            bottom: pick(0x020306, 0x030305, 0x040303),
            bandLift: 0.62 - 0.06 * k,
          };
        },
        opacity: ({ u }) => band(dAt(u), 6.0e6, 2.4e7, MARS_D - 2.0e6, MARS_D - 4.0e5) * 0.95,
      })),

    // ======================================================================
    // THE FAR PLANE — present in every frame from 10 km up to the Martian
    // surface, and the only honest permanent content interplanetary space has.
    // ======================================================================
    L('stars', 1.0e4, walked(95), () =>
      particleField({
        // Dense, because a real sky above the atmosphere is dense, and because
        // once the rust wash came off the deep sky the stars have to be what
        // fills the frame instead. Nothing here is invented: this is the count
        // a dark-adapted eye already gets from the ground, without the air.
        count: 9000,
        distribution: 'ball',
        seed: 21,
        colorA: 0xffffff,
        colorB: 0xf0d8c0,
        colorMode: 'random',
        size: 2.2,
        maxSize: 6,
        // NO TWINKLE. Twinkle is refraction through moving air; the first ten
        // kilometres of this journey are the only place in it where a star could
        // honestly do that, and the field only reaches full strength at 36 km.
        // Above the air it is a brightness flicker on the clock, which is what
        // made the deep sky read as alive.
        twinkle: 0,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * CELESTIAL_RADIUS_FRAMES,
        // AND THEY GO OUT WHEN THE MARTIAN SKY COMES ON. This layer ran to the
        // end of the axis at full strength, so beats 21 through 28 had a dense
        // starfield drawn over a lit daytime dust sky AND over the ground
        // itself — white speckle across the regolith in every surface frame. It
        // also inflated their occupancy, which is the worse half of the
        // problem: a metric moved by something that cannot be there.
        //
        // THE FADE WINDOW HAS TO OVERLAP THE SKY'S, NOT FOLLOW IT. The first
        // fix put the window at 70–110 km, which is BELOW where the sky
        // arrives: `mars-sky` mounts at 300 km and is already at 0.94 opacity
        // by beat 21's own sample altitude of 95.8 km, where this field was
        // still at 0.55. Two layers whose envelopes are keyed to different
        // quantities — one to altitude, one to frame width — will overlap
        // wherever the frame law says they do, and 200 km of overlap is what
        // put stars back on the regolith after they had supposedly been fixed.
        // Gone by 150 km, which is while the sky is still only ~40% on.
        opacity: ({ u }) => clamp01((dAt(u) - 1.2e4) / 2.4e4)
          * clamp01(((MARS_D - dAt(u)) - 1.5e5) / 6.0e4) * 0.85,
      })),

    // The galactic band. A ball of stars is uniform noise and reads as grain;
    // a FLATTENED, denser, warmer disc through it gives the sky a structure
    // that swings visibly as `AZIMUTH` turns the camera, which across eleven
    // cruise beats is most of what stops them being the same picture.
    L('milky-way', 4.0e4, walked(95), () =>
      particleField({
        // A 0.10-thick disc seen edge-on is a hard bright BAR across the
        // frame, which is what the first pass drew and which reads as a
        // rendering artefact rather than as the galaxy. A band needs real
        // depth and a soft falloff: thicker, wider, dimmer, more of it.
        count: 17000,
        distribution: 'disk',
        innerRadius: 0.02,
        thickness: 0.55,
        flattenY: 0.30,
        // AND NO JITTER, which the brief did not name and which was the worst of
        // the three. `uJitter` displaces each point by that fraction of the
        // field's NORMALIZED radius on three sine terms of the wall clock — at
        // 0.15, and a radius of several frames, every star in the galactic band
        // was wandering through a box more than a frame across, forever. That is
        // the single biggest contributor to "that dust is moving a lot".
        jitter: 0,
        seed: 27,
        colorA: 0xd8e2ff,
        colorB: 0xffd2a0,
        colorMode: 'random',
        size: 2.4,
        maxSize: 6,
        twinkle: 0,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * CELESTIAL_RADIUS_FRAMES,
        // Same exit as `stars`, and for the same reason — this field is denser
        // (17,000 points) so it speckled the regolith harder than the stars did.
        opacity: ({ u }) => clamp01((dAt(u) - 4.5e4) / 6.0e4)
          * clamp01(((MARS_D - dAt(u)) - 1.5e5) / 6.0e4) * 0.62,
      })),

    // Zodiacal dust — real, and the reason the inner solar system is not black.
    // It sits with the other two celestial fields at `CELESTIAL_RADIUS_FRAMES`,
    // so it is part of the SKY: a fixed warm lens along the ecliptic that the
    // ship and the planets move against, rather than a near volume sliding over
    // the stars. See the note on `CELESTIAL_RADIUS_FRAMES` above.
    L('zodiacal-dust', 3.0e6, MARS_D - 4.0e6, () =>
      particleField({
        count: 5600,
        distribution: 'disk',
        innerRadius: 0.02,
        thickness: 0.30,
        flattenY: 0.16,
        seed: 33,
        colorA: 0xffe6c0,
        colorB: 0x6a5a48,
        colorMode: 'random',
        // Bigger points at four times the distance. `pointsMaterial` attenuates
        // as 300/z, so moving the field from 1.8 frames out to 8 shrinks every
        // sprite by the same factor; the size and count here buy back the
        // apparent brightness the move costs, and nothing else about the field
        // changes. Without this the honest fix would have been paid for in
        // occupancy on the eleven cruise beats that have least to spare.
        size: 5.4,
        maxSize: 7,
        // NO SPIN. `spin` is a real geometric rotation on the wall clock, so the
        // whole warm disc was turning at 0.02 rad/s — about a degree a second —
        // under a starfield that was not.
        spin: 0,
        radiusMeters: ({ rebase }) => rebase.frameMeters() * CELESTIAL_RADIUS_FRAMES,
        respectBand: false,
        // Flatter and denser than before, because zodiacal light is a lens of
        // dust in the ecliptic and not a haze filling the sky — concentrating
        // it is what lets it be a visible warm structure without becoming a
        // global tint over everything.
        opacity: ({ u }) => band(dAt(u), 3.0e6, 2.0e7, 5.2e11, MARS_D - 4.0e6) * 0.42 * Math.sqrt(sunFlux(dAt(u))),
      })),

    // ======================================================================
    // THE PAD AND THE ASCENT
    // ======================================================================
    // ======================================================================
    // "IS THAT EARTH?? WHO ARE YOU KIDDING." — a reader, about beats 1 and 2.
    //
    // They were right, and the reason was in three numbers. `featureMeters` was
    // 220 against a 140 m opening frame, so the relief had less than one whole
    // feature in the picture and read as a flat plate. The palette was
    // 0x3b3a36 / 0x5a5443 — two greys with a brown cast, which is a quarry, not
    // a coastline. And there was no WATER anywhere in the journey's first
    // kilometre, when every human launch site on Earth is coastal for the
    // obvious reason that spent stages have to fall somewhere.
    //
    // WHAT THIS IS NOT: a new `coastalTerrain` archetype. `terrain` already
    // takes a real palette, decoupled colour wavelengths and a relief scale,
    // and `water` already exists precisely to put a shoreline under a camera —
    // big-bang crosses one with it. A coast is those two archetypes in one
    // frame, which is what a coast IS; folding a water plane into the ground
    // shader would have made a third way to draw water and left the two
    // existing ones in place.
    L('pad-ground', 1, 3.0e3, () =>
      terrain({
        // Relief and colour wavelengths BELOW the opening frame, so the ground
        // has structure in it at the scale the reader is actually looking at.
        radiusMeters: 2.5e3, ampMeters: 5.5, featureMeters: 130, flattenMeters: 420,
        coarseMeters: 58, fineMeters: 12,
        // Pale sand, scrub, and the grey-brown of wet marsh soil under it.
        seed: 8, rock: 0x5d5644, dry: 0x8f7d5e, lightDir: [0.8, 0.4, -0.3],
        offsetMeters: ({ u }) => [0, -dAt(u), 0],
        surface: ({ u }) => { const s = skyAt(dAt(u)); return { haze: s.haze, lightColor: s.light, sun: 0.55 * s.air + 0.05, cover: 0.64, fields: 0, urban: 0.22 }; },
        opacity: ({ rebase }) => frames(rebase, 60, 620),
      })),
    // The water the pad stands beside. Its level sits below the flattened apron
    // and inside the relief band, so the shoreline is where the ground actually
    // dips rather than a drawn circle — and at a pad camera it is seen at a
    // grazing angle, where `water`'s Fresnel term hands it the sky. That bright
    // band behind a dark launch complex is the whole "this is a coast" read.
    L('pad-water', 1, 6.0e3, () =>
      water({
        radiusMeters: 7.0e3,
        levelMeters: ({ u }) => -dAt(u) - 1.9,
        waveMeters: 0.30, wavelengthMeters: 11, chop: 1.1,
        sunDir: [0.82, 0.16, -0.42], sunGain: 0.55,
        drive: ({ u }) => {
          const s = skyAt(dAt(u));
          return { sky: s.horizon, deep: mixHex(0x06121c, 0x143f52, s.air) };
        },
        opacity: ({ rebase }) => frames(rebase, 60, 3.2e3) * 0.92,
      })),
    L('coast-ground', 60, 4.0e4, () =>
      terrain({
        radiusMeters: 2.0e4, ampMeters: 46, featureMeters: 900, flattenMeters: 2.4e3,
        coarseMeters: 420, fineMeters: 85,
        seed: 12, rock: 0x4a4636, dry: 0x7a6f4c, lightDir: [0.8, 0.4, -0.3],
        offsetMeters: ({ u }) => [0, -dAt(u), 0],
        surface: ({ u }) => { const s = skyAt(dAt(u)); return { haze: s.haze, lightColor: s.light, sun: 0.6 * s.air + 0.04, cover: 0.62, fields: 0.3, urban: 0 }; },
        opacity: ({ rebase }) => frames(rebase, 380, 3.4e3),
      })),
    // …and the Atlantic behind it, at the scale where the lagoons, the barrier
    // island and the open sea are three separate things.
    L('coast-water', 60, 1.2e5, () =>
      water({
        radiusMeters: 6.0e4,
        levelMeters: ({ u }) => -dAt(u) - 11,
        waveMeters: 1.6, wavelengthMeters: 90, chop: 1.2,
        sunDir: [0.82, 0.16, -0.42], sunGain: 0.45,
        drive: ({ u }) => {
          const s = skyAt(dAt(u));
          return { sky: mixHex(0x0b1420, s.horizon, 0.75), deep: mixHex(0x050d16, 0x123b4e, s.air) };
        },
        opacity: ({ rebase }) => frames(rebase, 700, 2.6e4) * 0.9,
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
        // DAYLIT LAND SEEN FROM EIGHTY KILOMETRES IS NOT DARK. This was
        // 0x223038 / 0x33402f at sun 0.68 — a night-ish green sheet under a
        // black sky, which is why beats 4 through 6 are the three lowest-contrast
        // frames in the journey (0.103, 0.074, 0.135) even though they are the
        // three with the most going on in them. Contrast is luminance SPREAD,
        // and a dark ground under a dark sky has none whatever is drawn on it.
        seed: 18, rock: 0x2c3d47, dry: 0x4a5a3c, lightDir: [0.8, 0.4, -0.3],
        offsetMeters: ({ u }) => [0, -dAt(u), 0],
        // …AND THE LIFT IS KEYED TO ALTITUDE, because it helps in one place and
        // hurts in another. Measured: raising this flat to 0.82 took beat 5 from
        // 0.074 contrast to 0.088 and beat 4 (Max Q) from 0.103 DOWN to 0.075 —
        // at 14 km the ground is under a lit cloud deck, and brightening it
        // there closes the gap between the two instead of opening one. Above
        // 60 km the sky is black and the same lift is pure spread.
        surface: ({ u }) => {
          const d = dAt(u);
          const s = skyAt(d);
          return {
            haze: mixHex(0x060a12, s.haze, 0.5), lightColor: 0xdfe6ff,
            sun: plin([[2.0e4, 0.66], [6.0e4, 0.84]], d),
            cover: 0.5, fields: 0, urban: 0,
          };
        },
        opacity: ({ rebase }) => frames(rebase, 1.8e4, 3.6e5),
      })),

    L('complex', 1, 1.2e3, () =>
      blocks({
        count: 5, areaMeters: 240, clearMeters: 100, spacingMeters: 78,
        heightMeters: [4, 13], footprint: 0.45, seed: 24, color: 0x6d7178,
        lightDir: [0.8, 0.4, -0.3], sun: () => 0.62, night: () => 0.12,
        // THE ORIGIN IS THE SPACECRAFT, SO THE PAD HAS TO BE PUSHED DOWN. Every
        // other layer standing on Florida — four terrain shells, the service
        // tower, the pad lights — carries `-dAt(u)`. This one had no way to say
        // it, because `blocks` had no `offsetMeters` at all, so the buildings
        // rode the rocket into the sky at a constant size beside it. A human
        // scrolling the journey reported it as "the entire brown block/buildings
        // get lifted", which is exactly what it was.
        offsetMeters: onGround(),
        respectBand: false,
        opacity: ({ u, rebase }) => frames(rebase, 70, 900) * clamp01((1.6e3 - dAt(u)) / 1.2e3),
      })),
    // THE MOBILE LAUNCHER. This was `blocks({ count: 1, heightMeters: [96,104] })`
    // — literally one box, a featureless black slab standing in for a hundred
    // metres of open steel. That is the exact defect `earth-to-moon` already
    // paid for ("boxes make a town; they cannot make a structure") and the exact
    // reason `tower` was written; this journey simply never adopted it.
    //
    // A launch tower is mostly HOLES, and the ARMS are what stop a lattice
    // reading as scaffolding: four umbilicals at different heights reaching
    // across the gap to the vehicle, the topmost one the crew access arm. Their
    // reach is derived — `tower` places an arm from its own face outward, so
    // width/2 + length lands the tip at x = 0, which is where the stack is.
    L('service-tower', 1, 900, () =>
      tower({
        heightMeters: 118, widthMeters: 16, bays: 12, legR: 0.030, braces: 'x',
        color: 0x8d939b, metalness: 0.48, roughness: 0.68,
        deck: { sizeMeters: 76, thickness: 3.2, color: 0x5d5a54 },
        arms: [
          { at: 0.26, lengthMeters: 20, thickness: 1.5, side: 1 },
          { at: 0.46, lengthMeters: 20, thickness: 1.5, side: 1 },
          { at: 0.68, lengthMeters: 20, thickness: 2.4, side: 1 },
          { at: 0.84, lengthMeters: 19, thickness: 1.3, side: 1 },
        ],
        cap: { heightMeters: 5, overhang: 0.12 },
        offsetMeters: ({ u }) => [-28, -dAt(u), 12],
        respectBand: false,
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

    // The low cloud field, for the first few kilometres where individual
    // clumps still have shape.
    L('clouds', 200, 6.0e4, () =>
      particleField({
        count: 3000, distribution: 'cloud', clumps: 70, clumpSpread: 0.09, flattenY: 0.035,
        seed: 38, blending: 'normal', colorA: 0xf2f4f8, colorB: 0x9aa6b4, colorMode: 'random',
        size: 14, maxSize: 34,
        radiusMeters: ({ rebase }) => Math.min(4.0e4, rebase.frameMeters() * 1.6),
        offsetMeters: ({ u }) => [0, 2.0e3 - dAt(u), 0],
        respectBand: false,
        opacity: ({ u, rebase }) => {
          const f = rebase.frameMeters();
          return clamp01((f - 900) / 900) * clamp01((3.0e4 - f) / 1.6e4) * airAt(dAt(u)) * 0.5;
        },
      })),

    // THE DECK. Above about 15 km a cloud field stops being clumps and becomes
    // a continuous lit sheet, which is both what it looks like and — measured —
    // the difference between Max Q reading as a dark green rectangle and
    // reading as a place. `cloudDeck` exists for exactly this (see
    // src/archetypes/cloud-deck.js): the point-sprite field it replaces reads
    // as cotton balls at any count, and a sheet needs an explicit renderOrder
    // against the ground under it or the transparent sort loses the coin toss.
    L('cloud-deck', 1.2e3, 2.0e5, () =>
      cloudDeck({
        radiusMeters: ({ rebase }) => Math.min(6.0e5, rebase.frameMeters() * 2.6),
        altitudeMeters: 2.2e3,
        layers: 4,
        thicknessMeters: 1.6e3,
        coverage: 0.52,
        scale: 3.6,
        color: 0xf6f9ff,
        shadowColor: 0x7f8da0,
        sunDir: [0.8, 0.34, -0.4],
        seed: 5,
        offsetMeters: ({ u }) => [0, -dAt(u), 0],
        opacity: ({ rebase }) => frames(rebase, 2.6e3, 4.2e5) * 0.85,
      })),

    // ======================================================================
    // THE VEHICLE — one declared stack from the pad to Mars arrival, shedding
    // twice and unfolding once.
    //
    // WHAT CHANGED, and why it is the whole journey: `offsetMeters` used to
    // return exactly [0,0,0] for everything up to 5.30e11 m. The camera does
    // not look at the origin during the cruise, so the protagonist was parked
    // somewhere off the boresight for eleven consecutive beats — invisible, not
    // off-centre. It is now SCREEN-ANCHORED from 30,000 km out: derived from
    // the same camera basis `aimCamera` builds, so it holds the lower-right
    // corner whatever `AZIMUTH` and `ROLL` are doing, at a true 3 units in
    // front of the lens so it parallaxes against everything it passes.
    // ======================================================================
    // ======================================================================
    // THE LAUNCH VEHICLE — a flanked heavy-lift stack, not a bollard.
    //
    // WHAT THIS USED TO BE, and why one layer became two. A single `vehicle`
    // ran from the pad to Mars arrival: three coaxial white cylinders and a
    // gold cone. It failed the name-the-object test at both ends of its life.
    // On the pad it was "a white tube with a party hat", because a heavy
    // launcher is identified from its FLANKED base — SLS, Delta IV Heavy,
    // Falcon Heavy, Atlas V, Ariane 5 and Soyuz are all three-lobed long before
    // any detail resolves, and `vehicle` had neither boosters nor the fins it
    // declared. In the cruise it was "a glowing cylinder", because a real
    // interplanetary cruise stage is a wide flat DISC and not a rocket with the
    // bottom shed. Those are two different objects and they are now two
    // archetypes.
    //
    // The three things that changed the silhouette here, in order of how much
    // they buy: two strap-on boosters with their own noses and nozzles; a
    // payload FAIRING that is wider than the stage under it, blunt, split down
    // the middle and off-white; four swept fins at the base. Plus an orange
    // core against white boosters, which is most of why an SLS is recognisable
    // at a glance and which the previous uniformly-white stack threw away for
    // free — it is sprayed foam insulation, not paint.
    // ======================================================================
    L('launch-stack', 1, 1.2e7, () =>
      vehicle({
        lengthMeters: ({ u, rebase }) => stackLen(rebase, dAt(u)),
        bands: 5,
        bandDepth: 0.42,
        lightDir: SUN_DIR,
        ambient: 0.20,
        stages: [
          {
            // The core. Orange, because the insulation on a cryogenic core is
            // orange and because a stack that is white all over has thrown away
            // its own strongest identifying feature.
            span: 0.46, r: 0.048, color: 0xc0632c, nozzles: 4, nozzleR: 0.015,
            bell: true, tumble: 1.0,
            shed: ({ u }) => plin([[6.4e4, 0], [7.6e4, 0.5], [9.5e4, 1]], dAt(u)),
          },
          {
            span: 0.25, r: 0.044, color: 0xdfe3e8, nozzles: 1, nozzleR: 0.017,
            bell: true, tumble: 0.7,
            // Parking-orbit insertion, one coast, then TMI — and only then is
            // it discarded. The old table shed this at 2.2e5, which is where
            // the copy says the trans-Mars burn STARTS.
            shed: ({ u }) => plin([[3.0e6, 0], [5.0e6, 0.5], [8.0e6, 1]], dAt(u)),
          },
          {
            // THE PAYLOAD ADAPTER. A short tapered cone between the upper stage
            // and the cruise stage's heat shield — the piece of real hardware
            // that makes a payload look BOLTED to a rocket rather than flying in
            // formation with it. Beat 7 showed sky between the two, because the
            // payload's centre was placed at an independently-chosen 0.30 of the
            // stack while the stage's top is at 0.21; the gap was the difference.
            // Fixing the anchor closes it, and the adapter is what fills it.
            //
            // It goes with the upper stage, because it does.
            span: 0.025, r: 0.044, topR: 0.027, color: 0x9aa1aa, nozzles: 0,
            tumble: 0.9,
            shed: ({ u }) => plin([[3.0e6, 0], [5.0e6, 0.5], [8.0e6, 1]], dAt(u)),
          },
        ],
        capsule: null,
        fairing: {
          // Off-white, not white: under this stage's 0.45 bloom threshold and a
          // 3.2-intensity sun, a near-white hull is a blown-out blank shape that
          // loses every feature it has.
          span: 0.18, r: 0.052, color: 0xc6cbd2, gap: 0.075, tumble: 1.3,
          shed: ({ u }) => plin([[1.05e5, 0], [1.35e5, 1]], dAt(u)),
        },
        boosters: {
          count: 2, span: 0.36, r: 0.028, nozzleR: 0.019,
          color: 0xd5dae0, noseColor: 0xbfc5cd, banded: false, tumble: 1.6,
          // Solid boosters go at about two minutes, well before first-stage
          // cutoff — keyed so beat 5 ("the spent first stage falls away") still
          // stages the CORE separation and is not two events at once.
          shed: ({ u }) => plin([[3.6e4, 0], [4.4e4, 0.5], [5.6e4, 1]], dAt(u)),
        },
        fins: {
          count: 4, span: 0.105, spread: 0.050, thickness: 0.008,
          color: 0xaeb5be, phase: Math.PI / 4,
        },
        plume: {
          span: 0.85, r: 0.050, core: 0xfff4d8, edge: 0xff8a2e, gain: 1.0,
          smoke: 0x33302c, smokeEdge: 0x121110, smokeGain: 0.5, soft: 1.5,
          // The burning engine moves UP the stack when the core goes.
          at: ({ u }) => plin([[6.4e4, 0], [9.5e4, 0.46]], dAt(u)),
          throttle: ({ u }) => plin([
            [1, 0], [4, 1], [1.0e4, 1], [1.4e4, 0.7], [2.4e4, 1],
            [6.4e4, 1], [6.6e4, 0], [7.2e4, 0.85], [1.85e5, 0.85], [1.9e5, 0],
            [2.15e5, 0], [2.2e5, 1], [2.6e6, 1], [3.2e6, 0], // TMI
          ], dAt(u)),
        },
        attitude: ({ u }) => ascentAttitude(dAt(u)),
        offsetMeters: ({ u, rebase }) => [0, stackRise(rebase, dAt(u)), 0],
        opacity: ({ u }) => clamp01((1.05e7 - dAt(u)) / 3.0e6),
        respectBand: false,
      })),

    // ======================================================================
    // THE CRUISE STAGE — the protagonist for fourteen beats, and an object
    // that is genuinely not a rocket.
    //
    // A blind reviewer that never saw the copy described this whole stretch as
    // "glowing cylinders, panels, spheres" and never once as a spacecraft,
    // because it WAS a cylinder: `vehicle` with the launch stages shed. The
    // real article is 2.65 m across and 1.6 m tall with its aeroshell — wider
    // than it is tall, a disc of solar sections with a blunt heat shield slung
    // under it. `cruiseStage` is that shape, and a disc is legible at fewer
    // pixels than a tube is, which matters because this object has to hold
    // beats 10 through 20.
    //
    // IT RIDES ON THE STACK FIRST. From fairing jettison to TMI it is bolted to
    // the top of the upper stage, and its position comes from `onStackAxis` —
    // the stack's own length and the stack's own attitude — so the two cannot
    // read as two stickers that happen to be near each other. From 30,000 km
    // out it slides continuously to the screen anchor and becomes the hero.
    // ======================================================================
    L('cruise-stage', 1.0e5, MARS_D - 6.0e5, () =>
      cruiseStage({
        spanMeters: ({ u, rebase }) => {
          const s = cruiseBlend(dAt(u));
          const stowed = stackLen(rebase, dAt(u)) * 0.088;
          const hero = Math.max(60, rebase.frameMeters() * 0.175);
          return stowed * (1 - s) + hero * s;
        },
        lightDir: SUN_DIR,
        ambient: 0.22,
        disc: {
          height: 0.19, sectors: 5, sectorGap: 0.11, thrusters: 4,
          // The ribs and the deck were near-white, so the disc's own face
          // carried a specular hot spot that clipped in every cruise frame —
          // the brightest thing in the picture was the middle of the subject.
          deckColor: 0x9aa0a8, cellColor: 0x243a76, rimColor: 0x6b727b,
          ribColor: 0xa6acb4,
          // The body-mounted face in CELLS rather than five plain wedges. A
          // reader looking at the close-ups said "if there needs to be solar
          // panel, then create it with solar panels properly", and the disc was
          // half of what they meant: a blue circle with oversized grey spokes.
          cellRows: 3, cellCols: 4, cellGap: 0.007,
        },
        arrays: {
          count: 2, span: 0.92, width: 0.36, at: 0.35, tilt: 0.10,
          color: 0x22376e, frameColor: 0x9aa1aa,
          // …and the wings as three hinged sections on a twin-beam yoke, with a
          // cell grid, raised rails and a metallic substrate behind. They were
          // one flat featureless dark-blue slab each.
          panelCount: 3, panelGap: 0.025, panelThickness: 0.012, boom: 0.16,
          hingeRadius: 0.012, cellRows: 4, cellCols: 6, cellGap: 0.004,
          backColor: 0x8f98a2, gridColor: 0x7890b8,
          deploy: ({ u }) => deployAt(dAt(u)),
        },
        // Out at the rim rather than on the face, and grey rather than white:
        // over the disc's own solar sections a bright dish is a blown-out blob
        // in the middle of the subject, where against black it is a silhouette
        // with a rim and a feed on it.
        antenna: {
          diameter: 0.36, at: [0.33, 0.13, -0.30], tilt: -0.62, yaw: 0.85,
          color: 0xa9b0b9,
        },
        backshell: { diameter: 0.60, topDiameter: 0.26, height: 0.24, color: 0xc6cbd2 },
        heatShield: {
          diameter: 0.62, depth: 0.20, color: 0x6d5442,
          rimColor: 0x9c6a44, bandColor: 0x4d3a2d,
        },
        // BOLTED DOWN, THEN FREE-FLYING. While the payload is on the stack its
        // origin is its AFT HARDPOINT, so `offsetMeters` can be the joint itself
        // and the two cannot drift apart; once it is the cruise hero its origin
        // is the disc centre, so the screen anchor holds the middle of the craft
        // where it was composed. The archetype interpolates between the two
        // because only the archetype knows how deep its own aeroshell is — the
        // previous version made the journey guess, and the guess (0.30 of the
        // stack against a stage top at 0.21) is exactly the visible gap a reader
        // reported as "the satellite is not at all linked with the rocket".
        anchor: ({ u }) => 1 - cruiseBlend(dAt(u)),
        attitude: ({ u }) => stackAttitude(u),
        offsetMeters: ({ u, rebase }) => {
          const s = cruiseBlend(dAt(u));
          const attached = onStackAxis(PAYLOAD_MOUNT, rebase, u);
          if (s <= 0) return attached;
          const anchored = screenAnchoredMeters(u, HERO_ANCHOR);
          return [0, 1, 2].map((i) => attached[i] * (1 - s) + anchored[i] * s);
        },
        // Appears as the shroud opens, and stands down once the lander is a
        // separate declared vehicle.
        opacity: ({ u }) => clamp01((dAt(u) - 1.05e5) / 2.6e4)
          * clamp01((MARS_D - 8.0e5 - dAt(u)) / 6.0e5),
        respectBand: false,
      })),

    // The course correction, at beat 15's own MIDPOINT rather than at a round
    // number on the axis, and placed through the SAME anchor the craft is, so
    // the flame is at the vehicle rather than near it.
    L('correction-burn', 3.9e11, 4.5e11, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.013,
        // Clear of the disc, not on it: the craft is 0.155 of the frame across
        // and this anchor is in units of frame/4, so anything inside ~0.3 of a
        // unit is simply behind the vehicle.
        offsetMeters: ({ u }) => screenAnchoredMeters(u, {
          ...HERO_ANCHOR, right: HERO_ANCHOR.right + 0.62, up: HERO_ANCHOR.up - 0.34,
        }),
        color: 0xdfe8ff, haloColor: 0x7fa8ff, haloScale: 5.0,
        solid: true, solidColor: 0xf0f5ff, segments: 16, respectBand: false,
        opacity: ({ u }) => plin([
          [4.02e11, 0], [4.16e11, 0.9], [4.30e11, 0],
        ], dAt(u)),
      })),

    // Staging debris and retro flash — the middle phase of the staging event.
    //
    // THINGS THAT MOVE TOGETHER MUST BE DERIVED TOGETHER, and this was the one
    // place in the journey that still broke it. Both effects were placed at a
    // FRACTION OF THE FRAME below the origin — the flash at -0.20, the debris at
    // -0.28 — while every Earth terrain layer sits at `-dAt(u)`. At 73 km up
    // with a 290 km frame that is also about -0.26 of the frame, so two
    // completely unrelated offsets coincided and the separation event was drawn
    // ON THE PLANET. A human scrolling the journey read it as an explosion on
    // the ground, which is the only thing it could have read as: it was at the
    // same screen position as the surface, at the same moment, at the size of a
    // weather system.
    //
    // They now hang off the CORE/UPPER-STAGE JOINT — `-0.04 = -0.5 + 0.46` in
    // the stack's own unit envelope — carried through the stack's own attitude,
    // so the flash is where the interstage is and the debris expands out of it.
    // Same derivation as the payload above; one number, not two that are
    // supposed to agree.
    L('stage-debris', 6.2e4, 1.5e5, () =>
      particleField({
        count: 900, distribution: 'disk', innerRadius: 0.15, thickness: 0.5,
        // Darker and sparser: at 1,400 near-white sprites this read as a snowball
        // stuck to the interstage. Real staging debris is insulation and frost —
        // dim, uneven, and legible as FRAGMENTS against the flash behind it.
        seed: 32, blending: 'normal', colorA: 0xc2cbd5, colorB: 0x4a5058, colorMode: 'random',
        size: 2.0, maxSize: 6, jitter: 0.02,
        radiusMeters: ({ u, rebase }) => rebase.frameMeters() * plin([[6.5e4, 0.02], [8.0e4, 0.08], [9.5e4, 0.18], [1.4e5, 0.35]], dAt(u)),
        offsetMeters: ({ u, rebase }) => stageJointMeters(rebase, u),
        respectBand: false,
        opacity: ({ u }) => plin([[6.4e4, 0], [7.0e4, 0.85], [1.1e5, 0.4], [1.5e5, 0]], dAt(u)),
      })),
    L('retro-flash', 6.4e4, 1.0e5, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.022,
        offsetMeters: ({ u, rebase }) => stageJointMeters(rebase, u),
        color: 0xfff0d0, haloColor: 0xffc98a, haloScale: 2.6, respectBand: false,
        opacity: ({ u }) => plin([[6.5e4, 0], [7.4e4, 0.62], [8.6e4, 0.30], [1.0e5, 0]], dAt(u)),
      })),

    // ======================================================================
    // EARTH — a real disc that has to get smaller.
    //
    // Its position is its TRUE offset and the frame law is 0.6 × that offset,
    // so Earth holds a constant 6.7 units from the origin and its drawn
    // diameter is 6.67 R/c: 533 px at ten thousand kilometres, 102 px at
    // eighty, 9 px at a million. The old table widened the frame at roughly the
    // rate Earth receded and cancelled the only thing the beat had to show.
    // ======================================================================
    L('earth', 2.0e4, 1.6e10, () =>
      planet({
        radiusMeters: R_EARTH,
        offsetMeters: ({ u }) => [0, earthCentre(dAt(u)), 0],
        lightDir: SUN_DIR, rock: 0x5b5140, atmosphere: 0x67b0ff, atmosphereScale: 1.014,
        spin: 0.004, segments: 128, respectBand: false,
        // THE SHIP LEAVES ALONG +y AND THAT IS ALSO THE SPIN AXIS, so without a
        // tilt every departure beat is a view straight down the north pole: a
        // white cap in the middle of the disc, the continents smeared round the
        // rim, no recognisable geography anywhere. 1.15 rad puts the camera over
        // the mid-latitudes instead, where the coastlines, the terminator and
        // the ice cap are three separate readable things.
        tilt: [1.15, 0.22],
        // `night` was 1, and `planet` multiplies its city term by 2.4 before
        // this stage's bloom gets it — the lights on the terminator were broad
        // white streaks with no city in them. Halved, they are points again.
        surface: () => ({ magma: 0, seaLevel: 0.5, green: 0.85, ice: 0.24, night: 0.5, atmosphere: 1 }),
        opacity: ({ u, rebase }) => clamp01((rebase.frameMeters() - 6.0e4) / 7.0e4)
          * clamp01((8.0e9 - dAt(u)) / 3.4e9),
      })),

    // Earth once it is honestly sub-pixel: a bright blue point, held near the
    // frame edge on the side the ship came from. Every journey here has one
    // placement of this kind, and the carve-out is always the same — a body
    // whose true position is unrenderable is placed compositionally and sized
    // by the real quantity the beat is about. `pointPositionMeters` slides
    // between the two continuously rather than cutting.
    L('earth-point', 3.0e9, 3.6e11, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.010,
        // WHERE EARTH ACTUALLY IS, in two regimes that have to agree at the
        // handover. Close in, the journey's own convention holds: Earth is
        // straight back along the travel axis at the distance flown, and the
        // planet MESH is drawn at exactly that, so the point has to match it or
        // there are two Earths. Far out the convention stops being true —
        // the chord back to the departure point is not the arc that was flown —
        // and what matters instead is that Earth sits ON Earth's orbit, which
        // by then is a ring in the frame. The blend runs across 20,000 to
        // 80,000 Mm, which is after the mesh is gone and before the ring
        // arrives.
        offsetMeters: ({ u }) => {
          const d = dAt(u);
          const axis = [0, earthCentre(d), 0];
          const helio = helioWorldMeters(u, [AU, 0]);
          const k = clamp01((d - 2.0e10) / 6.0e10);
          const p = [0, 1, 2].map((i) => axis[i] * (1 - k) + helio[i] * k);
          return placedPositionMeters(u, p, { right: -1.28, up: 0.42, ahead: 4.6 });
        },
        color: 0xcfe2ff, haloColor: 0x74a8f0, haloScale: 4.0,
        solid: true, solidColor: 0xe8f2ff, segments: 20, respectBand: false,
        opacity: ({ u }) => band(dAt(u), 3.0e9, 7.0e9, 2.6e11, 3.6e11) * 0.9,
      })),

    // ======================================================================
    // THE SUN — this journey's stated reason to exist, and the one subject on
    // screen for the whole interplanetary stretch.
    //
    // Mars receives 43% of Earth's sunlight. That is a VISIBLE FACT and it is
    // now drawn as one: brightness is the real inverse-square flux against
    // heliocentric range, and the glare radius is its square root, so the disc
    // shrinks by a measured factor of 1.52 and cools between beat 10 and beat
    // 16. The bearing is authored, because the honest one is unrenderable — but
    // it is authored ONCE, through the camera's own basis, rather than as a
    // world direction that has to coincide with a separately-authored aim.
    // ======================================================================
    L('sun', 2.0e5, MARS_D - 1.8e5, () =>
      glowSphere({
        radiusMeters: ({ u, rebase }) => rebase.frameMeters() * 0.052 * Math.sqrt(sunFlux(dAt(u))),
        // AT THE CENTRE OF ITS OWN ORBITS, once they are in frame. Everywhere
        // else the Sun's true heliocentric offset is tens of frame-widths off
        // the boresight and it has to be composed rather than placed — the same
        // carve-out `earth-point` and `mars-point` already use, and the same
        // helper, generalised to a body that is not on the travel axis. The
        // crossover happens by itself as the frame widens onto the plan: it is
        // a distance from the AIM POINT, not a beat number.
        offsetMeters: ({ u }) => placedPositionMeters(u, helioFrame(u).sunWorld, {
          right: -1.02, up: 0.58, ahead: 5.0,
        }),
        color: 0xfff2d8, haloColor: 0xffcf8a, haloScale: 8.5,
        solid: true, solidColor: 0xfff6e6, segments: 24,
        respectBand: false,
        opacity: ({ u }) => {
          const d = dAt(u);
          // The Sun does NOT go out at Mars' orbit. This used to fade from
          // 5.4e11 m, which took it off screen across beats 17 to 20 — the four
          // emptiest frames in the journey, and the four that could least
          // afford to lose their one permanent object. It now holds until the
          // Martian sky takes over at entry interface, shrunk and dimmed by the
          // real inverse-square flux, which is the fact the journey is built on.
          return band(d, 2.0e5, 1.2e6, MARS_D - 6.0e5, MARS_D - 2.0e5) * (0.45 + 0.55 * sunFlux(d));
        },
      })),

    // NOTE. A particle ball was tried here as a corona and it read as a
    // granular STAR CLUSTER — points are points at any density, and a light
    // source has no grain in it. The halo sprite on the sphere above is what
    // makes a star read as light, so the radius went there instead.

    // ======================================================================
    // THE PLAN — the transfer arc, and the two orbits it runs between.
    // ======================================================================
    // Carried through the approach rather than faded out at Mars' orbit. Beats
    // 17 and 18 are the thinnest frames in the journey — a small craft, a
    // growing dot and stars — and near the end of the arc the path is a long
    // diagonal straight across the picture, which is exactly the large-area
    // element those two beats did not have.
    // THE TRANSFER, AS HALF AN ELLIPSE ROUND THE SUN. See `hohmannPoint` and
    // `helioFrame` in plan.js for the derivation and for what this replaced —
    // a 12%-deep sinusoidal bow on a straight line, drawn in a plane the two
    // orbital rings were not in. All three now come out of one frame, so the
    // spacecraft is at the world origin ON the curve by construction: the path
    // is built in heliocentric metres with the Sun at its own origin, and the
    // group is translated to where the Sun is and rotated onto the ship's own
    // travel direction.
    L('transfer-path', 5.0e6, MARS_D - 8.0e6, () =>
      trajectory({
        path: (s) => { const [x, y] = hohmannPoint(s); return [x, y, 0]; },
        samples: 480,
        // FLOWN BRIGHT, AHEAD FAINT — the whole reason `trajectory` exists. At
        // the plan's own scale this arc is the subject rather than a decoration
        // on a black frame, so it carries the same tick weight the rings do and
        // the un-flown half is legible rather than merely present: a plan you
        // cannot see the rest of is not a plan.
        ticks: 72,
        tickSize: 6.5,
        color: 0xffd9a4,
        colorAhead: 0x9c7a58,
        aheadOpacity: 0.5,
        offsetMeters: ({ u }) => helioFrame(u).sunWorld,
        rotationRad: ({ u }) => [0, 0, helioFrame(u).theta],
        progress: ({ u }) => transferProgress(dAt(u)),
        opacity: ({ u }) => band(dAt(u), 5.0e6, 2.0e7, MARS_D - 2.4e7, MARS_D - 8.0e6) * 0.9,
      })),

    // Earth's own orbital path. It is a circle about the SUN, in the same plane
    // as the transfer, and the ship crosses it at beat 13 — which is only true
    // in the picture if the two are drawn in one frame. Previously each ring was
    // a circle in the x–z plane centred `AU` ahead along the travel axis, which
    // puts the spacecraft on the ring's POLAR AXIS: Earth was not on Earth's
    // orbit, and the two rings mounted in non-overlapping stretches of the axis
    // so they were never in frame together.
    L('earth-orbit-ring', 4.0e10, MARS_D - 1.4e7, () =>
      trajectory({
        path: (s) => {
          const a = s * Math.PI * 2;
          return [Math.cos(a) * AU, Math.sin(a) * AU, 0];
        },
        samples: 420,
        ticks: 96,
        tickSize: 8.0,
        color: 0xa8c8ff,
        colorAhead: 0x8fb8ff,
        aheadOpacity: 1,
        progress: () => 1,
        offsetMeters: ({ u }) => helioFrame(u).sunWorld,
        rotationRad: ({ u }) => [0, 0, helioFrame(u).theta],
        opacity: ({ u }) => band(dAt(u), 4.0e10, 8.0e10, 5.1e11, 5.42e11) * 0.9,
        respectBand: false,
      })),

    // Mars' own orbital path, crossed at beat 16. Same frame, same plane, so a
    // single frame now holds the Sun, both orbits and the arc between them —
    // which is the one picture that says what this mission IS.
    L('mars-orbit-ring', 4.0e10, MARS_D - 1.4e7, () =>
      trajectory({
        path: (s) => {
          const a = s * Math.PI * 2;
          return [Math.cos(a) * MARS_AU, Math.sin(a) * MARS_AU, 0];
        },
        samples: 420,
        ticks: 96,
        tickSize: 8.0,
        color: 0xff9a5c,
        colorAhead: 0xef8a4c,
        aheadOpacity: 1,
        progress: () => 1,
        offsetMeters: ({ u }) => helioFrame(u).sunWorld,
        rotationRad: ({ u }) => [0, 0, helioFrame(u).theta],
        // The ship is inside Mars' own orbital radius until it arrives, so this
        // ring is honestly still around it for the whole approach. Held to
        // beats 17–18, which needed a large curved element and had none.
        opacity: ({ u }) => band(dAt(u), 4.0e10, 8.0e10, MARS_D - 4.0e7, MARS_D - 1.4e7) * 0.9,
        respectBand: false,
      })),

    // ======================================================================
    // MARS — a point, then a disc, then a world.
    // ======================================================================
    // The point of light, for the stretch where the planet's true angular size
    // is a fraction of a pixel. It hands over to the mesh continuously, because
    // `pointPositionMeters` places it at Mars' TRUE offset the moment that
    // offset is near the boresight and only anchors it compositionally while it
    // is thirty units off — so the reader never sees a point and a disc at once.
    L('mars-point', 3.6e11, MARS_D - 3.0e7, () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.011,
        offsetMeters: ({ u }) => pointPositionMeters(u, marsCentre(dAt(u)), {
          right: 1.18, up: 0.34, ahead: 4.6,
        }),
        color: 0xffcf9a, haloColor: 0xff8f42, haloScale: 4.5,
        solid: true, solidColor: 0xffe0b8, segments: 20, respectBand: false,
        opacity: ({ u }) => band(dAt(u), 3.6e11, 4.6e11, MARS_D - 1.2e8, MARS_D - 3.0e7) * 0.95,
      })),

    // seaLevel below zero (no oceans), ice drives the polar cap, rock is the
    // rust colour the whole journey is named for. Drawn at its TRUE centre —
    // `(MARS_D - d) + R_MARS`, not `MARS_D - R_MARS - d`, which put the centre a
    // full planetary radius short and made the surface arrive 6,780 km early.
    L('mars', 4.4e11, MARS_D - 3.0e5, () =>
      planet({
        radiusMeters: R_MARS,
        offsetMeters: ({ u }) => [0, marsCentre(dAt(u)), 0],
        lightDir: SUN_DIR, rock: 0xb3542a, atmosphere: 0xcf8a5a, atmosphereScale: 1.008,
        spin: 0.003, segments: 128, respectBand: false,
        // Same reason as Earth's, opposite sign: the ship arrives along +y, so
        // an untilted Mars presents its south pole and the beat that promises
        // "a bright polar cap at one pole" would have shown a cap in the middle.
        tilt: [-1.05, -0.30],
        surface: () => ({ magma: 0, seaLevel: -1, green: 0, ice: 0.26, night: 0, atmosphere: 0.30 }),
        // Hands over to the terrain stack as the frame drops through 1.6e6 m.
        // Past that the camera is close enough that a 3,390 km sphere is a wall,
        // and two grounds in one frame is worse than either.
        opacity: ({ rebase }) => clamp01((rebase.frameMeters() - 4.0e5) / 4.0e5),
      })),

    // ======================================================================
    // MARS TERRAIN, far to close
    // ======================================================================
    // The widest shell — the gap between "Mars is a sphere at the far end of
    // the frame" and "Mars is the ground". `mars-far` cannot cover it: a
    // 1.2e6 m disc seen at an 8e5 m frame is the saucer-floating-in-space
    // failure, because the frame has to stay under a terrain's own radius / 6.
    L('mars-limb', MARS_D - 4.0e6, MARS_D - 6.0e4, () =>
      terrain({
        radiusMeters: 9.0e6, ampMeters: 4.0e4, featureMeters: 6.0e5, flattenMeters: 8.0e5,
        seed: 40, haze: 0x7a4a2c, rock: 0xa04f28, dry: 0xbb6d3e, lightDir: SUN_DIR, lightColor: 0xffdcb0,
        offsetMeters: ({ u }) => [0, marsDrop(dAt(u)), 0],
        surface: () => ({ sun: 0.85, cover: 0, fields: 0, urban: 0 }),
        opacity: ({ rebase }) => frames(rebase, 1.6e5, 1.4e6),
      })),
    L('mars-far', MARS_D - 1.2e6, walked(95), () =>
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
    L('mars-sky', MARS_D - 3.0e5, walked(95), () =>
      backdrop({
        radiusFrames: 8,
        // Darker than it was. A butterscotch sky is a MID tone — the reason the
        // real thing photographs the way it does is that Mars gets 43% of the
        // light — and at 0xd79a5a with a band lift on top, the upper half of
        // every surface beat sat within a few percent of white before the sun
        // was even added to it.
        top: 0x2c1c14, horizon: 0xc4884e, bottom: 0x1b0f0a,
        sunColor: 0xfff2d8,
        sunDir: [0.62, 0.22, -0.56],
        // A BODY LIT PAST THE TONE MAPPER'S CEILING IS A HOLE IN THE FRAME. At
        // gain 1.6 the Martian sun was a white disc a fifth of the frame across
        // with a blown halo around it, and the blind review flagged five of the
        // six surface beats as washed out — the sky was eating its own subject.
        // The real one is small and pale: Mars sees 43% of Earth's flux, which
        // is the fact this whole journey is built on.
        // Still not small enough. At 0.9988 this is a 2.8° radius, and at gain
        // 1.15 the wide `pow(c,8)` glare lobe took the top third of every
        // surface beat to white — beats 21, 23, 25 and 28 all came back flagged
        // washed out a second time. Mars sees 43% of Earth's flux and its sun
        // is 0.35° across; drawn at 1.1° and gain 0.62 it is a small pale disc
        // with a rim, in a sky that keeps its butterscotch gradient.
        // The disc is now REAL: Mars sees the sun at 0.35° across, so 0.175° of
        // angular radius, which is cos(0.175°) = 0.9999953. It is allowed to be
        // white — that is what a sun is. What was washing beats 21/23/25/28 was
        // never the disc but the `pow(c, 8)` lobe around it, which is 23° wide
        // and was tied to the same gain, so every previous attempt had to
        // choose between a grey sun and a blown sky. `glareGain` separates them.
        sunSize: 0.9999953, sunSoft: 0.0000180, sunGain: 0.92, glareGain: 0.14,
        bandLift: 0.16,
        opacity: ({ rebase }) => clamp01((3.4e5 - rebase.frameMeters()) / 2.0e5),
      })),

    // ======================================================================
    // ENTRY, DESCENT AND LANDING
    // ======================================================================
    // ONE OBJECT ENTERS THE ATMOSPHERE, AND IT HAS TO BE ON SCREEN.
    //
    // What this stretch used to be: the cruise stage unmounted at 600 km and
    // was already at zero opacity by 800 km, and the lander did not mount until
    // 50 km. Between them — through BOTH beats about entry — there was no
    // vehicle in the journey at all, only a free-floating glow and a disc of
    // nearly-black sprites, and then a lander popped into existence. A reader
    // reported exactly that: "101 km above Mars, our satellite is no more, then
    // suddenly appears."
    //
    // So the aeroshell is now a declared layer that bridges the gap, and the
    // sheath is attached TO it: one pose, one attitude, shared, so the plasma
    // is around the vehicle rather than near it. `entryPose` is that one
    // derivation. It carries a small lateral offset so the entry vehicle sits
    // clear of the copy panel and reads against sky rather than against the
    // limb, and it converges on the origin as the lander takes over.
    L('entry-vehicle', MARS_D - 1.6e5, MARS_D - 1.8e4, () =>
      cruiseStage({
        // The aeroshell alone — the cruise stage's disc, arrays and antenna are
        // gone, cut loose minutes before entry, which is what actually happens.
        // Same archetype, three assemblies omitted, exactly as the jettisoned
        // heat shield below already does it.
        // BIG ENOUGH TO NAME. A blind reviewer scored beat 21 at 1 of 3 for
        // legibility — "a small orange-white glow near the horizon" — with the
        // aeroshell at 0.11 of the frame, about 75 px. At 0.19 the backshell,
        // the heat shield's shoulder and the shock standing off it are three
        // separate readable things.
        spanMeters: ({ rebase }) => rebase.frameMeters() * 0.19,
        lightDir: SUN_DIR,
        ambient: 0.30,
        disc: null,
        arrays: null,
        antenna: null,
        backshell: { diameter: 0.62, topDiameter: 0.28, height: 0.30, color: 0xbfc4cb },
        // Hotter than the cruise stage's, because it IS: this is the face doing
        // the braking, and a near-black disc under a white shock reads as a hole
        // rather than as ablative material at fifteen hundred kelvin.
        heatShield: {
          diameter: 0.66, depth: 0.22, color: 0x8c6146,
          rimColor: 0xc07c4c, bandColor: 0x5e4430,
        },
        attitude: AEROSHELL_ATTITUDE,
        offsetMeters: entryPose,
        respectBand: false,
        // Arrives while the cruise stage is still fading, leaves while the
        // lander is fading in — a crossfade at each end, not a cut.
        opacity: ({ u }) => band(dAt(u),
          MARS_D - 1.5e5, MARS_D - 1.25e5, MARS_D - 3.0e4, MARS_D - 2.0e4),
      })),

    // THE PLASMA SHEATH. This was `particleField` with normal blending and two
    // near-black browns, which is soot; see src/archetypes/entry-sheath.js for
    // why no parameter of a point field could have made it a sheath. It shares
    // `entryPose` and the entry tilt with the aeroshell above, so the shock
    // stands off the windward face and the wake runs the right way by
    // construction rather than by two numbers agreeing.
    L('entry-sheath', MARS_D - 1.5e5, MARS_D - 1.8e4, () =>
      entrySheath({
        spanMeters: ({ rebase }) => rebase.frameMeters() * 0.19,
        // The cap HUGS the shoulder rather than reaching past it: drawn wider
        // than the body it reads as a saucer the vehicle is sitting on, which is
        // the opposite of a shock standing off a windward face.
        capRadius: 0.60, capDepth: 0.30, standoff: 0.10,
        wakeLength: 2.4, wakeBase: 0.46, wakeTail: 0.04,
        breakup: 0.95,
        core: 0xffe0ae, edge: 0xff5a18,
        attitude: SHEATH_ATTITUDE,
        offsetMeters: entryPose,
        // Peak heating is an EVENT, not a level. It builds from entry interface
        // at 125 km, peaks around 60 km — which is beat 22's own mark — and is
        // gone by the time the parachute is the subject.
        // PEAK HEATING HAS TO PEAK WHERE THE BEAT IS SAMPLED. Beat 22 runs
        // from 60 km down to 11 km, so its 45% point — where every review and
        // the film's own dwell land — is about 35 km, not 60. Keyed to the
        // event and then checked against the sample, rather than to the round
        // number in the copy.
        gain: ({ u }) => plin([
          [MARS_D - 1.4e5, 0], [MARS_D - 1.0e5, 0.5],
          [MARS_D - 4.5e4, 1.0], [MARS_D - 3.2e4, 0.9],
          [MARS_D - 2.4e4, 0.18], [MARS_D - 2.0e4, 0],
        ], dAt(u)),
        respectBand: false,
        opacity: ({ u }) => band(dAt(u),
          MARS_D - 1.45e5, MARS_D - 1.3e5, MARS_D - 2.6e4, MARS_D - 2.0e4),
      })),

    // THE GAP IS CLOSED. This was `blob`, under a comment in this file that
    // already admitted a canopy is not a blob — and the frame proved it: a
    // smooth pale sphere hanging over the lander with a visible band of sky
    // between the two and nothing joining them. `parachute` is the archetype
    // (src/archetypes/parachute.js); what it adds is topology a closed volume
    // cannot have — an open shell, twenty gores with seams, a real hole at the
    // crown, a scalloped hem, and shroud lines that converge on the payload.
    //
    // THE ROOT IS THE PAYLOAD. `offsetMeters: [0,0,0]` puts the bridle
    // convergence exactly on the lander the journey has already placed at the
    // origin, and the canopy rides `lineLength` above it — one derivation, so
    // the chute and the thing it is carrying cannot read as two stickers. The
    // old version placed the ball at an independent 0.30 of the frame, which is
    // precisely the gap that was visible.
    L('parachute-canopy', MARS_D - 1.15e4, MARS_D - 1.6e3, () =>
      parachute({
        spanMeters: ({ rebase }) => rebase.frameMeters() * 0.34,
        offsetMeters: [0, 0, 0],
        gores: 20,
        ventRadius: 0.055,
        crownHeight: 0.62,
        skirtDepth: 0.13,
        scallop: 0.05,
        lineLength: 0.88,
        // Lit fabric, not a light source. The first pass at this beat drew a
        // near-white canopy over a bright dust sky and it read as a SECOND SUN
        // a few degrees from the real one; these are the values that fixed
        // that, and the geometry change does not make them safe to raise.
        fabricA: 0xb0a793,
        fabricB: 0x87806f,
        seamColor: 0x5f594e,
        lineColor: 0x453f37,
        ambient: 0.26,
        // INFLATION IS A FUNCTION OF u. Mortar fire to full inflation is under
        // a second on the real article and about 1.9 km of this axis, which is
        // comfortably before beat 23's own 45% sample — so the beat is reviewed
        // on an open canopy, and a reader scrolling into it sees it open.
        inflate: ({ u }) => plin([[MARS_D - 1.10e4, 0], [MARS_D - 9.2e3, 1]], dAt(u)),
        // A slow lean, so the canopy is not a symmetric disc square to the
        // lens. Pure function of u.
        attitude: ({ u }) => {
          const k = clamp01(((MARS_D - 1.1e4) - dAt(u)) / -9.4e3);
          return [0.16 + 0.10 * k, 0.4 * k, -0.20 + 0.16 * k];
        },
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), MARS_D - 1.1e4, MARS_D - 9.0e3, MARS_D - 2.4e3, MARS_D - 1.6e3),
      })),

    // The discarded heat shield, falling away below and tumbling. Beats 23, 24
    // and 25 measured 6.5 / 5.6 / 5.0 adjacent distance — three captions over
    // one picture of a lander over rust ground — and a jettison is the one
    // thing that happens in beat 24 which does not happen in either neighbour.
    // Discarded hardware TUMBLES: a rigid attitude reads as a second working
    // spacecraft flying in formation.
    // A heat shield is a SHALLOW RIGID DISH — a wide blunt sphere-cone, tumbling
    // and catching light on its convex face. Drawn as a `blob` it read as "a
    // pale bubble", which is what a soft wobbling ball is; `blob` cannot make
    // it, because the thing that names a heat shield is its hard circular
    // shoulder and its flat 70° cone, and a blob has neither. Same archetype as
    // the cruise stage it just came off, with the other two assemblies omitted
    // — which is the honest way to draw one half of something that separates.
    L('heat-shield', MARS_D - 2.4e3, MARS_D - 200, () =>
      cruiseStage({
        spanMeters: ({ rebase }) => rebase.frameMeters() * 0.30,
        lightDir: SUN_DIR,
        ambient: 0.34,
        disc: null,
        arrays: null,
        antenna: null,
        backshell: null,
        // A REAL 70° SPHERE-CONE, NOT A DINNER PLATE. `depth: 0.34` on a
        // diameter of 1.0 was a deeper dish than any entry body flies, and with
        // one brown double-sided skin, a smooth torus shoulder and two
        // concentric grooves for "tiles" it read — a reader's words — as
        // something turned on a lathe out of wood. The depth is now DERIVED
        // from the cone angle and the nose radius, the face is tiled rather
        // than grooved, and there is a rear shell with a dark interior for the
        // tumble to reveal.
        heatShield: {
          diameter: 1.0,
          coneAngleDeg: 70, noseRadius: 0.16, shellThickness: 0.035,
          tileRings: 6, tileSectors: 20, tileGap: 0.006,
          tileColorA: 0x77543f, tileColorB: 0x402c24, jointColor: 0x241a15,
          interiorColor: 0x15181b, interiorRibs: 8, ribColor: 0x333941,
          rimColor: 0xc0794a, rimScallops: 24, rimScallop: 0.018,
        },
        // Discarded hardware TUMBLES. A rigid attitude reads as a second working
        // spacecraft flying in formation.
        //
        // AND THE TUMBLE NOW HAS SOMETHING TO SHOW. There is a cavity behind
        // the ablator, so the attitude is phased to bring the rear three-quarter
        // round through the MIDDLE of the opacity window — which is where beat
        // 24 is sampled and where a reader scrolling at any speed will see it.
        // Starting near face-on, passing through edge-on and past the interior
        // is the difference between a tumbling dish and a spinning disc.
        attitude: ({ u }) => {
          const s = clamp01((MARS_D - 2.0e3 - dAt(u)) / -1.4e3);
          return [0.55 + s * 3.4, 0.30 + s * 1.9, 0.35 + s * 2.1];
        },
        offsetMeters: ({ u, rebase }) => {
          const f = rebase.frameMeters();
          const s = clamp01((MARS_D - 2.0e3 - dAt(u)) / -1.4e3);
          // AN EVENT NEEDS SEPARATING FROM WHATEVER IT PASSES IN FRONT OF. The
          // first pass dropped this straight down the middle onto the ground
          // below and it read as a crater. It falls out to one side and stays
          // above the horizon while it is the subject.
          return [f * (0.34 + 0.5 * s), -f * (0.05 + 0.55 * s), -f * 0.22 * s];
        },
        respectBand: false,
        opacity: ({ u }) => band(dAt(u), MARS_D - 2.1e3, MARS_D - 1.9e3, MARS_D - 700, MARS_D - 250),
      })),

    L('lander', MARS_D - 3.0e4, walked(95), () =>
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
          plin([[MARS_D - 3.0e4, 0], [MARS_D - 1.4e3, 0], [MARS_D, 0]], dAt(u)),
          0.5, 0,
        ],
        offsetMeters: ({ u, rebase }) => {
          const d = dAt(u);
          const grounded = clamp01(1 - Math.max(0, MARS_D - d) / 30);
          const len = Math.max(6, rebase.frameMeters() * 0.14);
          const walkedM = Math.max(0, d - MARS_D);
          return [-(walkedM * 0.8) - grounded * 5, grounded * len * 0.42, walkedM * 0.4];
        },
        opacity: ({ u }) => band(dAt(u), MARS_D - 2.6e4, MARS_D - 1.6e4),
        respectBand: false,
      })),

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

    // ======================================================================
    // THE SURFACE
    // ======================================================================
    // AT A 1.4 m FRAME A HALF-METRE BOULDER ONE METRE AWAY IS A WALL. Beat 27
    // is shot at that frame — it is a close-up of regolith — and this layer's
    // gate opened at 0.8 m, so a 0.55 m rock at 1.1 m standoff blacked out the
    // right half of the picture. Foreground rock belongs at frames where a
    // half-metre rock is foreground rather than architecture; the close frame
    // gets pebbles of its own, below.
    // Sized and stood off so a half-metre rock is FOREGROUND rather than
    // architecture. The gate used to open at a 0.8 m frame, and a 0.55 m rock
    // at 1.1 m standoff blacked out the right half of beat 27.
    //
    // MOVING THE GATE IS NOT THE SAME AS CLOSING IT. That fix took the opening
    // frame from 0.8 m to 0.9 m and the beat is shot at 1.4 m, so
    // `frames(rebase, 0.9, 40)` still evaluates to 0.69 there — the layer was
    // 69% on, and the blind reviewer flagged the same occlusion a second time.
    // A rise band whose LOW end sits under the frame being protected cannot
    // switch a layer off, however far the numbers move inside it. At 2.8 m the
    // 1.4 m frame is genuinely below the band and this reads zero.
    L('foreground-rocks', walked(2), walked(95), () =>
      rocks({
        count: 26, seed: 91, sizeMeters: [0.05, 0.18], areaMeters: 4.2,
        centreClear: 1.1, buryFraction: 0.34, angularity: 0.36,
        rock: 0x6a3a24, dry: 0x8a5638, ambient: 0x2a1c14, lightDir: SUN_DIR,
        offsetMeters: ({ u }) => [1.35, marsDrop(dAt(u)), -2.6],
        respectBand: false,
        opacity: ({ rebase }) => frames(rebase, 2.8, 40),
      })),
    // …and the close frame gets its own scale of debris. A 1.4 m frame is a
    // picture of regolith, so the thing that has to have structure in it is the
    // gravel, not the boulders.
    L('pebbles', walked(1), walked(95), () =>
      rocks({
        count: 54, seed: 93, sizeMeters: [0.018, 0.10], areaMeters: 2.1,
        centreClear: 0.16, buryFraction: 0.38, angularity: 0.44,
        // SKYLIGHT FILLS A MARTIAN SHADOW. `ambient` was 0x2c1e15 — about 16%
        // — which renders the unlit face of every rock as effectively black,
        // and a blind reviewer twice called the foreground "a large near-black
        // mass". A shadow on Mars is not black: the sky is a bright butterscotch
        // dome covering half the hemisphere, so the shaded side of a boulder
        // picks up a substantial warm fill. This is the same mistake the crust
        // journey made with a strictly directional lamp and no ambient floor.
        rock: 0x6f3d26, dry: 0x93603c, ambient: 0x5d3a28, lightDir: SUN_DIR,
        offsetMeters: ({ u }) => [0.08, marsDrop(dAt(u)), -0.24],
        respectBand: false,
        opacity: ({ rebase }) => frames(rebase, 0.42, 6.0),
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
    // sub-pixel at any reasonable frame): a point of light is what the beat is
    // about, so it is a small, bright, near-camera glow placed through the
    // camera's own basis rather than at an authored world direction.
    L('earth-evening-star', walked(12), walked(95), () =>
      glowSphere({
        radiusMeters: ({ rebase }) => rebase.frameMeters() * 0.006,
        offsetMeters: ({ u }) => screenAnchoredMeters(u, { right: -1.05, up: -0.10, ahead: 3.4 }),
        color: 0xbcd4ff, haloColor: 0x6fa0e0, haloScale: 2.4,
        solid: true, solidColor: 0xdcecff, segments: 16, respectBand: false,
        opacity: ({ rebase }) => frames(rebase, 4, 200),
      })),
  ];
}
