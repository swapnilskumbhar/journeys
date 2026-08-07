import { AU, auTo, fromEarth } from './distance.js';
import { plin, plog, clamp01 } from './curve.js';

// THE PLAN. One module, imported by axis-def.js, beats.js, index.js AND
// layers.js, so that every number that has to agree is written down once.
//
// That is not tidiness. The single most expensive defect this project has
// recorded is "a layer's authored offset and the camera's authored aim were
// two independently-chosen numbers meant to coincide, and measured they were
// 70° apart" — which cost `earth-to-mars` its Sun and its whole Mars-as-a-
// point sequence. So the frame law, the aim point, the Sun's bearing and the
// beat marks all come out of this file, and nothing downstream re-derives
// them.
//
// ---------------------------------------------------------------------------
// TRAVEL RUNS ACROSS THE FRAME, ALONG +X.
//
// The first build of this journey put every body on the world Y axis, which is
// the same choice `earth-to-moon` had to undo: travel became a vertical stripe,
// the departed world sat under the copy panel, and no frame could hold both
// ends of the journey. Here the origin is the spacecraft, the Sun is behind at
// x = -d, and every body ahead is at x = (its own orbital radius - d). The
// camera sits on +z, so the axis of travel lies LEFT-TO-RIGHT across the frame,
// the same direction the ribbon runs (rule 5), and a single frame can hold the
// Sun shrinking at the left edge and the next world growing at the right.
//
// ---------------------------------------------------------------------------
// WHERE EACH BEAT IS REVIEWED.
//
// `shots.mjs` and `frame-check.mjs` both sample 45% of the way from a beat's
// own mark to the next beat's mark. So the beat sheet's midpoint sentence is a
// claim about ONE axis position, and that position is chosen here rather than
// discovered afterwards: each beat declares `at` (its honest mark), `star`
// (the distance its midpoint must land on) and `hold` (how far past that the
// composition stays put). axis-def.js turns those into three segments weighted
// 0.45 / 0.30 / 0.25, which puts the 45% sample exactly on `star` whatever the
// beat's total weight is.
//
// This is the encounter/departure split CLAUDE.md documents, generalised: the
// weight of the segments AFTER the sample point is the whole control over
// where the sample lands, and honest marks constrain where a beat SITS, never
// how much scroll it gets.

export const END_AU = 320000;

export const PLAN = [
  // heading                              at              star            hold             w
  ['The Grand Tour alignment',            1.0,            fromEarth(4e6), fromEarth(6e6),  1.15],
  ['Leaving Earth',                       fromEarth(8e6), fromEarth(1.4e7), fromEarth(2.2e7), 1.10],
  ['Into deep cruise',                    1.5,            1.95,           2.15,            1.00],
  ['The asteroid belt',                   2.7,            3.35,           3.55,            1.05],
  ['Approaching the giant',               4.5,            5.19945,        5.19965,         1.00],
  // The Jupiter encounter. Four beats inside 0.0008 AU, because that is what
  // "tight" has to mean here: the first build used 0.003 AU windows, which at
  // `frame = max(k·R, 1.25·|offset|)` is still ~100 planet-radii and renders
  // as a point. Real closest approach was 349,000 km — 5 Jupiter radii — and
  // the whole encounter took a few days, so beats this close together is the
  // honest geometry, not a compression of it.
  ['Jupiter: the Great Red Spot',         5.20005,        5.20012,        5.200175,        1.20],
  ["Io's volcanoes",                      5.20024,        5.20031,        5.200365,        1.10],
  ["Europa's cracked ice",                5.20042,        5.20049,        5.200545,        1.05],
  ['The gravity assist',                  5.20060,        5.20067,        5.200725,        1.15],
  ['Cruise to Saturn',                    7.5,            8.6,            9.1,             1.00],
  ['Saturn: the rings edge-on',           9.58,           9.58007,        9.580125,        1.15],
  ['The rings, lit',                      9.58018,        9.58025,        9.580305,        1.05],
  ["Titan's haze",                        9.58036,        9.58043,        9.580485,        1.00],
  ['Voyager 1 and 2 diverge',             9.70,           12.0,           13.5,            1.00],
  ['Uranus: tipped on its side',          19.20,          19.20007,       19.200125,       1.10],
  ['Neptune: the deepest blue',           30.10,          30.10007,       30.100125,       1.10],
  ["Triton's nitrogen geysers",           30.10024,       30.10031,       30.100365,       1.05],
  ["Pluto's distance, and the Kuiper belt", 39.50,        39.90,          40.10,           1.00],
  // The widest beat in the journey, and deliberately so: it is the emotional
  // centre and the one that must not be rushed.
  ['The Pale Blue Dot',                   40.50,          40.90,          41.60,           1.45],
  ['The heliopause',                      121,            124,            129,             1.20],
  ['The Golden Record',                   166,            168,            172,             1.15],
  ['The Sun as just another star',        268000,         280000,         300000,          1.20],
];

