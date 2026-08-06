import { makeAxis } from '../../engine/axis.js';
import { axisDef } from './axis-def.js';
import { R_EARTH, R_MARS, MARS_D, AU, MARS_AU, walked } from './distance.js';
import { plog, plin, clamp01 } from './curve.js';

// THE PLAN. One module, imported by index.js AND layers.js, so that every
// number that has to agree is written down once.
//
// This journey shipped with eleven consecutive near-black cruise frames, and
// every one of them was the same defect in a different costume: a subject
// placed at an authored world direction, and a camera aimed at a second,
// independently-authored direction that was supposed to coincide with it. The
// Sun sat at `[f*0.85, 0, -f*2.08]` while `LOOK_X` was held at 2.6. Mars sat at
// its true offset — thirty million kilometres ahead — while the frame was a
// hundred thousand metres wide. The spacecraft sat at exactly `[0,0,0]` while
// the camera looked somewhere else entirely.
//
// So the fix is structural rather than a tuning pass: the frame law, the aim
// point, the two planets' positions and the screen anchor for everything that
// has no renderable true position all come out of THIS file, and each of them
// is derived from the others rather than authored twice.
//
// ---------------------------------------------------------------------------
// TRAVEL RUNS ACROSS THE FRAME.
//
// The world axis is +y — Earth's centre below the ship, Mars' centre above it —
// because during the ascent and the descent "down" is not arbitrary: the ground
// really is at -y. `earth-to-moon` proved that re-authoring every offset onto
// another axis breaks those two phases, and that the cheap correct fix is to
// ROLL THE CAMERA. `ROLL` below swings to 90° once the stack is out of Earth's
// gravity well and back to 0 as Mars' limb fills the frame, so for the whole
// interplanetary stretch the departed world is at frame LEFT, the destination
// at frame RIGHT, and the trajectory runs horizontally the same direction the
// ribbon does (rule 5). No object moves; only the camera turns.

const A = makeAxis(axisDef);
export const uAt = (m) => A.toU(m);
export const dAt = (u) => A.toValue(u);
export const mid = (a, b, f) => uAt(a) + f * (uAt(b) - uAt(a));

// ---------------------------------------------------------------------------
// WHERE THE TWO WORLDS ARE, in metres along +y, at axis value d.
//
// ALTITUDE OR CENTRE DISTANCE — the question CLAUDE.md says to ask before
// placing a body, and this journey had it wrong for Mars. `MARS_D` is the
// distance to Mars' SURFACE (the axis ends when the lander is standing on it),
// so the planet's CENTRE is one Martian radius further on. The old expression
// `MARS_D - R_MARS - d` put the centre a radius SHORT, which means the surface
// arrived 2 × 3,390 km early and, for the whole of the final approach, the
// number the ribbon printed and the number the layer used disagreed.
export const earthCentre = (d) => -(R_EARTH + d);
export const marsCentre = (d) => (MARS_D - d) + R_MARS;
export const marsAlt = (d) => MARS_D - d;

