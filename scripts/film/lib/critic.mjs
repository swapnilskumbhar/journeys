// The critic: what is wrong with this journey, and what would fix it.
//
// ============================================================================
// THIS IS THE OPPOSITE OF `reviewer.mjs`, AND THAT IS THE POINT
// ============================================================================
// `reviewer.mjs` is BLIND by construction. It is handed a directory of numbered
// frames and nothing else, because the question it answers — "does the picture
// show what the copy claims?" — is destroyed the moment the reviewer can read
// the caption. Blindness there is enforced by what the request contains.
//
// This asks a different question: "how do I make it better?" That one is
// UNANSWERABLE blind. A critic that cannot see `layers.js` can tell you the
// spacecraft reads as a white lozenge; it cannot tell you that the lozenge is
// `vehicle`'s `capsule` sphere-cap and that the boom is a launch-escape `tower`
// pressed into service, which is the actual finding. So the critic gets the
// frames AND the beat headings AND the source, and its output is prescriptive.
//
// Keeping these two as separate tools is deliberate. One shared "review" that
// sometimes sees the source would silently forfeit the blindness guarantee that
// `shots.mjs --blind` and this repo's whole anti-caption discipline exist to
// protect.
//
// ============================================================================
// COST
// ============================================================================
// One bounded call, like the reviewer. The levers, in order of how much they
// actually save:
//
//   1. FRAME SUBSET. Tokens scale with images (~1,700 each). Critiquing the
//      four beats where the spacecraft is the subject costs an eighth of
//      critiquing all thirty-two, and answers the same question.
//   2. SOURCE SUBSET. Whole `layers.js` files here run past 2,000 lines.
//   3. `effort`. medium is the default; high roughly doubles output tokens.
//
// The estimate is printed BEFORE the request and `--max-usd` refuses to send,
// rather than reporting an overspend afterwards.
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { ask, imagePart, textPart } from './openai.mjs';
import { run } from './ffmpeg.mjs';

// Same width the director uses, for the same reason: the vision encoder tiles
// and downsamples anyway, so full resolution buys nothing but upload time — and
// a large upload fails as an unexplained timeout, not as "too large".
const CRITIC_WIDTH = 768;

// Rough, and only used for the pre-flight estimate and the budget refusal.
const TOK_PER_IMAGE = 1700;
const CHARS_PER_TOK = 3.7;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'findings', 'strengths'],
  properties: {
    verdict: {
      type: 'string',
      description: 'Two or three sentences: what is the single biggest thing holding this back?',
    },
    strengths: {
      type: 'array',
      description: 'What is already working and must NOT be broken by a fix. Be specific.',
      items: { type: 'string' },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'severity', 'subsystem', 'frames', 'diagnosis', 'evidence', 'fix', 'archetypeGap', 'effort'],
        properties: {
          title: { type: 'string', description: 'One short line. The defect, not the fix.' },
          severity: { type: 'string', description: 'high | medium | low' },
          subsystem: {
            type: 'string',
            description: 'model | composition | lighting | scale | colour | pacing | camera | copy',
          },
          frames: {
            type: 'array',
            description: 'Which supplied frame filenames show this. Empty if it is a source-only finding.',
            items: { type: 'string' },
          },
          diagnosis: {
            type: 'string',
            description: 'WHY it looks wrong. Name the mechanism, not the symptom.',
          },
          evidence: {
            type: 'string',
            description: 'What in the pixels or in the source supports this. Quote the source line if you have it.',
          },
          fix: {
            type: 'string',
            description: 'A concrete change. Name the file, the symbol, and the actual values or geometry you would use. "Improve the model" is a failed answer.',
          },
          archetypeGap: {
            type: 'boolean',
            description: 'True if no existing archetype can express this and a NEW reusable archetype is the honest fix, rather than tuning parameters.',
          },
          effort: { type: 'string', description: 'small | medium | large' },
        },
      },
    },
  },
};