export const markAU = (i) => PLAN[i][1];
export const headings = PLAN.map((p) => p[0]);

// ---------------------------------------------------------------------------
// THE SCALE LAW.
//
// Authored directly, as a table in log10(d) — not derived from a two-body
// formula the way `earth-to-mars` can afford to be, because this journey
// passes nine bodies whose radii span 1.4e6 → 7e7 m and then dives to a
// 0.3 m gold disc. What makes an authored table safe here is the ONE
// discipline the first build got wrong: every entry is a PAIR bracketing a
// beat's own `star`…`hold` window, so the frame is FLAT across the stretch
// each beat is reviewed in and only ever moves in the gaps between beats.
// An anchor table that interpolates THROUGH a beat is the defect
// `journey-craft` warns about; one that holds across it is the fix
// CLAUDE.md asks for ("hold the frame across a beat, then move in the gap").
//
// The values are not guesses either. For a body of radius R drawn at the
// origin in a frame F metres wide, its diameter on a 1440-wide screen is
//
//     px ≈ 1330 · R / F                (55° vertical FOV, camera 6.2 units out)
//
// so every entry below is `F = 1330 · R / px` for the beat sheet's own
// intended px. Jupiter at 950 px is F = 9.8e7 m; Uranus at 400 px is 8.4e7.
const K = (au) => Math.log10(au * AU);

