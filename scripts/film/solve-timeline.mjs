// Where the film is, second by second. Pure — no browser, no network — so
// `smoke.mjs` can prove it in milliseconds rather than 20 minutes into a render.
//
// ============================================================================
// THE AUDIO IS THE CLOCK
// ============================================================================
// A shot lasts exactly as long as its spoken line, measured from the real
// ElevenLabs alignment. There is deliberately NO per-shot "seconds" knob: the
// director's lever for pacing is HOW MANY WORDS a beat gets, which is the same
// lever a documentary writer actually has. A number that stretches a shot past
// its line would either insert a silent hole mid-sentence or desynchronise
// everything after it.
//
// The one exception is a beat with NO line at all — a wordless beat, which a
// journey film genuinely wants a few of. That inserts `hold` seconds of real
// silence, and the narration is emitted as SEGMENTS around the insertion so
// nothing downstream drifts. Splitting a single take at a point where silence
// was wanted anyway costs nothing; splitting it between two words would cost
// the continuity that made it a single take.
//
// ============================================================================
// u(t): WHY IT NEVER STOPS
// ============================================================================
// `howitworks` had discrete steps and flew the camera between them. A journey
// has one continuous scalar, so this is simpler — but the naive version, "jump
// to the beat and hold", produces a frozen frame for eight seconds in a piece
// whose entire subject is travelling. So each shot is:
//
//   transit   smoothstep from where the last shot ended to 15% into this
//             beat's own axis span. Short (default 1.8s), capped at 40% of
//             the shot so a terse line still gets a hold.
//   dwell     a slow LINEAR drift from 15% to 80% of the span. The world keeps
//             moving under a held sentence; nothing ever sits still.
//
// u is therefore continuous, monotonic and everywhere-moving, and mid-dwell
// lands near the 0.45-of-span point that `shots.mjs` and `frame-check.mjs`
// already review — so the frame the gate blessed is the frame the film shows.
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Silence before the first word, over the opening frame.
export const LEAD_IN = 1.2;
// Hold after the last word. This is the end card's window: the final caption
// also lingers ~1s past the last word and the card cannot start until that
// clears, so the tail has to cover both.
export const TAIL_PAD = 4.5;
// Default transit, in seconds.
export const TRAVEL = 1.8;
// Fraction of a shot that transit may consume before it starts eating the hold.
const TRAVEL_MAX_FRACTION = 0.4;
// Where in its own axis span a beat's dwell starts and ends.
const DWELL_FROM = 0.15;
const DWELL_TO = 0.80;

/** Load a journey's axis and beats, and return each beat's u mark. */
export async function beatMarks(id) {
  const dir = resolve('src/journeys', id);
  const { axisDef } = await import(pathToFileURL(join(dir, 'axis-def.js')).href);
  const { beats } = await import(pathToFileURL(join(dir, 'beats.js')).href);
  const { makeAxis } = await import(pathToFileURL(resolve('src/engine/axis.js')).href);
  const A = makeAxis(axisDef);
  return beats.map((b, i) => ({
    index: i,
    heading: b.heading,
    body: b.body,
    u: A.toU(b.at),
  }));
}

/**
 * Solve the whole timeline.
 *
 * @param {object} o
 * @param {string} o.id
 * @param {Array}  o.marks     from `beatMarks()`
 * @param {object} o.film      the film.js editorial layer
 * @param {object} o.timings   { [shotIndex]: {start, end} } in NARRATION time
 * @param {number} o.fps
 */
