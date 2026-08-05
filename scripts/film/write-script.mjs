// The director. Looks at the journey, writes the film.
//
// `gpt-5.6-terra` is a text+VISION model, and the vision is the entire point.
// It is shown one unoccluded frame per beat and asked to narrate what is
// actually on screen — not what the heading claims is on screen.
//
// A NOTE ON "BLIND", because this repo uses the word for something else:
//   · `journey-blind-reviewer` is blind because it must not know what a frame
//     is SUPPOSED to show. Restricting what it can know is the mechanism.
//   · the director here is the opposite — it is told the beat, the copy and
//     the axis reading, and gets the frames with the panel and ribbon removed
//     purely so nothing occludes the picture.
// Same `--blind` capture, opposite purpose. Do not collapse them.
//
// Why it matters that it can see: a director working from headings alone
// writes "Io's volcanoes erupt three hundred kilometres into space" over a
// frame that contains a grey dot, and the film inherits the exact defect the
// frame-check gate was built to catch. One that can see writes to the picture,
// or flags the beat.
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ask, imagePart, textPart, costOf } from './lib/openai.mjs';
import { run } from './lib/ffmpeg.mjs';

// Width the director actually sees. `shots.mjs` captures at 1440x900 PNG,
// which is ~1.8 MB a frame — thirty-nine of those is a 35 MB request body, and
// THAT is what killed two director runs with a bare `fetch failed`. undici's
// 300-second timeout counts from the start of the request, so a slow upload
// trips it long before the model has been asked anything.
//
// Nothing is lost by shrinking. The vision encoder tiles and downsamples the
// image anyway — a full 1440x900 frame billed 1,630 input tokens in testing,
// the same order as this does — so the only thing full resolution buys is
// upload time. Composition, occupancy and colour all survive 768px intact,
// and those are the whole reason the director is shown the frames.
const DIRECTOR_WIDTH = 768;


// Strict json_schema requires every property listed in `required` and
// additionalProperties:false at every level — there are no optional fields, so
// defaults are stated in the prompt and the model always emits something.
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'endCard', 'scorePrompt', 'acts', 'shots'],
  properties: {
    title: { type: 'string', description: 'Short title card, 1-3 words, upper case.' },
    endCard: { type: 'string', description: 'Closing card. Two short lines separated by \\n.' },
    scorePrompt: { type: 'string', description: 'One sentence describing the whole score.' },
    acts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'fromBeat', 'toBeat', 'text', 'styles', 'negativeStyles'],
        properties: {
          name: { type: 'string' },
          fromBeat: { type: 'integer' },
          toBeat: { type: 'integer' },
          text: { type: 'string', description: 'What this section of music does.' },
          styles: { type: 'array', items: { type: 'string' } },
          negativeStyles: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    shots: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['beat', 'narration', 'travel', 'hold', 'driftYaw', 'driftPitch', 'sfx'],
        properties: {
          beat: { type: 'integer', description: 'Zero-based beat index.' },
          narration: { type: 'string', description: 'Spoken line. Empty string for a wordless shot.' },
          travel: { type: 'number', description: 'Seconds of camera transit into this shot. 1.2-3.0.' },
          hold: { type: 'number', description: 'Seconds held, WORDLESS SHOTS ONLY. 0 otherwise.' },
          // Flat pairs rather than a nested object: strict json_schema demands
          // every property be required at every level, and four numbers that
          // default to zero express "no drift" far more cleanly than a nested
          // shape that must always be present.
          driftYaw: {
            type: 'array', items: { type: 'number' },
            description: 'Camera drift across the shot, [fromDegrees, toDegrees]. [0,0] for none. Range -40..40.',
          },
          driftPitch: {
            type: 'array', items: { type: 'number' },
            description: 'Vertical drift, [fromDegrees, toDegrees]. [0,0] for none. Range -22..22.',
          },
          sfx: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'prompt', 'at', 'seconds'],
              properties: {
                name: { type: 'string', description: 'kebab-case, reused as the cache filename' },
                prompt: { type: 'string' },
                at: { type: 'number', description: 'Seconds after the shot starts.' },
                seconds: { type: 'number' },
              },
            },
          },
        },
      },
    },
  },
};

