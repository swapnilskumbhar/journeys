// The blind reviewer, as an API call instead of an agent.
//
// ============================================================================
// WHY THIS EXISTS
// ============================================================================
// `journey-blind-reviewer` is a Claude subagent, and a subagent review is an
// UNBOUNDED transcript: images enter its context, it reasons across many
// turns, the accumulated context is re-sent every turn, and it may re-capture
// frames mid-run. The bill scales with how long it thinks, and you cannot know
// it in advance. A single schema'd call over the same frames is bounded — one
// request, one measured token count, one line in the ledger.
//
// Two things improve as a side effect, and they matter more than the money:
//
//   1. BLINDNESS BECOMES ENFORCED RATHER THAN REQUESTED. With a subagent you
//      are trusting it not to open the key file sitting next to the frames.
//      Here you control byte-for-byte what goes into the request: numbered
//      images and nothing else. This repo's own rule is that restricting what
//      the reviewer CAN know is the mechanism and asking it to be objective is
//      not — an API call is the stronger version of that rule.
//
//   2. FINDINGS BECOME DIFFABLE. The honest question after a fix round is
//      "did that finding actually go away, or did the reviewer just not
//      mention it this time?" A prose review cannot answer it. A stable
//      schema written to review.json can, by diffing two runs.
//
// What it deliberately does NOT do: judge whether the content is TRUE. That
// needs web access and belongs to an agent that has it.
import { readFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { ask, imagePart, textPart } from './openai.mjs';
import { run } from './ffmpeg.mjs';

// Width the reviewer actually sees. Same number and same reasoning as
// write-script.mjs's DIRECTOR_WIDTH.
const REVIEW_WIDTH = 768;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['frames', 'overall'],
  properties: {
    frames: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['frame', 'describe', 'legible', 'findings'],
        properties: {
          frame: { type: 'string', description: 'The filename, exactly as given.' },
          describe: {
            type: 'string',
            description: 'What a stranger would say is in this image. Name shapes and colours, not concepts.',
          },
          legible: {
            type: 'integer',
            description: '0 = nothing identifiable, 1 = a shape but no subject, 2 = a subject is readable, 3 = clearly a specific thing.',
          },
          findings: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['severity', 'category', 'detail'],
              properties: {
                severity: { type: 'string', description: 'high | medium | low' },
                category: {
                  type: 'string',
                  description: 'empty | occluded | washed-out | too-dark | ambiguous | duplicate-of-neighbour | composition',
                },
                detail: { type: 'string' },
              },
            },
          },
        },
      },
    },
    overall: { type: 'string', description: 'Two or three sentences on the set as a whole.' },
  },
};

const INSTRUCTIONS = `You are shown a series of numbered images. They are frames from a rendered 3D
piece, and every caption, heading and readout has been removed.

Your job is to say WHAT A STRANGER WOULD SEE, and nothing else.

You have not been told what these frames are supposed to show, and you must not
guess. Do not infer a subject from the filename, the ordering, or from what
would be thematically likely. If an image is a bright smudge on black, the
honest answer is "a bright smudge on black" — not "a galaxy". Writing "a
galaxy" when you cannot actually see one is the single failure this review
exists to prevent, and it is the reason you were not given the captions.

For each frame:
  · describe  — shapes, colours, arrangement, apparent scale. Concrete nouns
                only where you can genuinely identify the object.
  · legible   — 0 nothing identifiable / 1 a shape but no subject / 2 a subject
                is readable / 3 clearly a specific identifiable thing.
  · findings  — only real problems. An empty list is a valid and useful answer;
                do not invent a finding to look thorough.

Report a frame as duplicate-of-neighbour only when it is genuinely near
identical to the frame before it, not merely similar in style.

Judge only what is in the pixels. Do not comment on whether the content is
factually correct — you have no way to know that here, and something else
checks it.`;

/**
 * Review a directory of numbered frames.
 *
 * Takes the DIRECTORY and nothing else. No headings, no script, no key file —
 * the caller must not be able to leak context in by accident, so there is
 * deliberately no parameter through which it could.
 */