const FRAME = [
  // beat 1 — the whole Grand Tour as a plan: 35 AU across
  [K(1.0), 5.2e12], [K(fromEarth(6e6)), 5.2e12],
  // beat 2 — leaving Earth, and the frame has to make it LEAVE.
  //
  // This was two anchors both holding 1.5e7, which sounds like "hold the frame
  // across the beat" and is the right instinct everywhere else in this table.
  // Here it is wrong, because the subject is not at the origin: Earth sits at
  // its own true distance behind the ship, so a held frame with a receding
  // planet is the ONE case where holding does the job. The problem was what
  // came before it — the frame collapses from 5.2e12 to 1.5e7 across 6,000 km
  // of altitude, so Earth went from sub-pixel to filling the frame in a blink
  // and then barely shrank.
  //
  // Three anchors now, and the frame WIDENS across the beat, faster than the
  // ship recedes. Earth therefore gets smaller every frame, which is the only
  // thing "Leaving Earth" can possibly mean.
  [K(fromEarth(6.4e6)), 2.6e7],
  [K(fromEarth(1.4e7)), 4.4e7],
  [K(fromEarth(2.2e7)), 7.0e7],
  // beat 3 — deep cruise: nothing here is at true scale, so the frame is set
  // by keeping Mars' true offset (0.43 AU, behind) inside the frustum
  [K(1.85), 1.0e11], [K(2.15), 1.0e11],
  // beat 4 — the belt, at the scale of a single boulder a few km off
  [K(3.15), 1.2e4], [K(3.55), 1.2e4],
  // beat 5 — Jupiter at ~500 px, still 0.0006 AU short of the encounter
  [K(5.19935), 1.5e8], [K(5.19965), 1.5e8],
  // beat 6 — Jupiter at 950 px: two thirds of the frame
  [K(5.200105), 9.8e7], [K(5.200175), 9.8e7],
  // beat 7 — Io at 485 px. Jupiter is then 84 frame-widths away and subtends
  // its true 19° from Io's own orbit, which is where the huge curved band
  // across the top of the frame comes from — measured, not inflated.
  [K(5.200295), 5.0e6], [K(5.200365), 5.0e6],
  // beat 8 — Europa at 600 px, Jupiter a 215 px crescent behind
  [K(5.200475), 3.46e6], [K(5.200545), 3.46e6],
  // beat 9 — MUCH wider than the encounter beats, and the one place the beat
  // sheet's intended px is deliberately not met. This beat's subject is the
  // manoeuvre, not the planet, and the two cannot both be large: Voyager 1's
  // real closest approach was 4.9 Jupiter radii, so a hyperbola drawn at true
  // scale is ten planet-widths across. At the 1.33e8 frame the brief implies,
  // Jupiter was 630 px — a third portrait of the same banded disc — and every
  // part of the path that bends was outside the frustum. 5.0e8 puts Jupiter at
  // ~150 px and the whole flyby inside the frame, which is the only framing in
  // which a reader can see that the trajectory turns.
  [K(5.200655), 5.0e8], [K(5.200725), 5.0e8],
  // beat 10 — cruise: Saturn is a point 1 AU ahead and has to sit inside the
  // frame at its TRUE offset, so the frame is set by that offset, not by taste
  [K(8.2), 2.3e11], [K(9.1), 2.3e11],
  // beat 11 — Saturn at 620 px with the ring plane a razor line across 1440 px
  [K(9.580055), 1.25e8], [K(9.580125), 1.25e8],
  // beat 12 — the rings tilted into the light, 1300 px across
  [K(9.580235), 1.00e8], [K(9.580305), 1.00e8],
  // beat 13 — Titan at 560 px, Saturn a 98 px globe inside 231 px of ring
  [K(9.580415), 6.1e6], [K(9.580485), 6.1e6],
  // beat 14 — the two spacecraft part company
  [K(11.5), 3.0e9], [K(13.5), 3.0e9],
  // beat 15 — Uranus at 500 px, epsilon ring vertical across 1000 px
  [K(19.200055), 6.7e7], [K(19.200125), 6.7e7],
  // beat 16 — Neptune at ~550 px
  [K(30.100055), 5.0e7], [K(30.100125), 5.0e7],
  // beat 17 — Triton at 560 px, Neptune a 143 px crescent behind it
  [K(30.100295), 3.2e6], [K(30.100365), 3.2e6],
  // beat 18 — the Kuiper belt at the scale of a 20 km body
  [K(39.8), 3.0e5], [K(40.1), 3.0e5],
  // beat 19 — 0.05 AU: wide enough that Earth is honestly sub-pixel, which is
  // the only framing in which this photograph means what it means
  [K(40.8), 7.5e9], [K(41.6), 7.5e9],
  // beat 20 — the heliopause, ~10 AU of plasma boundary across the frame
  [K(123), 1.5e12], [K(129), 1.5e12],
  // beat 21 — a 30 cm gold disc at 700 px
  [K(167.5), 0.30], [K(172), 0.30],
  // beat 22 — four light-years: wide enough that the Sun cannot be told from
  // its neighbours, which is the entire content of the beat
  [K(270000), 4.0e16], [K(END_AU), 4.0e16],
];

export const frameAt = (d) => plog(FRAME, Math.log10(d));

