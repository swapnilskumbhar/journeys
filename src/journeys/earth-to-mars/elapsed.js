// MISSION ELAPSED TIME as a function of the axis.
//
// The axis of this journey is DISTANCE along the flight path, deliberately —
// beat 1's hint says so out loud. This module does not change that. It adds the
// other half of the fact: how long the distance took. A reader scrolling past
// "Crossing Earth's orbit" is looking at a picture that took three months to
// arrive at, and nothing on screen said so.
//
// WHY THIS IS NOT A TABLE. The ascent and the descent are event-driven — a
// launch vehicle's timeline is a list of real seconds and interpolating between
// them is fine. The CRUISE is not: time along a Hohmann transfer is nowhere
// near linear in arc length, because the ship leaves Earth at perihelion moving
// fastest and arrives at Mars at aphelion moving slowest. Halfway along the ARC
// is not halfway through the TIME, and a linear table would put the midpoint
// about three weeks wrong and — worse — would make the last stretch of cruise
// appear to pass at the same rate as the first, which is the one thing about an
// interplanetary transfer that is genuinely counter-intuitive.
//
// So the cruise is solved from Kepler's equation on the real transfer ellipse
// and inverted numerically at module load. Pure, browser-free, deterministic,
// importable by scripts/smoke.mjs — same contract as distance.js.
import { AU, MARS_AU, MARS_D, walked } from './distance.js';

const MU_SUN = 1.32712440018e20; // standard gravitational parameter, m³/s²

// --- the transfer ellipse ---------------------------------------------------
// Perihelion at Earth's orbit, aphelion at Mars'. Half of this ellipse IS the
// cruise.
const R_PERI = AU;
const R_APO = MARS_AU;
const SMA = (R_PERI + R_APO) / 2;                      // 1.888e11 m
const ECC = (R_APO - R_PERI) / (R_APO + R_PERI);       // 0.2074
const SMI = SMA * Math.sqrt(1 - ECC * ECC);
// √(a³/μ) — the time unit of Kepler's equation, seconds per radian of mean
// anomaly.
const TAU = Math.sqrt((SMA * SMA * SMA) / MU_SUN);
/** Perihelion to aphelion, seconds. ~258.8 days. */
export const CRUISE_SECONDS = Math.PI * TAU;

// Arc length and time, sampled in eccentric anomaly E over [0, π] and
// accumulated once. 2000 intervals puts the arc error well under a part in a
// million, which is far finer than the journey's own 5.60e11 m rounding.
const N = 2000;
const ARC = new Float64Array(N + 1);
const TIME = new Float64Array(N + 1);
{
  // Position with the focus at the Sun: x = a(cos E − e), y = b sin E, so
  // ds/dE = √(a² sin²E + b² cos²E).
  const dsdE = (E) => {
    const s = Math.sin(E), c = Math.cos(E);
    return Math.sqrt(SMA * SMA * s * s + SMI * SMI * c * c);
  };
  const dE = Math.PI / N;
  for (let i = 1; i <= N; i++) {
    const e0 = (i - 1) * dE, e1 = i * dE;
    // Simpson over each interval — the integrand is smooth, so this is exact
    // to rounding for the sample count above.
    ARC[i] = ARC[i - 1] + (dE / 6) * (dsdE(e0) + 4 * dsdE((e0 + e1) / 2) + dsdE(e1));
    // Kepler: M = E − e·sin E, and t = M·√(a³/μ).
    TIME[i] = (e1 - ECC * Math.sin(e1)) * TAU;
  }
}
/** Perihelion to aphelion along the ellipse, metres. */
export const CRUISE_ARC = ARC[N];

/** Seconds into the cruise, given a fraction 0..1 of the cruise ARC travelled. */
function cruiseTime(fraction) {
  const target = Math.min(Math.max(fraction, 0), 1) * CRUISE_ARC;
  // The table is monotonic in arc, so a binary search inverts it.
  let lo = 0, hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ARC[mid] <= target) lo = mid; else hi = mid;
  }
  const span = ARC[hi] - ARC[lo];
  const f = span > 0 ? (target - ARC[lo]) / span : 0;
  return TIME[lo] + f * (TIME[hi] - TIME[lo]);
}

// --- the event-driven legs --------------------------------------------------
// Ascent: a real heavy-lift timeline, T+0 at ignition. The distances are this
// journey's own axis marks, so the pairs line up with the beats rather than
// with a generic profile.
const ASCENT = [
  [1, 0],          // engines at full thrust, still held down
  [4, 7],          // hold-down release
  [130, 13],       // the tower clears
  [1.4e4, 72],     // max Q
  [6.5e4, 155],    // staging
  [9.5e4, 195],    // the sky goes black
  [2.0e5, 520],    // second-stage cutoff into the parking orbit
];
/** Second-stage cutoff — the moment the parking orbit begins. */
const T_PARKING = 520;
// One full circuit at ~200 km before committing to the burn. A low orbit's
// period is ~88 minutes; the coast here is one of them.
const PARKING_SECONDS = 5280;
const T_TMI = T_PARKING + PARKING_SECONDS;