// ---------------------------------------------------------------------------
// THE SCALE LAW.
//
// `frame = 0.6 × (distance to the centre of the nearer world)` is the same law
// `earth-to-moon` derives and the same one `earth-to-mars` claimed to use. It
// is a property of "origin at the spacecraft, camera 6.2 units out", not of any
// particular pair of bodies: at that ratio the near world sits about 6.7 units
// off the origin, the camera turns to face it, and its drawn diameter is
//
//     px ≈ 7500 · R / sqrt(16 c² + 38.4 F²)      (900-tall frame, 55° vertical)
//
// which for F = 0.6c is 1370 · R / c. That single expression is what makes
// "Earth shrinking behind" and "a point of light → a disc → ochre and a white
// cap → Olympus Mons" possible AT ALL: the four approach beats were previously
// four identical black rectangles because the frame was pinned at 4.2e5 m while
// Mars' centre was 2e8 m away, five hundred frame-widths off the boresight.
//
// The table is authored rather than evaluated as a formula for one reason: the
// pad, the entry corridor and the surface are terrain-scale frames that have
// nothing to do with either planet's centre, and blending a formula into a
// table at both ends is more moving parts than writing the formula's own values
// down at the points where it applies. Every entry between 2.2e5 and MARS_D -
// 1.5e6 IS 0.6 × the nearer centre distance, evaluated. Nothing downstream
// re-derives the law — `earthUnits` and `marsUnits` below read this table.
const FRAME = [
  // --- the pad and the ascent ---------------------------------------------
  [uAt(1), 140],
  [mid(1, 4, 0.6), 140],
  [uAt(4), 160],
  [mid(4, 130, 0.5), 230],
  [uAt(130), 460],
  [uAt(1.4e4), 5.2e4],
  [uAt(6.5e4), 2.6e5],
  [mid(6.5e4, 9.5e4, 0.65), 2.9e5],
  [uAt(9.5e4), 5.0e5],
  [uAt(2.0e5), 3.8e6],
  [mid(2.0e5, 2.05e5, 0.7), 3.85e6],

  // --- the departure: 0.6 × (R_EARTH + d) ---------------------------------
  // Earth therefore holds a constant 6.7 units off the origin and SHRINKS every
  // frame, because its drawn radius is 6.67 R/c. That is the only thing "Earth
  // shrinking behind" can mean, and the old table — which widened the frame at
  // roughly the rate Earth receded — cancelled it exactly.
  [uAt(2.2e5), 3.95e6],
  [uAt(1.0e6), 4.42e6],
  [uAt(3.0e6), 5.62e6],
  [uAt(1.0e7), 9.82e6],
  [uAt(3.0e7), 2.18e7],
  [uAt(1.0e8), 6.38e7],
  [uAt(3.0e8), 1.84e8],
  [uAt(1.0e9), 6.04e8],

  // --- the cruise ----------------------------------------------------------
  // No body is near, so the law has nothing to size itself against and the
  // frame is set by the two orbital rings instead — Earth's at 1.496e11 m and
  // Mars' at 2.279e11 m have to sit at a legible few units of radius on the
  // beats that cross them.
  [uAt(3.0e9), 1.6e9],
  [uAt(1.0e10), 4.0e9],
  [uAt(3.0e10), 1.1e10],

  // --- THE PLAN, DRAWN AT THE SIZE THE PLAN ACTUALLY IS -------------------
  //
  // The cruise frame used to top out at 7.6e10 m — half of one AU — so the two
  // orbital rings were each many frame-widths across and the transfer arc was a
  // line crossing the picture. Nothing was wrong with any individual frame; what
  // was missing was the ONE frame that says what the mission is. A reader put it
  // plainly: "we have not shown the entire path of the mission."
  //
  // 5.6e11 m is 3.7 AU, which puts Mars' orbit at 1.63 units of radius and
  // Earth's at 1.07 against a camera standing 5–7 units out. The Sun, both
  // orbits, the flown arc and the arc still to fly are all in the frame
  // together, with the spacecraft at the origin ON the line — and it costs
  // nothing anywhere else, because every other cruise layer is sized as a
  // fraction of the frame and therefore holds its apparent size exactly.
  //
  // It is held across beats 13–16 rather than spiked on one of them: those four
  // beats ARE the plan — crossing Earth's orbit, unfolding, correcting, crossing
  // Mars' orbit — and a nine-fold zoom in and back out inside one beat is a
  // camera move nobody asked for.
  [uAt(7.0e10), 1.6e11],
  [uAt(1.1e11), 5.6e11],
  [uAt(2.2e11), 5.6e11],
  [uAt(3.6e11), 5.6e11],
  [uAt(5.0e11), 5.6e11],
  [uAt(5.35e11), 9.0e10],

  // --- the approach: 0.6 × marsCentre --------------------------------------
  // Evaluated at each beat's own mark. The measured drawn diameter of Mars at
  // the four beat MIDPOINTS — which is where every review samples — is
  // 15 px → 133 px → 404 px → 738 px.
  [uAt(MARS_D - 5.97e8), 3.60e8],
  [uAt(MARS_D - 5.46e7), 3.50e7],
  [uAt(MARS_D - 1.016e7), 8.10e6],
  [uAt(MARS_D - 5.79e6), 5.50e6],
  [uAt(MARS_D - 1.5e6), 2.90e6],
  [uAt(MARS_D - 6.0e5), 1.00e6],

  // --- entry, descent, landing ---------------------------------------------
  [uAt(MARS_D - 1.25e5), 3.0e5],
  [uAt(MARS_D - 6.0e4), 6.0e4],
  [uAt(MARS_D - 1.1e4), 9.0e3],
  [uAt(MARS_D - 2.0e3), 3.0e3],
  [uAt(MARS_D - 1.4e3), 7.0e2],
  [uAt(MARS_D), 45],
  [mid(MARS_D, walked(9), 0.6), 42],
  [uAt(walked(9)), 1.4],
  [mid(walked(9), walked(55), 0.65), 1.4],
  [uAt(walked(55)), 16],
  [1, 17],
];

export const frameAt = (u) => plog(FRAME, u);