// ---------------------------------------------------------------------------
// THE CAMERA.
//
// The aim point is in WORLD UNITS and is almost always near the origin, which
// is the spacecraft. That is not laziness: because the frame law above is
// sized to the subject, every subject is within a couple of units of the
// origin at the beat it belongs to, so aiming at the origin already puts it
// on the boresight — and its screen position then comes for free from its own
// TRUE offset rather than from a second authored number that has to agree with
// the first. The handful of nonzero entries are compositional nudges (Earth
// pulled in from behind, Jupiter's limb pushed to a corner), never a search
// for a subject.
const LOOK_X = [
  [K(1.0), 1.1], [K(fromEarth(6e6)), 1.1],        // the planet chain, right of the Sun
  [K(fromEarth(1.15e7)), -1.5], [K(fromEarth(2.2e7)), -1.5],  // Earth, behind and left
  [K(1.3), -0.3], [K(2.15), -0.3],                // Mars, behind and left
  [K(3.15), 0], [K(3.55), 0],
  [K(5.19935), 1.25], [K(5.19965), 1.25],         // Jupiter growing right of centre
  [K(5.200105), 0.3], [K(5.200175), 0.3],
  [K(5.200295), 0], [K(5.200545), 0],
  // Jupiter is BEHIND by the assist beat (heliocentric range has already
  // passed 5.20), so it can only sit to the left of the aim point — aiming
  // right, as the first pass did, pushed it off the frame entirely. Aiming
  // left brings the limb back in, and LOOK_Y lifts it clear of the copy panel.
  [K(5.200655), 0.6], [K(5.200725), 0.6],
  [K(8.2), 0.9], [K(9.1), 0.9],                   // Saturn, a point ahead at frame right
  [K(9.580055), 0.35], [K(9.580305), 0.45],
  [K(9.580415), 0], [K(9.580485), 0],
  [K(11.5), 0.3], [K(13.5), 0.3],
  [K(19.200055), 0.25], [K(19.200125), 0.25],
  [K(30.100055), 0.25], [K(30.100125), 0.25],
  [K(30.100295), 0], [K(30.100365), 0],
  [K(39.8), 0], [K(41.6), 0],
  [K(123), 0], [K(END_AU), 0],
];

// Vertical aim. Aiming DOWN (negative) lifts the subject in frame, which is
// how the beats whose subject would otherwise sit under the copy panel are
// rescued without widening the frame — widening would cost the composition
// everywhere else.
const LOOK_Y = [
  [K(1.0), 0.15], [K(fromEarth(6e6)), 0.15],
  [K(fromEarth(1.15e7)), -0.45], [K(fromEarth(2.2e7)), -0.45],
  [K(1.85), 0.1], [K(2.15), 0.1],
  [K(3.15), -0.10], [K(3.55), -0.10],            // over the top of the boulder field
  [K(5.19935), 0], [K(5.200545), 0],
  [K(5.200655), -0.15], [K(5.200725), -0.15],    // the flyby lifted off the copy panel
  [K(8.2), 0], [K(9.580125), 0],
  [K(9.580235), -0.35], [K(9.580305), -0.35],    // the ring plane lifted off the panel
  [K(9.580415), 0], [K(30.100365), 0],
  [K(39.8), 0.2], [K(40.1), 0.2],
  [K(40.8), -0.15], [K(41.6), -0.15],
  [K(123), 0], [K(END_AU), 0],
];

// Bearing onto the travel axis. 0 is fully side-on, which flattens depth; a
// negative angle swings the camera to -x so the direction of travel runs into
// the frame toward the right — a three-quarter view, per `journey-craft`.
// It also sweeps the galactic band across the frame, which is the cheapest
// source of change there is out here.
const AZIMUTH = [
  [K(1.0), -26], [K(fromEarth(6e6)), -26],
  [K(fromEarth(1.4e7)), -18],
  [K(1.95), -12], [K(3.35), -22],
  [K(5.19945), -16], [K(5.20012), -10],
  [K(5.20031), 8], [K(5.20049), 18],
  [K(5.20067), -14],
  [K(8.6), -32], [K(9.58007), -20],
  [K(9.58025), -14], [K(9.58043), 12],
  [K(12.0), -28], [K(19.20007), -18],
  [K(30.10007), 16], [K(30.10031), 24],
  [K(39.9), -20], [K(40.9), -34],
  [K(124), 10], [K(168), 26], [K(END_AU), -8],
];