export async function blindReview({ dir, ledger = null, stage = 'review', effort = 'medium', log = console.log }) {
  if (!existsSync(dir)) throw new Error(`no frames at ${dir}`);
  const files = readdirSync(dir)
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort();
  if (!files.length) throw new Error(`no images in ${dir}`);

  // Shrink before sending, for the reason write-script.mjs already documents:
  // undici's headers timeout starts at the first byte UPLOADED, so an oversized
  // body fails as a bare `fetch failed` minutes later with nothing to
  // distinguish it from a network fault. A four-second sample of a 5m43s film
  // is 86 frames at ~300 kB each — a 35 MB body, and it timed out exactly
  // there. Nothing is lost: the vision encoder tiles and downsamples anyway,
  // and legibility at 768px is the question being asked in the first place.
  // SIBLING of the frames directory, never inside it: `--via=agent` hands that
  // directory to a subagent, and it must contain the frames and nothing else.
  const small = resolve(dir, '..', `${basename(dir)}-send`);
  mkdirSync(small, { recursive: true });
  let bytes = 0;
  const content = [textPart(`${files.length} frames follow, in order.`)];
  for (const f of files) {
    const shrunk = join(small, `${f.replace(/\.[^.]+$/, '')}.jpg`);
    // THE CACHE IS KEYED ON THE FRAME, NOT ON ITS NAME. `!existsSync(shrunk)`
    // alone is the same defect `review.mjs`'s own provenance guard was written
    // against, one layer further down: that guard checks the FRAMES against the
    // artefact, and is satisfied by a fresh capture — but the capture writes
    // `beat-23.png` over `beat-23.png`, so this sibling directory still held
    // yesterday's JPEG and the model was shown the journey as it was before the
    // fix. It came back describing a parachute that had been replaced, scored
    // it, and diffed it, and every number in that report was about a build that
    // no longer existed. Re-shrink whenever the source is newer.
    if (!existsSync(shrunk) || statSync(join(dir, f)).mtimeMs > statSync(shrunk).mtimeMs) {
      run(['-i', join(dir, f), '-vf', `scale=${REVIEW_WIDTH}:-2`, '-q:v', '4', '-y', shrunk], 'shrink frame');
    }
    bytes += statSync(shrunk).size;
    content.push(textPart(`\n--- ${f} ---`));
    content.push(imagePart(shrunk, 'image/jpeg'));
  }

  const mb = (bytes * 1.37) / 1048576; // base64 inflates by ~4/3
  log(`blind review: ${files.length} frames at ${REVIEW_WIDTH}px (~${mb.toFixed(1)} MB payload), effort=${effort}`);
  if (mb > 20) log(`  WARNING: ${mb.toFixed(0)} MB is large enough to risk an upload timeout`);
  const { json, usage, polls } = await ask({
    instructions: INSTRUCTIONS,
    content,
    schema: SCHEMA,
    schemaName: 'blind_review',
    effort,
    maxTokens: 32000,
    log,
  });
  if (ledger) {
    ledger.openai(stage, usage, 'blind review');
    if (polls) ledger.polls(stage, polls);
  }
  return json;
}

/**
 * What changed between two reviews. This is the whole reason the findings are
 * structured: after a fix round, "gone" and "not mentioned this time" look
 * identical in prose and are completely different facts.
 */
export function diffReviews(before, after) {
  const key = (frame, f) => `${frame}|${f.category}`;
  const setOf = (r) => new Set((r.frames ?? []).flatMap((fr) => (fr.findings ?? []).map((f) => key(fr.frame, f))));
  const a = setOf(before);
  const b = setOf(after);
  return {
    fixed: [...a].filter((k) => !b.has(k)),
    remaining: [...a].filter((k) => b.has(k)),
    introduced: [...b].filter((k) => !a.has(k)),
  };
}

/** Terminal summary. Worst frames first — that is the order they get fixed in. */
export function formatReview(review) {
  const lines = [];
  const rows = [...(review.frames ?? [])].sort((x, y) => x.legible - y.legible);
  for (const fr of rows) {
    const flags = (fr.findings ?? []).map((f) => `${f.severity[0].toUpperCase()}:${f.category}`).join(' ');
    lines.push(`  ${'▁▃▆█'[Math.max(0, Math.min(3, fr.legible))]} ${fr.frame.padEnd(16)} ${fr.describe.slice(0, 78)}`);
    if (flags) lines.push(`      ${flags}`);
    for (const f of fr.findings ?? []) lines.push(`      · ${f.detail}`);
  }
  const unreadable = rows.filter((f) => f.legible <= 1).length;
  lines.push('');
  lines.push(`  ${unreadable}/${rows.length} frames scored 0-1 (no readable subject)`);
  lines.push(`  ${review.overall}`);
  return lines.join('\n');
}