// Where each world sits, in WORLD UNITS, this frame. These are the numbers the
// camera aims with and the numbers the layers are placed at — one derivation,
// so a body cannot be off the boresight the camera chose.
export const earthUnits = (u) => (4 * earthCentre(dAt(u))) / frameAt(u);
export const marsUnits = (u) => (4 * marsCentre(dAt(u))) / frameAt(u);

// ---------------------------------------------------------------------------
// THE CAMERA.
//
// `LOOK_Y` is NOT authored. It is a weighted blend of the two worlds' own
// positions, so the aim point is a function of where the bodies actually are
// rather than a second table that has to track them. `EARTH_AIM` and
// `MARS_AIM` say only how much of the frame each world is entitled to:
// 1 puts it dead centre, 0.55 pushes it about 40% of the way to the frame
// edge, 0 ignores it.
//
// AIMING AT A PLANET'S CENTRE FROM TWO HUNDRED KILOMETRES UP IS AIMING AT NADIR.
// This table used to hold 0.95 across the parking orbit and TMI, and under the
// journey's own scale law (`frame = 0.6 × the distance to Earth's centre`) that
// puts Earth's centre at a constant -6.67 units — so 0.95 aimed the camera 6.3
// units straight down, into a planet whose near limb is 0.2 units below the
// origin. Two things followed, and both were shipped:
//
//   * the frame was wall-to-wall lit surface with no limb, no terminator and no
//     sky in it, which is what "soft watercolour blobs" actually was — not a
//     shortfall of surface detail but a picture with no edge anywhere in it;
//   * MEASURED, the origin — where the launch stack and its payload are — sat
//     39.7° off the boresight at beat 8's midpoint and 43.1° at beat 9's,
//     outside a 55° frustum entirely. Beat 9 is "Trans-Mars injection", the
//     single burn the whole rest of the journey is bought with, and it rendered
//     as a soft planet and nothing else: no stage, no payload, no plume. The
//     gate could not see it, because Earth filled the frame and occupancy only
//     asks whether pixels are lit.
//
// The weights below hold the aim between Earth's near limb and its centre
// instead, which keeps the origin inside ~18° for every departure beat and puts
// a curved, terminated limb across the lower frame with the vehicle above it.
// They rise as Earth shrinks, so that once the planet is a small disc the camera
// is genuinely pointing at it again.
const EARTH_AIM = [
  [uAt(1), 0],
  [uAt(1.9e5), 0],
  [uAt(2.05e5), 0.36],      // parking orbit: "Earth fills most of the lower frame"
  [uAt(2.2e5), 0.26],
  [uAt(1.0e6), 0.32],       // TMI — the stack has to be in this picture
  [uAt(3.0e6), 0.45],
  [uAt(1.0e7), 0.62],
  [uAt(1.0e8), 0.62],       // beat 10, Earth receding at frame left
  [uAt(1.0e9), 0.45],
  [uAt(1.0e10), 0.30],
  [uAt(3.0e10), 0.16],
  [uAt(1.5e11), 0],
  [1, 0],
];

// MARS IS NOT CENTRED, and that is the whole composition of the approach.
//
// Weighting the aim at ~0.5 of Mars' own offset holds the planet about 20° off
// the boresight for every one of beats 17–20 — which, under the 90° roll, is
// just over half the way to the frame RIGHT edge. So Mars grows ACROSS the
// frame from the side the ship is travelling toward, instead of swelling
// straight into the middle of it, and the aim stays shallow enough that the
// galactic band is still in the picture behind it. Pointing the camera along
// the direction of travel is the single most effective way to make a journey
// boring; this is the same subject at the same size without doing that.
const MARS_AIM = [
  [uAt(1), 0],
  [uAt(3.6e11), 0],
  [uAt(5.0e11), 0.10],
  [uAt(5.24e11), 0.12],                 // beat 16: Mars is still a placed point
  [uAt(MARS_D - 5.97e8), 0.45],
  [uAt(MARS_D - 3.9e8), 0.47],          // beat 17
  [uAt(MARS_D - 1.016e7), 0.47],        // beats 18–19
  [uAt(MARS_D - 3.2e6), 0.52],          // beat 20
  [uAt(MARS_D - 6.0e5), 0.25],          // the terrain layers take over
  [uAt(MARS_D - 1.25e5), 0],
  [1, 0],
];