// Pushes the subject clear of the copy panel, which owns the lower left.
const PAN = [
  [K(1.0), 0.7], [K(fromEarth(2.2e7)), 0.9],
  [K(2.15), 0.8], [K(3.55), 0.5],
  [K(5.19965), 0.7], [K(5.200175), 0.8],
  [K(5.200365), 0.6], [K(5.200545), 0.6],
  [K(5.200725), 0.4],
  [K(9.1), 0.9], [K(9.580125), 0.8], [K(9.580485), 0.6],
  [K(13.5), 0.8], [K(19.200125), 0.9], [K(30.100125), 0.9],
  [K(30.100365), 0.5], [K(40.1), 0.4], [K(41.6), 0.6],
  [K(129), 0.4], [K(172), 0.5], [K(END_AU), 0.3],
];

export const lookXAt = (d) => plin(LOOK_X, Math.log10(d));
export const lookYAt = (d) => plin(LOOK_Y, Math.log10(d));
export const azimuthAt = (d) => plin(AZIMUTH, Math.log10(d));
export const panAt = (d) => plin(PAN, Math.log10(d));

// ---------------------------------------------------------------------------
// THE SUN — the one subject that is on screen for the whole journey.
//
// SIZE AND BRIGHTNESS ARE PHYSICAL; ONLY THE BEARING IS AUTHORED. Real
// inverse-square flux drives how bright the Sun is drawn and, through the
// square root of it, how wide its glare is — 220 px at Earth, 61 at Saturn,
// 24 at Pluto's distance, and a floored 4 px in the closing frame. That is a
// continuous, measurable shrink the reader watches happen across 5.4 decades
// of axis, and it is what carries continuity now that the probe no longer
// does.
//
// The bearing has to be authored because the honest one is useless: the Sun is
// at heliocentric range 0 and everything ahead is at +x, so at 8 AU the Sun's
// true position is 8,000 frame-widths off to the left. Every journey in this
// project has one placement of this kind (`earth-to-moon`'s Earthrise is the
// other), and the carve-out is the same: a body whose true position is
// unrenderable is placed compositionally and drawn at a size that is still
// derived from the real quantity the beat is about.
//
// The blend below is what keeps that honest at the one beat where the true
// position IS renderable — the opening Grand Tour plan, where the Sun sits at
// the centre of the planetary system 35 AU wide. Under about 1.2 units of true
// offset the Sun is drawn where it actually is; past 2.4 units it slides to
// the authored bearing, continuously.
const SUN_BEARING = [-2.45, 0.55, 1.05]; // world units, before azimuth

const rotY = ([x, y, z], deg) => {
  const a = (deg * Math.PI) / 180;
  return [x * Math.cos(a) + z * Math.sin(a), y, z * Math.cos(a) - x * Math.sin(a)];
};

// ---------------------------------------------------------------------------
// THE ESCORT: where to put a thing so it holds one place on the SCREEN.
//
// The journey is named after a spacecraft and, measured on the contact sheet,
// contained one in 5 of its 22 beats. Every appearance was its own layer with
// its own opacity window, so the craft blinked in and out and was drawn at a
// different size and a different corner each time — there was nothing for a
// reader to track, and the gaps between windows were most of the journey.
//
// The fix is one continuous presence, and the hard part is that a FIXED WORLD
// POSITION will not hold a fixed screen position here: `azimuthAt` swings the
// camera through 44° across the journey, so an authored world offset slides
// right across the frame and out of it. This repo has already paid for the
// general version of that mistake — an offset direction and a camera aim that
// are two independently-chosen numbers meant to coincide, measured 70° apart.
//
// So the position is DERIVED FROM THE CAMERA, by reconstructing the exact
// basis `aimCamera` builds from the same four tables `index.js` feeds it. One
// formula, not two that have to agree. `right`, `up` and `ahead` are then
// camera-space frame units and mean precisely what they say: `ahead` is how
// far in front of the lens, and the other two are where in the frame.
export function screenAnchoredMeters(d, frameM, { right = 0, up = 0, ahead = 3.1 } = {}) {
  const unit = frameM / 4;

  // Exactly `aimCamera`'s construction, for pos = [0, 0, 6.2].
  const a = (azimuthAt(d) * Math.PI) / 180;
  const P = [6.2 * Math.sin(a), 0, 6.2 * Math.cos(a)];
  const L = [lookXAt(d), lookYAt(d), 0];

  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const cross = (p, q) => [
    p[1] * q[2] - p[2] * q[1],
    p[2] * q[0] - p[0] * q[2],
    p[0] * q[1] - p[1] * q[0],
  ];
  const norm = (p) => {
    const n = Math.hypot(...p) || 1;
    return [p[0] / n, p[1] / n, p[2] / n];
  };

  // Three's camera looks down its own -Z, so F is the view direction and the
  // local right/up follow from it and the world up.
  const F = norm(sub(L, P));
  const R = norm(cross(F, [0, 1, 0]));
  const U = cross(R, F);

  // `pan` slides the camera along its own X (see aimCamera's translateX), and
  // the escort has to slide with it or it drifts whenever a beat pushes its
  // subject clear of the copy panel.
  const pan = panAt(d);

  return [0, 1, 2].map((i) =>
    (P[i] - pan * R[i] + R[i] * right + U[i] * up + F[i] * ahead) * unit,
  );
}