export function solve({ id, marks, film, timings, fps = 24, chrome = 'ribbon', width = 1920, height = 1080, dryRun = false }) {
  const shots = film.shots ?? [];
  if (!shots.length) throw new Error('film.js declares no shots');

  // Beat indices must strictly increase: the axis is monotonic and so is the
  // film. A shot list that revisits a beat would ask u to go backwards.
  for (let i = 1; i < shots.length; i++) {
    if (shots[i].beat <= shots[i - 1].beat) {
      throw new Error(`shot ${i} targets beat ${shots[i].beat}, which is not after shot ${i - 1}'s beat ${shots[i - 1].beat}`);
    }
  }
  for (const s of shots) {
    if (!marks[s.beat]) throw new Error(`shot targets beat ${s.beat}, but ${id} has ${marks.length} beats`);
  }

  // --- each shot's axis span -------------------------------------------------
  // A shot owns the axis from its own beat's mark up to the NEXT SHOT's beat
  // mark, not the next beat's — a film that skips beats must still cover the
  // axis continuously, or u would jump across the skipped ground in one frame.
  const spans = shots.map((s, i) => {
    const from = marks[s.beat].u;
    const to = i + 1 < shots.length ? marks[shots[i + 1].beat].u : 1;
    return { from, to, size: Math.max(1e-6, to - from) };
  });

  // --- screen time -----------------------------------------------------------
  // `hold` on a wordless shot inserts real silence; everything after it shifts
  // by that much, and the narration is cut into segments at those seams.
  // Pass 1: every shot's START, plus the narration segment seams.
  //
  // Ends are NOT computed here. A shot ends when the next one begins, and
  // deriving that inline meant the shot before a wordless one saw no next
  // timing entry, concluded it was the last shot, and took the closing tail
  // pad — putting a four-second hold in the middle of the film.
  const out = [];
  const segments = [];
  let inserted = 0;
  let segStart = null;

  const narrEnd = Math.max(0, ...Object.values(timings).map((t) => t.end));

  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    const t = timings[i];

    // Whether a shot is WORDLESS is decided here by the absence of a timing
    // entry, not by film.js — the timings are what the voice actually says, and
    // the audio cannot be re-cut without re-rendering it. So the two can drift,
    // and when they do nothing downstream notices: hand-editing a narration
    // line and resuming with `--from=render` silently keeps the OLD take, and
    // the run reports a film that does not contain the edit. That happened on
    // voyager and cost a full render. Refuse instead.
    const spoken = !!(s.narration && s.narration.trim());
    if (spoken !== !!t) {
      throw new Error(
        `shot ${i} (beat ${s.beat}) is ${spoken ? 'narrated in film.js but has no recorded line' : 'wordless in film.js but has a recorded line'} — ` +
        'the voice was rendered from a different script. Re-run with --from=voice.',
      );
    }

    if (!t) {
      // A wordless shot. Close any open narration segment before the gap: the
      // seam lands where silence was wanted anyway, which is the only place a
      // single take may be cut without audible cost.
      if (segStart !== null) closeSegment(i - 1);
      const hold = Math.max(1.0, s.hold ?? 4);
      const start = LEAD_IN + (nextNarrStart(i) ?? narrEnd) + inserted;
      inserted += hold;
      out.push({ i, beat: s.beat, start, hold, contentStart: start, silent: true });
      continue;
    }

    if (segStart === null) segStart = { shot: i, at: t.start };
    out.push({
      i, beat: s.beat, silent: false,
      start: LEAD_IN + t.start + inserted,
      contentStart: LEAD_IN + t.start + inserted,
      narrEndAt: LEAD_IN + t.end + inserted,
    });
  }
  if (segStart !== null) closeSegment(shots.length - 1);

  // Pass 2: ends. Each shot runs until the next one starts; the last runs to
  // its own final word plus the tail.
  for (let k = 0; k < out.length; k++) {
    const next = out[k + 1];
    out[k].end = next
      ? next.start
      : out[k].silent
        ? out[k].start + out[k].hold
        : out[k].narrEndAt + TAIL_PAD;
    delete out[k].narrEndAt;
    delete out[k].hold;
  }

  // --- u(t) ------------------------------------------------------------------
  let prevU = 0;
  for (const o of out) {
    const sp = spans[o.i];
    const isFirst = o.i === 0;
    const isLast = o.i === shots.length - 1;
    const dur = o.end - o.start;
    const travel = isFirst ? 0 : Math.min(shots[o.i].travel ?? TRAVEL, dur * TRAVEL_MAX_FRACTION);

    // First shot starts at the axis origin, last shot ends at 1 — the film
    // covers the whole journey or it is not a film of that journey.
    o.uFrom = isFirst ? sp.from : sp.from + sp.size * DWELL_FROM;
    o.uTo = isLast ? 1 : sp.from + sp.size * DWELL_TO;
    o.uEnter = prevU;
    o.travel = travel;
    // Guard the monotonic invariant at the seam: a shot whose dwell would
    // start behind where the previous one ended (possible if two beat marks
    // sit very close) drags forward instead of stepping back.
    if (o.uFrom < prevU) o.uFrom = prevU;
    if (o.uTo < o.uFrom) o.uTo = o.uFrom;
    prevU = o.uTo;

    Object.assign(o, {
      heading: marks[shots[o.i].beat].heading,
      narration: shots[o.i].narration ?? '',
      sfx: shots[o.i].sfx ?? [],
      look: shots[o.i].look ?? null,
    });
    o.start = +o.start.toFixed(3);
    o.end = +o.end.toFixed(3);
    o.contentStart = +o.contentStart.toFixed(3);
  }

  const duration = out.length ? out[out.length - 1].end : 0;

  // --- acts, for the score ---------------------------------------------------
  const acts = (film.score?.acts ?? []).map((a) => {
    const first = out.find((o) => shots[o.i].beat >= a.fromBeat) ?? out[0];
    const last = [...out].reverse().find((o) => shots[o.i].beat <= a.toBeat) ?? out[out.length - 1];
    return {
      name: a.name ?? `act ${a.fromBeat}-${a.toBeat}`,
      text: a.text ?? '',
      styles: a.styles ?? [],
      negativeStyles: a.negativeStyles ?? [],
      start: +first.start.toFixed(3),
      end: +last.end.toFixed(3),
    };
  });

  return {
    id, fps, width, height, chrome,
    // Carried into the timeline so `film-gate.mjs` knows the audio is
    // deliberate silence. Without it the gate measures a silent mix, gets NaN
    // LUFS and a 0 dB duck, and reports a working pipeline as broken.
    dryRun,
    leadIn: LEAD_IN,
    tailPad: TAIL_PAD,
    duration: +duration.toFixed(3),
    frames: Math.round(duration * fps),
    title: film.title ?? null,
    endCard: film.endCard ?? null,
    // Narration segments: [{ file-relative trim, delay }] — one entry unless
    // wordless shots forced a split.
    segments,
    acts,
    shots: out,
  };

  // --- helpers ---------------------------------------------------------------
  function closeSegment(lastShot) {
    const last = timings[lastShot];
    if (segStart && last) {
      segments.push({
        trimFrom: +segStart.at.toFixed(3),
        trimTo: +last.end.toFixed(3),
        delay: +(LEAD_IN + segStart.at + inserted).toFixed(3),
      });
    }
    segStart = null;
  }
  function nextNarrStart(from) {
    for (let k = from; k < shots.length; k++) if (timings[k]) return timings[k].start;
    return null;
  }
}

/**
 * u at time t. Used by the renderer and by the gate's monotonicity check —
 * one definition, so a curve that passes the gate is the curve that rendered.
 */
export function makeCurve(timeline) {
  const shots = timeline.shots;
  return (t) => {
    if (t <= 0) return shots[0]?.uFrom ?? 0;
    const s = shots.find((o) => t < o.end) ?? shots[shots.length - 1];
    const local = t - s.start;
    if (local < s.travel && s.travel > 0) {
      const k = smoothstep(local / s.travel);
      return s.uEnter + (s.uFrom - s.uEnter) * k;
    }
    const dwellDur = Math.max(1e-6, (s.end - s.start) - s.travel);
    const k = Math.min(1, Math.max(0, (local - s.travel) / dwellDur));
    return s.uFrom + (s.uTo - s.uFrom) * k;
  };
}

function smoothstep(x) {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}