// Authored aim, for the phases where neither planet's centre is the subject —
// the pad, the ascent, the descent corridor and the surface.
const LOOK_LOCAL = [
  // THE STACK NOW STANDS ON THE DECK RATHER THAN THROUGH IT (see `stackRise`
  // in layers.js), so the pad beats have a hundred and thirty metres of vehicle
  // above the ground instead of fifty. The aim goes up with it: 1.7 units is
  // 60 m at a 140 m frame, which is the middle of the stack, and the horizon
  // still sits comfortably inside the lower half of the picture.
  [uAt(1), 1.70],
  [uAt(4), 1.60],
  [uAt(130), 0.55],
  [uAt(1.4e4), 0.10],
  [uAt(6.5e4), 0.05],
  [uAt(9.5e4), 0.10],
  // THE CRUISE GETS A PER-BEAT VERTICAL AIM OFFSET, and it is doing a specific
  // job. With the rust wash gone, the only large-area content out here is the
  // galactic band, the starfield, the transfer arc and the two orbital rings —
  // all of which sit at TRUE world positions, so the way to move them across
  // the frame is to move the boresight. Swinging the aim ±1.6 units on each
  // cruise beat's own midpoint slides the band, the arc and the rings bodily
  // between one beat and the next, while the screen-anchored hero and Sun do
  // not move at all, because `screenAnchoredMeters` rebuilds this same basis.
  // That is real parallax against real objects; it is what has to carry
  // `adjacent` now that a global tint is not allowed to.
  [uAt(1.0e9), 0],
  [uAt(4.6e9), 2.55],
  [uAt(5.9e10), -2.60],
  [uAt(1.78e11), 2.70],
  [uAt(2.72e11), -2.65],
  [uAt(4.16e11), 2.60],
  [uAt(5.0e11), 0],
  // NOTE, so the next pass does not spend a round on it: beats 17 and 18 stay
  // ~3.6–4.0 adjacent whatever the camera does. Swinging the aim ±1.3 units
  // here, and widening the standoff swing to 7.6/5.0, both measured WORSE
  // (3.9 → 3.6). The frames are ~90% black with one small craft and a growing
  // dot, and rotating black is black. This is a beat-SELECTION problem — "a
  // point of light" and "a disc" are two captions over one approach — and the
  // honest fix is to merge them, which is a design decision and not a tuning
  // one.
  [uAt(MARS_D - 1.25e5), -0.20],
  [uAt(MARS_D - 6.0e4), -0.22],
  [uAt(MARS_D - 1.1e4), -0.20],
  [uAt(MARS_D - 2.0e3), -0.15],
  [uAt(MARS_D - 1.4e3), -0.12],
  [uAt(MARS_D), -0.10],
  [uAt(walked(9)), -1.6],
  [uAt(walked(55)), 0.30],
  [1, 0.30],
];

// A world 30 units off the origin cannot be brought on screen by aiming at it —
// the frustum would have to be pointed so far off the travel axis that nothing
// else in the journey is in it. Past this the body is a POINT and is placed
// compositionally instead (see `pointPositionMeters`).
const AIM_LIMIT = 8;

export function lookAtUnits(u) {
  const e = plin(EARTH_AIM, u) * earthUnits(u);
  const m = plin(MARS_AIM, u) * marsUnits(u);
  const local = plin(LOOK_LOCAL, u);
  const y = e + m;
  return [0, Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, y)) + local, 0];
}

// Camera height and standoff, in units (units scale with the frame).
const CAM = [
  [uAt(1), [0, 0.95, 6.2]],
  [uAt(130), [0, 0.50, 6.0]],
  [uAt(1.4e4), [0, 0.25, 6.0]],
  [uAt(6.5e4), [0, 0.30, 6.1]],
  // Beats 6 and 7 are both "the vehicle over a lit limb, stars above", and they
  // measured 3.6 and 4.6 adjacent. Height and standoff are the two levers that
  // change how much planet is in the picture without moving the aim off the
  // vehicle, so they alternate here for the same reason they do in the cruise.
  [uAt(1.33e5), [0, 1.45, 5.5]],
  [uAt(2.02e5), [0, -1.05, 7.0]],
  [uAt(2.12e5), [0, 0.55, 6.2]],
  [uAt(1.0e7), [0, 0.15, 6.3]],
  // The cruise standoff and height alternate on the same beat midpoints the
  // bearing does. Height is the second large-area lever: the camera sits off
  // the travel axis, so raising and lowering it slides the whole starfield and
  // both orbital rings across the frame while the anchored hero does not move.
  [uAt(4.6e9), [0, 1.85, 7.3]],
  [uAt(5.9e10), [0, -1.70, 5.2]],
  [uAt(1.78e11), [0, 1.90, 7.4]],
  [uAt(2.72e11), [0, -1.75, 5.2]],
  [uAt(4.16e11), [0, 1.80, 7.2]],
  [uAt(5.24e11), [0, -1.60, 5.4]],
  [uAt(MARS_D - 3.9e8), [0, 2.20, 6.5]],
  [uAt(MARS_D - 3.5e7), [0, -2.00, 6.0]],
  [uAt(MARS_D - 8.2e6), [0, 1.35, 6.2]],
  [uAt(MARS_D - 3.2e6), [0, -1.10, 6.1]],
  [uAt(MARS_D - 1.25e5), [0, 0.3, 6.0]],
  [uAt(MARS_D - 9.6e4), [0, 1.05, 6.7]],
  [uAt(MARS_D - 3.8e4), [0, 0.10, 5.3]],
  [uAt(MARS_D - 6.9e3), [0, 1.15, 6.8]],
  [uAt(MARS_D - 1.73e3), [0, 0.20, 5.4]],
  [uAt(MARS_D - 770), [0, 1.10, 6.6]],
  [uAt(MARS_D), [0, 1.3, 6.0]],
  [uAt(walked(9)), [0, 1.2, 5.4]],
  [uAt(walked(55)), [0, 0.11, 6.0]],
  [1, [0, 0.11, 6.0]],
];