// ---------------------------------------------------------------------------
// THE SEPARATION FORMATION.
//
// Two objects that have just come apart are ONE event, and staging them as two
// independent placements is what made the departure read as two stickers hung
// on the frame. The spent stage sat at a fixed screen position, the spacecraft
// sat at a different fixed screen position, and neither moved relative to the
// other — so nothing said they had ever been attached, nothing said they shared
// a velocity, and nothing said which way either of them was going.
//
// This returns BOTH positions from one derivation:
//
//   · one CENTROID, screen-anchored so the composition stays where it was
//     composed while the camera swings,
//   · one TANGENT — the escape direction, taken from `departure-path`'s own
//     formula rather than authored again, so the pair cannot drift off the
//     line the journey draws for them,
//   · one GAP that starts at zero and grows, splitting them along that tangent.
//
// At h = 0 they are coincident, which is what "still attached" means. By the
// end of the beat Voyager leads and the stage trails, both on the same line,
// both travelling the same way. That is the entire fix: the relationship is
// computed once and the two bodies are read off it.
//
// `DEPARTURE_TANGENT` is `departure-path`'s own direction, normalised. The path
// is `s -> [m - 2.0e7, m * 0.10, -m * 0.22]`, so its tangent is [1, 0.10, -0.22]
// before normalising. Written here so the layer and the path share one vector.
// The escape path's own shape, in ONE place. `departure-path` draws it and the
// separation formation travels along it, and before this they were two
// independent copies of the same three numbers — which is how the journey ended
// up with a trajectory line drawn across empty space while the spacecraft flew
// somewhere else entirely.
export const DEPARTURE_SPAN = 2.6e8;
export const departurePathAt = (s) => {
  const m = s * DEPARTURE_SPAN;
  return [m - 2.0e7, m * 0.10, -m * 0.22];
};
export const departureProgress = (d) => (d - AU + 2.0e7) / DEPARTURE_SPAN;

const DEPARTURE_TANGENT = (() => {
  const v = [1, 0.10, -0.22];
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
})();

// Altitudes, in metres above Earth, over which the pair comes apart. Separation
// really happened within minutes of the propulsion module burning out; on this
// axis that is the stretch beat 2 covers.
const SEP_FROM = 4.0e6;
const SEP_TO = 2.2e7;

/**
 * Where the spent stage and the spacecraft are during the departure.
 *
 * @returns {{stage:number[], probe:number[], tangent:number[], progress:number}}
 *   positions in METRES, the shared escape direction, and 0→1 through the
 *   separation — which callers use to drive the stage's tumble and the fade
 *   back to ordinary escort placement.
 */
// 0 while still mated, 1 once fully apart. Exported on its own because the
// archetypes' `attitude` callback is handed `{u, local, t}` and no `rebase` —
// it cannot ask for the frame width, and the tumble does not need it.
export const separationProgress = (d) => clamp01((d - AU - SEP_FROM) / (SEP_TO - SEP_FROM));