const INSTRUCTIONS = `You are an unusually good technical art director reviewing one scene from a
procedural 3D piece. You are shown rendered frames and the source that produced
them. Your job is to find what is WRONG and say precisely what would fix it.

The project's rules, which constrain every fix you propose:

  · Everything is procedural. There are no external 3D assets, ever, and no
    textures loaded from disk. Geometry and shading come from code.
  · Content is DATA. A journey declares beats and layers; a shared library of
    reusable "archetypes" draws them. A fix that adds bespoke Three.js to one
    journey's folder is the wrong fix. If a subject genuinely cannot be
    expressed by any existing archetype, say so by setting archetypeGap — a new
    REUSABLE archetype is a legitimate and expected answer, and is much better
    than bending one that does not fit.
  · Nothing writes a world-space position directly. Real quantities are declared
    in metres and converted every frame.
  · The camera is a pure function of the scroll position. It is handed no clock.
    Idle motion belongs to the layers.

How to be useful here:

  · NAME THE MECHANISM. "The spacecraft looks bad" is worthless. "The high-gain
    antenna is a sphere cap with no rim, no feed horn and no support struts, so
    at any angle it reads as a bowl rather than as a dish" is actionable.
  · CHECK THE SOURCE AGAINST THE PICTURE. Frequently the defect is that a
    parameter was pressed into service for something it was not built for. The
    source will show you that and the picture alone will not.
  · BE CONCRETE IN fix. Name the file and the symbol. Give actual numbers,
    proportions or geometry where you can.
  · SEPARATE "this is under-built" from "this is badly tuned". They have
    completely different fixes and confusing them wastes a whole round.
  · SAY WHAT IS ALREADY GOOD, in strengths, and mean it. The next agent will
    edit this code and needs to know what not to break.
  · Do not invent findings to look thorough. A short, correct, high-severity
    list is worth more than twenty observations.

Judge only what you can see or read. Do not comment on factual accuracy of the
subject matter unless the source itself contradicts the picture.`;

/**
 * Critique a set of frames against the source that produced them.
 *
 * Unlike `blindReview`, this deliberately DOES take context: the whole value is
 * in the model being able to connect a pixel to the line that drew it.
 */
export async function critique({
  frames = [],          // [{ file, label }]
  sources = [],         // [{ path, text }]
  focus = '',
  workDir,
  ledger = null,
  stage = 'critique',
  effort = 'medium',
  maxUsd = null,
  log = console.log,
}) {
  if (!frames.length && !sources.length) throw new Error('critique needs frames or sources');
  if (workDir) mkdirSync(workDir, { recursive: true });

  const content = [];
  if (focus) {
    content.push(textPart(
      `THE SPECIFIC COMPLAINT TO INVESTIGATE:\n${focus}\n\n` +
      `Start there. Report other findings only if they are at least as serious.`,
    ));
  }

  let srcChars = 0;
  if (sources.length) {
    content.push(textPart(`\n=== SOURCE (${sources.length} file${sources.length > 1 ? 's' : ''}) ===`));
    for (const s of sources) {
      const block = `\n--- ${s.path} ---\n${s.text}`;
      srcChars += block.length;
      content.push(textPart(block));
    }
  }

  let payloadBytes = 0;
  if (frames.length) {
    content.push(textPart(`\n=== ${frames.length} RENDERED FRAMES ===`));
    for (const f of frames) {
      const small = join(workDir, `crit-${basename(f.file).replace(/\.\w+$/, '')}.jpg`);
      if (!existsSync(small)) {
        run(['-i', f.file, '-vf', `scale=${CRITIC_WIDTH}:-2`, '-q:v', '4', small], 'shrink frame');
      }
      payloadBytes += statSync(small).size;
      content.push(textPart(`\n--- ${basename(f.file)} ---${f.label ? `\n${f.label}` : ''}`));
      content.push(imagePart(small, 'image/jpeg'));
    }
  }

  // --- pre-flight -----------------------------------------------------------
  // Printed and CHECKED before sending. `wouldExceed` after the fact is a
  // receipt, not a budget.
  const estIn = frames.length * TOK_PER_IMAGE + Math.ceil((srcChars + INSTRUCTIONS.length) / CHARS_PER_TOK);
  const estOut = 6000;
  const estUsd = (estIn / 1e6) * 2.5 + (estOut / 1e6) * 15;
  const mb = (payloadBytes * 1.37) / 1048576; // base64 inflates by ~4/3

  log(`critic: ${frames.length} frames, ${sources.length} source files (${Math.round(srcChars / 1000)}k chars), effort=${effort}`);
  log(`  payload ~${mb.toFixed(1)} MB · est. ~${estIn.toLocaleString('en-US')} input tokens · est. ~$${estUsd.toFixed(3)}`);
  if (mb > 20) log(`  WARNING: ${mb.toFixed(0)} MB risks an upload timeout — cut frames`);
  if (maxUsd != null && estUsd > maxUsd) {
    throw new Error(
      `estimated $${estUsd.toFixed(3)} exceeds --max-usd=${maxUsd}. ` +
      `Cut frames with --beats=, cut source with --src=, or lower --effort.`,
    );
  }

  const { json, usage, polls } = await ask({
    instructions: INSTRUCTIONS,
    content,
    schema: SCHEMA,
    schemaName: 'critique',
    effort,
    maxTokens: 32000,
    log,
  });
  if (ledger) {
    ledger.openai(stage, usage, 'critique');
    if (polls) ledger.polls(stage, polls);
  }
  return json;
}

const RANK = { high: 0, medium: 1, low: 2 };