const INSTRUCTIONS = `You are directing a short documentary film made entirely from a rendered 3D
"journey" — one continuous world travelled along a single monotonic axis
(time, distance or scale). You are given every beat: its heading, its on-page
copy, its axis reading, and ONE FRAME showing what that beat actually looks
like on screen with all captions and UI removed.

YOUR FIRST DUTY IS TO THE PICTURE.
Write narration for what is VISIBLE. If a frame is a faint dot on black, do
not write a line describing a roiling volcanic surface — write a line that
makes the dot mean something ("from here, the largest storm in the solar
system is four pixels wide"). A film whose words and pictures disagree is
worse than one with plainer words. This is the single most common failure in
this project's history and it is what you are here to prevent.

FACTS COME FROM THE COPY, NEVER FROM YOU.
Every number, date, name and distance must already appear in the beat copy you
are given. Do not add figures from your own knowledge, do not round them
differently, and do not upgrade a hedge into a certainty. If a beat's copy
carries no fact you can use, write an observational line instead.

PACING IS WORD COUNT. There is no duration knob.
A shot lasts exactly as long as its spoken line takes to say. A beat that
deserves ten seconds gets roughly twenty-five words; one that deserves four
gets ten. This is your only pacing control and it is enough. Vary it — a run
of same-length lines is what makes a documentary feel like a slideshow.

WRITE ONE CONTINUOUS PIECE OF PROSE.
The lines are spoken as a single unbroken take. Each must run into the next.
No line may begin by restating its heading, and no line may end on a note that
needs a pause the next line will not get. Avoid em-dashes and ellipses: the
voice engine renders them as long fixed pauses that cannot be compressed.

WORDLESS SHOTS. One or two per film, no more. Give a beat an empty narration
and a hold of 3-6 seconds when the picture genuinely carries it alone, and put
them where a viewer needs to breathe — usually just after the densest passage
and just before the ending.

DRIFT: THE CURE FOR A FRAME THAT WILL NOT CHANGE ON ITS OWN.
Look hard at each frame and ask whether it will still be moving ten seconds
later. Some beats change constantly as the journey advances: a planet grows, a
surface rushes past, a shell of material sweeps by. Others do not — a deep
cruise between worlds, a field of stars, a boundary in empty space. In those
the scale law holds the subject at a fixed apparent size and the picture is
identical at both ends of the shot. On screen that is a frozen image for the
whole length of the line, and it is the single most common way a film made
from this project dies.

When you judge a frame to be one of those, give the shot a slow drift:
driftYaw like [-10, 10] over the shot, or [0, 14], and optionally a small
driftPitch. Keep it under about 1.5 degrees per second of the shot's own
length; faster reads as a camera move and pulls attention off the subject.
Leave [0, 0] on any beat whose picture is already changing — drift on top of
real motion is seasickness, not craft.

SOUND EFFECTS. Sparse and diegetic-ish only. Most of a journey is silent.
Three or four in a whole film, on beats where something physically happens.
Never on a beat that is only a change of scale or viewpoint.

THE SCORE. Divide the film into 2-5 acts covering every beat with no gaps and
no overlaps, in order. Each act's styles should describe instrumentation and
mood, not narrative. Keep negativeStyles working: name what would wreck it.

THE TITLE is one to three words, upper case, and must not be a sentence.
THE END CARD is two short lines and is the only place a call to action lives.

Return one shot per beat unless a beat's frame is genuinely redundant with its
neighbour, in which case drop it — a shorter film that always has something to
look at beats a complete one that stalls.`;