export function separationFormation(d, frameM, { right = 1.30, up = -0.18, ahead = 3.3 } = {}) {
  const unit = frameM / 4;
  const p = separationProgress(d);

  const C = screenAnchoredMeters(d, frameM, { right, up, ahead });
  const T = DEPARTURE_TANGENT;

  // The gap, in frame units, eased so the two do not spring apart on the first
  // frame they are both visible. A real separation is a spring push measured in
  // centimetres per second; what sells it is that it STARTS AT NOTHING.
  const gap = 1.15 * unit * (p * p * (3 - 2 * p));

  // A slight lateral drift on the stage, so the two do not stay on one line and
  // become a single silhouette from the camera's angle. Peaks mid-separation
  // and settles, which is what a spring push with a residual tumble looks like.
  const drift = 0.20 * unit * Math.sin(Math.PI * p);

  return {
    // Voyager LEADS along the escape direction; the stage TRAILS.
    probe: [0, 1, 2].map((i) => C[i] + T[i] * gap * 0.42),
    stage: [0, 1, 2].map((i) => C[i] - T[i] * gap * 0.58 + (i === 1 ? drift : 0)),
    tangent: T,
    progress: p,
  };
}

/**
 * WHERE VOYAGER IS. The single answer, used by everything that needs to know.
 *
 * The escort layer draws the craft here, and `departure-path` is translated so
 * that its own progress point lands on this exact position — which is what puts
 * the spacecraft ON its trajectory instead of beside it. Before this the line
 * was drawn in world space from Earth while the craft was placed by screen
 * anchoring, so the two had no reason to meet and did not: the path went one
 * way, Voyager went another, and the spent stage went a third.
 *
 * During the separation it is the leading half of the formation; afterwards it
 * eases to the cruise corner. One function, so nothing can disagree with it.
 */
export function voyagerPositionMeters(d, frameM) {
  const home = screenAnchoredMeters(d, frameM, { right: 1.55, up: -0.62, ahead: 3.1 });
  const sep = separationFormation(d, frameM);
  if (sep.progress >= 1) return home;
  const p = sep.progress;
  const k = p * p * (3 - 2 * p);
  return [0, 1, 2].map((i) => sep.probe[i] * (1 - k) + home[i] * k);
}

/**
 * How far to translate the departure path so it runs THROUGH the spacecraft.
 *
 * `trajectory` builds its geometry once and only translates it, so the path
 * cannot be re-shaped per frame — but it can be moved, and moving it so that
 * `path(progress)` coincides with the craft is enough. The line then emerges
 * from behind the spacecraft, passes through it, and continues ahead along the
 * same tangent the separation splits along.
 */
export function departurePathOffsetMeters(d, frameM) {
  const here = voyagerPositionMeters(d, frameM);
  const on = departurePathAt(departureProgress(d));
  return [0, 1, 2].map((i) => here[i] - on[i]);
}

// Glare radius as a fraction of the frame. `radius × haloScale` is the sprite,
// and the halo texture's readable core is about 40% of it, so the drawn glare
// is roughly `2130 × s` pixels at 1440 wide.
export const sunGlare = (d) => Math.max(0.0019, 0.125 * (d / AU) ** -0.6);

// Real flux relative to Earth's, clamped at the floor so the opening beat does
// not blow out.
export const sunFlux = (d) => 1 / Math.max(1, d / AU) ** 2;

export function sunOffsetMeters(d, frameM) {
  const unit = frameM / 4;
  const trueUnits = -d / unit;                  // always behind, along -x
  const k = clamp01((Math.abs(trueUnits) - 1.2) / 1.2);
  const authored = rotY(SUN_BEARING, azimuthAt(d));
  return [
    (trueUnits + (authored[0] - trueUnits) * k) * unit,
    authored[1] * k * unit,
    authored[2] * k * unit,
  ];
}

// The direction sunlight arrives FROM, in world space — the normalised
// authored bearing. Every planet, moon, boulder and spacecraft in the journey
// is lit with this one vector, because two bodies with different terminator
// angles read as a collage rather than as a system. Its +z term is
// load-bearing: the camera sits on +z, so a light with no z lights the
// hemisphere nobody can see, which is how `earth-to-moon` spent nine beats
// rendering a dark ball with a bright rim.
const L = Math.hypot(...SUN_BEARING);
export const LIGHT_DIR = SUN_BEARING.map((v) => v / L);