/** Terminal summary. Worst first — that is the order they get fixed in. */
export function formatCritique(c) {
  const lines = [];
  lines.push(`  VERDICT  ${wrap(c.verdict, 4)}`);
  lines.push('');
  const rows = [...(c.findings ?? [])].sort((a, b) => (RANK[a.severity] ?? 3) - (RANK[b.severity] ?? 3));
  for (const [i, f] of rows.entries()) {
    const mark = f.severity === 'high' ? '██' : f.severity === 'medium' ? '▓▓' : '░░';
    lines.push(`  ${mark} ${String(i + 1).padStart(2)}. ${f.title}`);
    lines.push(`        ${f.subsystem} · ${f.effort} effort${f.archetypeGap ? ' · ARCHETYPE GAP' : ''}${f.frames?.length ? ` · ${f.frames.join(' ')}` : ''}`);
    lines.push(`        why  ${wrap(f.diagnosis, 13)}`);
    lines.push(`        fix  ${wrap(f.fix, 13)}`);
    lines.push('');
  }
  if (c.strengths?.length) {
    lines.push('  DO NOT BREAK');
    for (const s of c.strengths) lines.push(`    · ${wrap(s, 6)}`);
  }
  return lines.join('\n');
}

/**
 * The fix brief, for whoever applies it — an agent, or a person. Deliberately
 * plain text and self-contained: an agent handed this should not need to
 * re-derive the findings from a JSON file it may or may not read.
 */
export function fixBrief(id, c, jsonPath) {
  const rows = [...(c.findings ?? [])].sort((a, b) => (RANK[a.severity] ?? 3) - (RANK[b.severity] ?? 3));
  const lines = [];
  lines.push(`Rework the \`${id}\` journey against the findings below.`);
  lines.push('');
  lines.push(`A technical art director reviewed the rendered frames alongside the source.`);
  lines.push(`Full JSON, including per-finding evidence: ${jsonPath}`);
  lines.push('');
  lines.push(`VERDICT`);
  lines.push(`  ${c.verdict}`);
  lines.push('');
  lines.push(`FINDINGS, worst first`);
  for (const [i, f] of rows.entries()) {
    lines.push('');
    lines.push(`${i + 1}. [${f.severity}] ${f.title}`);
    lines.push(`   subsystem : ${f.subsystem}${f.archetypeGap ? '  (ARCHETYPE GAP — a new reusable archetype is the honest fix)' : ''}`);
    if (f.frames?.length) lines.push(`   frames    : ${f.frames.join(', ')}`);
    lines.push(`   diagnosis : ${f.diagnosis}`);
    lines.push(`   evidence  : ${f.evidence}`);
    lines.push(`   fix       : ${f.fix}`);
  }
  if (c.strengths?.length) {
    lines.push('');
    lines.push(`DO NOT BREAK THESE`);
    for (const s of c.strengths) lines.push(`  · ${s}`);
  }
  lines.push('');
  lines.push(`RULES`);
  lines.push(`  · Read CLAUDE.md and the journey-craft skill first.`);
  lines.push(`  · An archetypeGap finding means adding a REUSABLE archetype under`);
  lines.push(`    src/archetypes/, not bespoke Three.js in the journey folder. Rule 2.`);
  lines.push(`  · Touching src/archetypes or src/engine obliges you to run the gate with`);
  lines.push(`    --sweep, because every other journey shares them.`);
  lines.push('');
  lines.push(`DONE IS AN EXIT CODE`);
  lines.push(`  node scripts/journey-gate.mjs ${id}          # the verdict`);
  lines.push(`  node scripts/journey-gate.mjs ${id} --quick  # the fast loop while iterating`);
  lines.push(`  node scripts/critique.mjs ${id} --diff       # did the findings actually go?`);
  return lines.join('\n');
}

/**
 * What changed between two critiques. Same reason the reviewer has one: after a
 * fix round, "gone" and "not mentioned this time" read identically in prose and
 * are completely different facts.
 */
export function diffCritiques(before, after) {
  const key = (f) => `${f.subsystem}|${f.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 48)}`;
  const a = new Map((before.findings ?? []).map((f) => [key(f), f]));
  const b = new Map((after.findings ?? []).map((f) => [key(f), f]));
  return {
    fixed: [...a.keys()].filter((k) => !b.has(k)).map((k) => a.get(k)),
    remaining: [...a.keys()].filter((k) => b.has(k)).map((k) => b.get(k)),
    introduced: [...b.keys()].filter((k) => !a.has(k)).map((k) => b.get(k)),
  };
}

function wrap(s, indent) {
  const width = 92 - indent;
  const pad = ' '.repeat(indent);
  const out = [];
  let line = '';
  for (const word of String(s ?? '').split(/\s+/)) {
    if ((line + ' ' + word).trim().length > width) { out.push(line.trim()); line = word; }
    else line += ' ' + word;
  }
  if (line.trim()) out.push(line.trim());
  return out.join(`\n${pad}`);
}