export async function writeScript({ id, blindDir, out, effort = 'high', ledger = null, log = console.log }) {
  const dir = resolve('src/journeys', id);
  const { beats } = await import(pathToFileURL(join(dir, 'beats.js')).href);
  const meta = (await import(pathToFileURL(join(dir, 'meta.js')).href)).default;
  const { axisDef } = await import(pathToFileURL(join(dir, 'axis-def.js')).href);
  const { makeAxis } = await import(pathToFileURL(resolve('src/engine/axis.js')).href);
  const A = makeAxis(axisDef);

  const content = [textPart(
    `JOURNEY: ${meta.title}\n` +
    `SUMMARY: ${meta.summary}\n` +
    `AXIS: ${meta.axisLabel}\n` +
    `BEATS: ${beats.length}\n\n` +
    `Below, each beat's copy is followed by its frame.`,
  )];

  const small = resolve(blindDir, '..', `${id}-director-frames`);
  mkdirSync(small, { recursive: true });

  let withFrames = 0;
  let payloadBytes = 0;
  beats.forEach((b, i) => {
    content.push(textPart(
      `\n--- BEAT ${i} ---\n` +
      `heading: ${b.heading}\n` +
      `axis position: u=${A.toU(b.at).toFixed(4)}\n` +
      `copy: ${b.body}`,
    ));
    const frame = join(blindDir, `beat-${String(i + 1).padStart(2, '0')}.png`);
    if (!existsSync(frame)) {
      content.push(textPart('(no frame captured for this beat)'));
      return;
    }
    const shrunk = join(small, `beat-${String(i + 1).padStart(2, '0')}.jpg`);
    if (!existsSync(shrunk)) {
      run(['-i', frame, '-vf', `scale=${DIRECTOR_WIDTH}:-2`, '-q:v', '4', shrunk], 'shrink frame');
    }
    payloadBytes += statSync(shrunk).size;
    content.push(imagePart(shrunk, 'image/jpeg'));
    withFrames++;
  });

  // Printed because the failure it guards against is invisible otherwise: a
  // request that is too large does not report "too large", it reports a
  // timeout minutes later.
  const mb = (payloadBytes * 1.37) / 1048576; // base64 inflates by ~4/3
  log(`director: ${beats.length} beats, ${withFrames} frames at ${DIRECTOR_WIDTH}px (~${mb.toFixed(1)} MB payload), effort=${effort}`);
  if (mb > 20) log(`  WARNING: ${mb.toFixed(0)} MB is large enough to risk an upload timeout`);
  const { json, usage, polls } = await ask({
    instructions: INSTRUCTIONS,
    content,
    schema: SCHEMA,
    schemaName: 'film',
    effort,
    maxTokens: 40000,
    log,
  });
  if (ledger) {
    ledger.openai('script', usage);
    // Free, but counted: a run that polls hundreds of times is a run that hung.
    if (polls) ledger.polls('script', polls);
  }

  // Validate before writing: a shot list that is out of order or points past
  // the end of the journey will fail in the solver anyway, and failing here
  // says why in one line instead of throwing from inside a span calculation.
  const shots = json.shots ?? [];
  if (!shots.length) throw new Error('director returned no shots');
  for (let i = 0; i < shots.length; i++) {
    if (shots[i].beat < 0 || shots[i].beat >= beats.length) {
      throw new Error(`director targeted beat ${shots[i].beat}; ${id} has ${beats.length}`);
    }
    if (i && shots[i].beat <= shots[i - 1].beat) {
      throw new Error(`director returned shots out of order at index ${i}`);
    }
  }

  writeFileSync(out, render(id, meta, json));
  const words = shots.reduce((n, s) => n + (s.narration ? s.narration.trim().split(/\s+/).length : 0), 0);
  log(
    `director: ${shots.length} shots, ${words} words (~${(words / 2.6).toFixed(0)}s spoken), ` +
    `${json.acts?.length ?? 0} acts, ${shots.reduce((n, s) => n + s.sfx.length, 0)} sfx ` +
    `— $${costOf(usage).toFixed(3)}`,
  );
  return { film: json, path: out, usage };
}

/**
 * Emit `film.js`. A real module, committed beside the journey, hand-editable —
 * the editorial layer is DATA the same way beats and layers are, and the point
 * of writing it to disk rather than keeping it in memory is that a human can
 * fix one line without paying for the whole script again.
 */
function render(id, meta, f) {
  const q = (s) => JSON.stringify(s ?? '');
  const shots = f.shots.map((s) => {
    const bits = [`    beat: ${s.beat},`];
    if (s.narration) bits.push(`    narration: ${q(s.narration)},`);
    else bits.push(`    narration: '',\n    hold: ${Math.max(1, s.hold || 4)},`);
    if (s.travel) bits.push(`    travel: ${Number(s.travel).toFixed(1)},`);
    const [y0 = 0, y1 = 0] = s.driftYaw ?? [];
    const [p0 = 0, p1 = 0] = s.driftPitch ?? [];
    if (y0 || y1 || p0 || p1) {
      bits.push(`    look: { from: { yaw: ${y0}, pitch: ${p0} }, to: { yaw: ${y1}, pitch: ${p1} } },`);
    }
    if (s.sfx?.length) {
      bits.push(`    sfx: [\n${s.sfx.map((x) =>
        `      { name: ${q(x.name)}, prompt: ${q(x.prompt)}, at: ${x.at ?? 0}, seconds: ${x.seconds ?? 3} },`).join('\n')}\n    ],`);
    }
    return `  {\n${bits.join('\n')}\n  },`;
  }).join('\n');

  const acts = (f.acts ?? []).map((a) =>
    `    {\n      name: ${q(a.name)}, fromBeat: ${a.fromBeat}, toBeat: ${a.toBeat},\n` +
    `      text: ${q(a.text)},\n` +
    `      styles: ${JSON.stringify(a.styles ?? [])},\n` +
    `      negativeStyles: ${JSON.stringify(a.negativeStyles ?? [])},\n    },`).join('\n');

  return `// The film of \`${id}\` — the editorial layer, and nothing else.
//
// Generated by scripts/film/write-script.mjs (gpt-5.6-terra, which SAW the
// frames). Hand-edit freely: this file is the source of truth from here on and
// is only regenerated when \`film.mjs\` is run with --rewrite.
//
// PACING IS WORD COUNT. Every shot lasts exactly as long as its line takes to
// say, measured from the real voice alignment — there is deliberately no
// seconds knob. To hold a beat longer, give it more to say. \`hold\` applies
// only to a shot whose narration is empty.
export default {
  title: ${q(f.title)},
  endCard: ${q(f.endCard)},

  score: {
    prompt: ${q(f.scorePrompt)},
    acts: [
${acts}
    ],
  },

  shots: [
${shots}
  ],
};
`;
}