const D_TMI = 2.2e5;                 // trans-Mars injection, end of the parking coast
const D_ENTRY = MARS_D - 1.25e5;     // entry interface, 125 km above Mars

const T_ENTRY = T_TMI + CRUISE_SECONDS;

// Entry, descent and landing. Keyed to metres FALLEN since the entry
// interface, not to altitude — `lerpTable` needs an ascending x column, and an
// altitude table counts down. Keying it the readable way round and letting the
// interpolator run backwards is how every EDL beat first came out reading
// "E+0s": the lookup took the first row every time.
//
// Just under seven minutes, which is the real figure and the reason the phase
// is nicknamed for its duration.
const EDL = [
  [0, 0],          // entry interface, 125 km
  [6.5e4, 55],     // peak heating, 60 km
  [1.14e5, 240],   // parachute, 11 km
  [1.23e5, 300],   // heat shield away, 2 km
  [1.236e5, 330],  // powered descent begins, 1.4 km
  [1.25e5, 400],   // touchdown
];
/** Ignition to touchdown, seconds. */
export const MISSION_SECONDS = T_ENTRY + 400;

// The surface. The axis past MARS_D is metres walked from the ladder, but the
// three beats out here are a landing, a first photograph and an EVENING — so
// what the axis is really measuring is the afternoon, and the table stretches
// to say so. Beat 28 sits at 55 m, and that is where the sun has to be going
// down; a table that put it two hours after touchdown would have the copy
// describing dusk over a midday sky.
const SURFACE = [
  [0, 0],
  [9, 3600],       // the first frame, an hour after landing
  [55, 39600],     // an evening star, eleven hours in
  [95, 43200],
];

/** Monotonic linear interpolation over an ascending [x, y] table. */
function lerpTable(table, x) {
  if (x <= table[0][0]) return table[0][1];
  const last = table.length - 1;
  if (x >= table[last][0]) return table[last][1];
  for (let i = 1; i <= last; i++) {
    const [x1, y1] = table[i];
    if (x <= x1) {
      const [x0, y0] = table[i - 1];
      const span = x1 - x0;
      return span > 0 ? y0 + ((x - x0) / span) * (y1 - y0) : y1;
    }
  }
  return table[last][1];
}

/**
 * Seconds since ignition, at axis distance `d` metres.
 * Monotonic non-decreasing over the whole axis — smoke.mjs checks that.
 */
export function elapsedAt(d) {
  if (d <= 2.0e5) return lerpTable(ASCENT, d);

  // The parking coast covers almost no distance and most of an hour, which is
  // exactly why it needs its own leg: interpolating it against distance would
  // compress ninety minutes into a rounding error.
  if (d <= D_TMI) {
    const f = (d - 2.0e5) / (D_TMI - 2.0e5);
    return T_PARKING + f * PARKING_SECONDS;
  }

  if (d <= D_ENTRY) {
    // This journey's axis calls the whole path 5.60e11 m; the true half-ellipse
    // arc is ~5.86e11. Map by FRACTION rather than by metres so the two
    // roundings cannot disagree at the endpoints.
    const f = (d - D_TMI) / (D_ENTRY - D_TMI);
    return T_TMI + cruiseTime(f);
  }

  if (d <= MARS_D) return T_ENTRY + lerpTable(EDL, d - D_ENTRY);

  return MISSION_SECONDS + lerpTable(SURFACE, d - MARS_D);
}

/** Bare clock, no prefix: 55s · 8m40s · 1h36m · 11 days. */
function clock(s) {
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return `${m}m${String(Math.round(s - m * 60)).padStart(2, '0')}s`;
  }
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    return `${h}h${String(Math.floor((s - h * 3600) / 60)).padStart(2, '0')}m`;
  }
  const days = s / 86400;
  return `${days < 10 ? days.toFixed(1) : Math.round(days)} days`;
}

/**
 * The elapsed reading for axis position `d`, in the register that phase of the
 * mission is actually counted in.
 *
 * WHY IT SWITCHES REGISTER, rather than always printing time since ignition.
 * The last eight beats of this journey — entry through to an evening on the
 * surface — all sit inside the same six hours, at the far end of a 259-day
 * mission. Printed as time since ignition they are eight identical readings of
 * "T+259 days", and the phase everybody actually knows by its duration, the
 * seven minutes of entry and descent, is the one the readout would hide.
 * `formatDistance` next door already switches register for exactly this reason
 * (metres up → AU from Earth → AU to Mars → km above Mars → m from the ladder);
 * this is the same move on the other axis, and it is also the fix crust-to-core
 * landed on for a readout whose length was swinging the scrub track around.
 *
 *   T+  since ignition        E+  since entry interface     L+  since touchdown
 */
export function formatMissionTime(d) {
  const s = elapsedAt(d);
  if (d > MARS_D) return `L+${clock(s - MISSION_SECONDS)}`;
  if (d > D_ENTRY) return `E+${clock(s - T_ENTRY)}`;
  return `T+${clock(s)}`;
}