// Bearing onto the travel axis. Never zero for long: a three-quarter view keeps
// depth in the frame, and swinging it is the cheapest source of change there is
// out here. The swing through the parking orbit is load-bearing — beats 7, 8
// and 9 measured 0.4 and 4.7 adjacent distance, three captions over one picture
// of the same lit limb, and turning the camera 30° between them is what makes
// them three shots.
const AZIMUTH = [
  [uAt(1), -22],
  [uAt(130), -14],
  [uAt(1.4e4), -8],
  [uAt(6.5e4), -4],
  [uAt(7.7e4), 14],
  // Anchored on beats 6–9's own MIDPOINTS and alternating hard, for the same
  // reason the cruise entries below are. These four beats are all "Earth's lit
  // limb, a starfield and the stack", and swinging the bearing turns the planet
  // under the camera so the terminator, the coastlines and the city lights are
  // somewhere different in each of them.
  [uAt(1.33e5), -62],
  // BEAT 8 IS CALLED "ONE QUIET ORBIT" AND IT SAYS "on the night side, city
  // lights mark out coastlines the day side had hidden in the glare." The
  // bearing is what decides which side of the planet the camera is over, and
  // this table used to hold it within ±25° of the sunward side for all three
  // orbital beats — so all three were the same lit limb, they measured 3.1 and
  // 4.5 adjacent against a 6.0 bar, and the one beat whose whole subject is the
  // night side never went there. It now genuinely circles: 30° over the day
  // side at beat 7, 150° over the terminator and the dark hemisphere at beat 8,
  // 300° coming back round for the burn. Every node after this one carries
  // +360 for that reason — the bearing is periodic, so the values are
  // equivalent, but the table has to stay monotonic through the revolution or
  // the camera unwinds backwards through the beat that is supposed to be an
  // orbit.
  [uAt(2.02e5), 30],
  [uAt(2.12e5), 150],
  // …and back onto the DAY side for the burn. 300° is still 18° of sunlight
  // short of the terminator, and the whole subject of beat 9 is a lit stage
  // firing: an unlit one is a dark silhouette against a dark planet, which is
  // indistinguishable from the missing spacecraft this pass started with.
  [uAt(1.23e6), 375],
  // Anchored on each cruise beat's own MIDPOINT — the point every review
  // samples — and alternating hard. Out here the camera's bearing is the only
  // large-area variable there is: the starfield, the galactic band, the dust
  // and both orbital rings all swing with it, while the screen-anchored hero
  // and Sun hold their corners because they are derived from this same basis.
  // Beats 11 through 15 measured 1.7, 1.9, 1.9, 0.6 and 1.8 adjacent distance
  // against a 6.0 bar — five captions over one picture — and nothing smaller
  // than moving the whole sky between them was going to fix that.
  [uAt(7.9e7), 380],
  [uAt(4.6e9), 318],
  [uAt(5.9e10), 394],
  [uAt(1.78e11), 322],
  [uAt(2.72e11), 400],
  [uAt(4.16e11), 326],
  [uAt(5.24e11), 396],
  [uAt(MARS_D - 3.9e8), 318],
  [uAt(MARS_D - 3.5e7), 396],
  [uAt(MARS_D - 8.2e6), 340],
  [uAt(MARS_D - 3.2e6), 368],
  // The descent gets the same treatment, for the same reason: beats 22–25 are
  // four shots of a lander over rust-coloured ground, and turning the camera
  // swings the sun and the terrain relief right across the frame.
  // Widened from ±14–24° to ±36°. Removing the starfield that had been drawn
  // over the Martian ground (see `stars` in layers.js) cost these five beats
  // most of their frame-to-frame difference, because the speckle was doing work
  // it had no right to be doing; the bearing has to do it instead.
  [uAt(MARS_D - 1.25e5), 360],
  [uAt(MARS_D - 9.6e4), 328],
  [uAt(MARS_D - 3.8e4), 398],
  [uAt(MARS_D - 6.9e3), 324],
  [uAt(MARS_D - 1.73e3), 394],
  [uAt(MARS_D - 770), 334],
  [uAt(MARS_D), 360],
  [1, 360],
];

// WHERE THE TRAVEL AXIS LANDS ON SCREEN. 0 through the ascent and the descent,
// where the ground is genuinely at -y; 90 through the interplanetary stretch,
// which turns the world's +y travel axis into screen-horizontal so the
// departure is at frame left and the destination at frame right.
const ROLL = [
  [uAt(1), 0],
  // THE ROLL STARTS AT THE BURN, not at ten thousand kilometres. `earth-to-moon`
  // found that the world tipping over is the story at the point it happens — a
  // crew stops having a floor — and trans-Mars injection is precisely that
  // point here. It also separates beat 9 from beat 8, which are otherwise the
  // same lit limb from nearly the same bearing.
  [uAt(2.05e5), 0],
  [uAt(2.2e5), 24],
  [uAt(3.0e6), 72],
  [uAt(6.0e7), 90],
  // …and then it BREATHES, ±12° on each cruise beat's own midpoint. Rolling
  // the camera rotates every pixel in the frame about the view axis, which is
  // the strongest per-beat lever there is against `adjacent` — a metric that
  // compares 16 × 10 cell averages and therefore barely notices small bright
  // objects moving around on black. The screen-anchored hero and Sun do not
  // move, because `screenAnchoredMeters` reconstructs the rolled basis; what
  // moves is the sky behind them.
  // ±28° rather than ±12°. Rolling the camera rotates the galactic band about
  // the view axis, and the band is now the brightest large-area thing in the
  // frame rather than a tint on top of one, so the roll has to be wide enough
  // for that rotation to read.
  [uAt(4.6e9), 50],
  [uAt(5.9e10), 130],
  [uAt(1.78e11), 51],
  [uAt(2.72e11), 129],
  [uAt(4.16e11), 52],
  [uAt(5.24e11), 128],
  [uAt(MARS_D - 3.9e8), 44],
  [uAt(MARS_D - 3.5e7), 134],
  [uAt(MARS_D - 8.2e6), 68],
  [uAt(MARS_D - 3.2e6), 103],
  [uAt(MARS_D - 1.0e6), 90],
  [uAt(MARS_D - 2.0e5), 0],
  [1, 0],
];

// Pushes the subject clear of the copy panel, which owns the lower left.
const PAN = [
  [uAt(1), 0.6],
  [uAt(130), 0.9],
  [uAt(1.4e4), 1.0],
  [uAt(2.0e5), 0.9],
  [uAt(1.0e9), 1.0],
  [uAt(3.0e10), 0.9],
  [uAt(2.2e11), 0.7],
  [uAt(5.0e11), 0.8],
  [uAt(MARS_D - 1.016e7), 0.8],
  [uAt(MARS_D - 1.25e5), 0.9],
  [uAt(MARS_D), 0.7],
  [uAt(walked(9)), 0.4],
  [1, 0.9],
];

export const camAt = (u) => plin(CAM, u);
export const azimuthAt = (u) => plin(AZIMUTH, u);
export const rollAt = (u) => plin(ROLL, u);
export const panAt = (u) => plin(PAN, u);

// ---------------------------------------------------------------------------
// SCREEN ANCHORING: where to put a thing so it holds one place in the FRAME.
//
// Rebuilds the exact basis `aimCamera` constructs, from the same tables
// `index.js` feeds it — one formula rather than two that have to agree. `right`
// and `up` are camera-space frame units AFTER the roll, so "lower right" means
// lower right on screen whether the camera is upright or turned 90°, and
// `ahead` is a true distance in front of the lens, so an object placed here
// parallaxes against everything it passes instead of sitting flat on top.
//
// This is `voyager/plan.js`'s helper with the roll term added. It is kept local
// to this journey rather than promoted into `src/kit/`, because promoting it
// would make `voyager` depend on a module edited for Mars — a shared-code
// change, obliging `--sweep`, to solve one journey's placement problem.
export function screenAnchoredMeters(u, { right = 0, up = 0, ahead = 3.1 } = {}) {
  const frameM = frameAt(u);
  const unit = frameM / 4;

  const [cx, cy, cz] = camAt(u);
  const a = (azimuthAt(u) * Math.PI) / 180;
  const P = [cx * Math.cos(a) + cz * Math.sin(a), cy, cz * Math.cos(a) - cx * Math.sin(a)];
  const L = lookAtUnits(u);

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

  // Three's camera looks down its own -Z, so F is the view direction.
  const F = norm(sub(L, P));
  const R0 = norm(cross(F, [0, 1, 0]));
  const U0 = cross(R0, F);

  // `rotateZ` maps local X → cosθ·X + sinθ·Y and local Y → -sinθ·X + cosθ·Y.
  // Screen right and screen up are those rotated axes, and `translateX` — which
  // is what `pan` is — runs along the rotated X too.
  const t = (rollAt(u) * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const R = [0, 1, 2].map((i) => c * R0[i] + s * U0[i]);
  const U = [0, 1, 2].map((i) => -s * R0[i] + c * U0[i]);

  const pan = panAt(u);
  return [0, 1, 2].map((i) => (P[i] - pan * R[i] + R[i] * right + U[i] * up + F[i] * ahead) * unit);
}

// ---------------------------------------------------------------------------
// A BODY THAT IS TOO FAR OFF THE BORESIGHT TO AIM AT, but too important to drop.
//
// Both the Sun (behind, at a heliocentric range this journey never renders) and
// Mars during the long approach (thirty units off, then two) are in this
// category, and each of them was previously given a hard-coded world direction
// that the camera had no reason to be looking in. This slides ONE position
// continuously between "screen-anchored, so it is always in the composition"
// and "at its true offset, so its motion is real", crossing over as the true
// position comes inside the frame. Nothing pops, and nothing is ever off frame.
// The crossover is measured against the AIM POINT, not against the origin —
// the camera does not look at the origin during either the departure or the
// approach, so "is this body in the frame" is a question about the boresight.
// Inside 6 units of the aim the body is drawn where it really is; past 14 it is
// fully anchored, and in between it slides. The near threshold has to be wide
// enough to cover the beat where the point and the first resolvable disc are
// the same object, or the frame holds a placed point AND a planet.
export function pointPositionMeters(u, trueY, anchor) {
  return placedPositionMeters(u, [0, trueY, 0], anchor);
}

// The same slide for a body whose true position is not on the travel axis —
// the Sun, once the heliocentric frame is real (see below). Distance is measured
// from the AIM POINT in units, for the same reason the scalar version measures
// it there: "is this in the frame" is a question about the boresight.
export function placedPositionMeters(u, trueP, anchor) {
  const unit = frameAt(u) / 4;
  const anchored = screenAnchoredMeters(u, anchor);
  const aim = lookAtUnits(u);
  const dx = trueP[0] / unit - aim[0];
  const dy = trueP[1] / unit - aim[1];
  const dz = trueP[2] / unit - aim[2];
  const k = clamp01((Math.hypot(dx, dy, dz) - 6) / 8);
  return [0, 1, 2].map((i) => trueP[i] * (1 - k) + anchored[i] * k);
}

// ---------------------------------------------------------------------------
// THE MISSION'S ACTUAL SHAPE.
//
// A reader scrolled this journey and said "we have not shown the entire path of
// the mission", and they were right in a way that went deeper than the drawing.
// What was here before:
//
//   · `transfer-path` was `x = sin(πs) × 0.12`, `y = (s − 0.5) × MARS_D` — a
//     bow twelve per cent deep on a straight line, which at any frame this
//     journey ever uses reads as a straight line;
//   · the two orbital RINGS were circles in the x–z plane, centred `AU` and
//     `MARS_AU` ahead along the travel axis, which puts the spacecraft on each
//     ring's POLAR AXIS rather than on the ring. Earth was not on Earth's
//     orbit;
//   · and the two rings mounted in non-overlapping stretches of the axis, so no
//     frame ever held the Sun, both orbits and the transfer together.
//
// A Hohmann transfer is HALF OF AN ELLIPSE with the Sun at one focus, perihelion
// on Earth's orbit and aphelion on Mars'. That is the single most important true
// fact about the shape of this mission and the journey was not drawing it.
//
// So: one heliocentric plane, the world x–y plane, with the Sun at its origin.
//
//   a = (AU + MARS_AU)/2, e = (MARS_AU − AU)/(MARS_AU + AU), b = a√(1 − e²)
//   P(E) = [a(cos E − e), b sin E]        // E = πs, eccentric anomaly
//
// E = 0 gives (AU, 0) — perihelion, on Earth's orbit; E = π gives (−MARS_AU, 0)
// — aphelion, on Mars'. Both by construction, not by tuning.
//
// THE FRAME ROTATES, because the world's +y is the DIRECTION OF TRAVEL and the
// direction of travel swings through 180° over the transfer. `helioFrame`
// returns the Sun's position in world metres and the angle that carries the
// heliocentric plane onto it. Feed both to `trajectory` and the ellipse, the
// rings and the Sun are one system that the spacecraft sits ON — the world
// origin lands exactly on the path's own progress point, by construction rather
// than by two formulas agreeing.
//
// HONEST RESIDUAL: `s` is the fraction of the axis, and the axis is arc length,
// while `E` is the eccentric anomaly. For e = 0.207 those differ by about two
// per cent, so the ticks along the arc are very slightly unevenly spaced. The
// spacecraft is still exactly on the line, because the same `s` places both.
export const HOHMANN_A = (AU + MARS_AU) / 2;
export const HOHMANN_E = (MARS_AU - AU) / (MARS_AU + AU);
export const HOHMANN_B = HOHMANN_A * Math.sqrt(1 - HOHMANN_E ** 2);

// s in 0..1 → [x, y] in metres, Sun at the origin.
export const hohmannPoint = (s) => {
  const E = Math.PI * Math.max(0, Math.min(1, s));
  return [HOHMANN_A * (Math.cos(E) - HOHMANN_E), HOHMANN_B * Math.sin(E)];
};

export const transferProgress = (d) => Math.max(0, Math.min(1, d / MARS_D));

// The heliocentric frame as seen from the spacecraft, at axis position u.
export function helioFrame(u) {
  const s = transferProgress(dAt(u));
  const E = Math.PI * s;
  const [px, py] = hohmannPoint(s);
  // The tangent, which world +y is defined to be.
  const tx = -HOHMANN_A * Math.sin(E);
  const ty = HOHMANN_B * Math.cos(E);
  const n = Math.hypot(tx, ty) || 1;
  const fx = tx / n;
  const fy = ty / n;
  // world = Rz(theta) · (helio − P), with cos θ = fy and sin θ = fx. At s = 0
  // that is the identity and the Sun lands at world −x; at s = 1 it is a half
  // turn and the Sun is STILL at world −x, which is what a prograde transfer
  // looks like from the inside.
  const theta = Math.atan2(fx, fy);
  const c = Math.cos(theta);
  const sn = Math.sin(theta);
  // The Sun is the heliocentric origin, so its offset from the ship is −P.
  const sunWorld = [
    c * -px - sn * -py,
    sn * -px + c * -py,
    0,
  ];
  return { theta, sunWorld, s };
}

// Where a fixed heliocentric point sits in world metres, this frame. Used for
// the two endpoint markers — the departure point on Earth's orbit and the
// arrival point on Mars' — so each marker sits exactly ON its own ring.
export function helioWorldMeters(u, [hx, hy]) {
  const { theta, sunWorld } = helioFrame(u);
  const c = Math.cos(theta);
  const sn = Math.sin(theta);
  return [sunWorld[0] + c * hx - sn * hy, sunWorld[1] + sn * hx + c * hy, 0];
}

// ---------------------------------------------------------------------------
// THE SUN — the one subject on screen for the whole interplanetary stretch, and
// this journey's stated reason to exist.
//
// SIZE AND BRIGHTNESS ARE PHYSICAL; ONLY THE BEARING IS AUTHORED. Real
// inverse-square flux against heliocentric range drives brightness, and its
// square root drives the glare radius — so the disc measurably shrinks and
// cools from 1 AU to 1.524 AU across beats 10–16 rather than being described as
// doing so in the copy while rendering identically in every frame.
export const sunDistAU = (d) => 1 + clamp01((d - 2.0e5) / (5.0e11 - 2.0e5)) * 0.524;
export const sunFlux = (d) => 1 / sunDistAU(d) ** 2;

// The direction sunlight arrives FROM. Every planet, boulder and spacecraft in
// the journey is lit with this one vector; two bodies with different terminator
// angles read as a collage rather than as a system. The +z term is load-bearing
// — the camera sits on +z, so a light with no z lights the hemisphere nobody
// can see.
export const SUN_DIR = [0.72, 0.14, 0.62];
