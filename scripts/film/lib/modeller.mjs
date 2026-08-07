// The modeller: a bounded loop that LOOKS at a frame, EDITS the source that
// drew it, rebuilds, and looks again.
//
// ============================================================================
// WHY THIS EXISTS ALONGSIDE critic.mjs AND reviewer.mjs
// ============================================================================
// This repo already has two bounded single-call tools:
//
//   reviewer.mjs  BLIND     frames only          "does the picture show what
//                                                 the copy claims?"
//   critic.mjs    INFORMED  frames + source      "how would I fix this?"
//
// Both are read-only, and `CLAUDE.md` recorded the reason: "Creation stays
// agent-backed, and that asymmetry is real. Building a journey is an
// edit → gate → read-failure → edit loop, and one API call cannot run one."
//
// That is still true of a JOURNEY. It is NOT true of a MODEL. An archetype is
// a self-contained artefact whose whole quality is visible in one rendered
// frame, so the loop a journey needs an agent for is small enough to be a
// script: edit → build → capture → look → edit. This module is that loop.
//
// The asymmetry it preserves: this tool may only touch files it was explicitly
// handed on the command line. It cannot wander the repo, cannot restage a
// journey, and cannot decide what to work on. The scope is the operator's; the
// craft inside that scope is the model's.
//
// ============================================================================
// WHY EDITS ARE SEARCH/REPLACE AND NOT WHOLE FILES
// ============================================================================
// `cruise-stage.js` and `layers.js` run past a thousand lines. Asking for a
// whole-file rewrite costs those tokens on OUTPUT (6x the input rate) every
// round, and — worse — invites the model to silently drop the parts it was not
// thinking about. An exact-match anchor cannot delete what it does not name.
//
// The cost of that choice is that a `find` string which does not match, or
// matches twice, is a failed edit. Those are NOT swallowed: they are collected
// and fed back verbatim on the next round, which is the single most effective
// thing in this file. A model that is told "your anchor matched 2 places" fixes
// it immediately; one that is told nothing repeats it forever.
//
// ============================================================================
// SAFETY
// ============================================================================
//   · Only `--files` may be written. A path outside that set is refused.
//   · Every writable file is backed up before the first edit and RESTORED if
//     the build breaks and the model cannot repair it within its rounds.
//   · The build runs after every round. A round that does not compile is not
//     allowed to become the base for the next one.
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join, basename, resolve, relative } from 'node:path';
import { ask, imagePart, textPart } from './openai.mjs';
import { run } from './ffmpeg.mjs';

const WIDTH = 768;
const TOK_PER_IMAGE = 1700;
const CHARS_PER_TOK = 3.7;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reading', 'plan', 'edits', 'writes', 'done', 'remaining'],
  properties: {
    reading: {
      type: 'string',
      description:
        'What you actually SEE in the supplied frames, before deciding anything. Name the objects as a stranger would. If a frame does not show the defect described, say so.',
    },
    plan: {
      type: 'string',
      description: 'Two or three sentences: the mechanism you are changing and why it fixes the reading.',
    },
    edits: {
      type: 'array',
      description:
        'Exact-anchor edits to existing files. `find` MUST appear EXACTLY ONCE in the current file, byte for byte including indentation. Prefer several small anchored edits over one huge one.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'find', 'replace', 'why'],
        properties: {
          path: { type: 'string', description: 'Repo-relative path. Must be one of the writable files.' },
          find: { type: 'string', description: 'Exact text to locate. Must be unique in the file.' },
          replace: { type: 'string', description: 'Replacement text.' },
          why: { type: 'string', description: 'One line. What this changes about the picture.' },
        },
      },
    },
    writes: {
      type: 'array',
      description:
        'Whole-file writes. Use ONLY for creating a new file, or when an edit would rewrite most of one. Contents must be complete and runnable.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'contents', 'why'],
        properties: {
          path: { type: 'string' },
          contents: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
    done: {
      type: 'boolean',
      description:
        'True only if the frames you were just shown already look right and you are making no further changes. Never true on a round where you returned edits.',
    },
    remaining: {
      type: 'string',
      description: 'What is still wrong that you did not fix, and why. Empty string if nothing.',
    },
  },
};

const INSTRUCTIONS = `You are an unusually good technical artist working directly in the source of a
procedural 3D renderer. You are shown rendered frames and the code that drew
them, and you EDIT that code. Then you are shown the result and you edit again.

The single test that matters: cover the caption, show the frame to a stranger,
and ask what the object is. "Some vertical bars", "a table lamp", "a white
tube", "a wooden plate" all mean the model is wrong, and no amount of colour or
lighting tuning will save it. Change the GEOMETRY.

The project's rules, which constrain every change you make:

  · Everything is procedural. No external assets, no loaded textures, ever.
    Geometry and shading come from code.
  · Content is DATA. A journey declares beats and layers; a shared library of
    reusable "archetypes" under src/archetypes/ draws them. Never add bespoke
    Three.js to a journey folder. If a subject cannot be expressed by any
    existing archetype, the honest fix is a NEW REUSABLE archetype.
  · Nothing writes a world-space position. Real quantities are declared in
    metres and converted through rebase.toWorld() every frame. Sizes are
    fractions of a span, not absolutes.
  · DETERMINISM. Layers receive a virtual clock \`t\`, and may use it for idle
    motion that is genuinely continuous — flame, flowing gas, drifting dust
    close to the camera. They must NOT use it for anything a viewer would
    expect to be static: a celestial structure, a deployed panel's angle, an
    inflation state, a discarded object's pose. Those are functions of \`u\`, the
    scroll position. If in doubt, use \`u\`.
  · The camera receives NO clock at all. Do not add one.
  · Geometry is built ONCE at construction and updated by transform. A
    per-frame function passed where a constructor expects a number produces NaN
    vertices and a silent failure.
  · The shaders live in JS template literals. A BACKTICK inside a GLSL comment
    ends the literal early and breaks the file hundreds of lines below. Never
    write one.

On making things look real:

  · Silhouette first. What names an object is its outline and the holes in it.
    A launch tower is mostly gaps; a dish is named by its feed struts; a
    parachute is named by its gores, its vent hole and its shroud lines.
  · Asymmetry reads as engineering. Perfect radial symmetry reads as a
    decoration — concentric rings on a disc become a dartboard, not a machine.
  · Two faces of one object should differ. A hull's outside is not its inside.
  · Small hard bright sources may clip. Wide soft ones never may.

Return edits as EXACT-ANCHOR search/replace. Every \`find\` must appear exactly
once in the file as given to you, byte for byte, including leading whitespace.
If you are told an anchor failed, that is your mistake to correct, not the
tool's — re-read the source you were given and pick a longer, unique anchor.

Change only what you were asked to change. Do not reformat, do not rename, and
do not "improve" code that is working — a passing measured gate is protecting
things you cannot see in these frames.`;

// LINE ENDINGS ARE NOT PART OF THE ANCHOR, and pretending otherwise cost a
// whole three-round run. Every source file in this repo is CRLF; a language
// model emits "\n". A single-line anchor therefore matches and a MULTI-LINE one
// can never match, which produces the most misleading failure this tool can
// give: a few edits land, the build stays green, and twenty "anchor not found"
// reports blame the model for quoting the file wrong when it quoted it exactly.
// One run failed 20 of 21 edits this way with the model correcting itself
// harder each round — the feedback loop actively made it worse, because the
// advice ("pick a longer, unique anchor") means "add more newlines".
//
// So matching happens in LF space, always, on both sides.
const toLF = (s) => s.replace(/\r\n/g, '\n');
/** True if the file is predominantly CRLF, so it can be written back as it was. */
const isCRLF = (s) => (s.match(/\r\n/g)?.length ?? 0) > s.split('\n').length / 2;
const toCRLF = (s) => s.replace(/\r?\n/g, '\r\n');

/** Apply one search/replace, insensitive to line-ending style. */
function applyEdit(text, find, replace) {
  const hay = toLF(text);
  const needle = toLF(find);
  const first = hay.indexOf(needle);
  if (first === -1) return { text, err: 'anchor not found' };
  const second = hay.indexOf(needle, first + 1);
  if (second !== -1) return { text, err: 'anchor matched more than once — use a longer, unique anchor' };
  // Return LF text; the caller restores the file's original style on write.
  return { text: hay.slice(0, first) + toLF(replace) + hay.slice(first + needle.length), err: null };
}

/**
 * One round: show the frames and the current source, get edits, apply them.
 * Returns { json, applied, failures, usage }. Does NOT build — the caller owns
 * the build so it can decide what a broken build means.
 */
export async function modelRound({
  frames = [],
  writable,          // Map<repoRelativePath, absPath>
  references = [],   // [{path, text}] — READ-ONLY. Research the model cannot do itself.
  focus,
  feedback = '',     // anchor failures / build errors from the previous round
  round,
  rounds,
  workDir,
  effort = 'high',
  maxUsd = null,
  ledger = null,
  stage = 'model',
  dryRun = false,
  log = console.log,
}) {
  if (workDir) mkdirSync(workDir, { recursive: true });

  const content = [];

  content.push(textPart(
    `ROUND ${round} OF ${rounds}.\n\n` +
    `THE COMPLAINT YOU ARE FIXING:\n${focus}\n`,
  ));

  if (feedback) {
    content.push(textPart(
      `\n=== RESULT OF YOUR PREVIOUS ROUND — READ THIS FIRST ===\n${feedback}\n` +
      `Fix these before anything else. The source below is the CURRENT state, ` +
      `including any edits of yours that did apply.`,
    ));
  }

  let srcChars = 0;

  // Reference goes BEFORE the source, so the model reads what the real object
  // looks like before it reads the code that got it wrong.
  if (references.length) {
    content.push(textPart(
      `\n=== REFERENCE — READ-ONLY (${references.length}) ===\n` +
      `Real-world research on the hardware you are modelling, gathered for you ` +
      `because you have no web access. Treat it as ground truth about how the ` +
      `real objects are built and proportioned. You may NOT edit these files.`,
    ));
    for (const r of references) {
      const block = `\n--- ${r.path} (reference) ---\n${r.text}`;
      srcChars += block.length;
      content.push(textPart(block));
    }
  }

  content.push(textPart(`\n=== FILES YOU MAY EDIT (${writable.size}) ===`));
  for (const [rel, abs] of writable) {
    const text = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
    const block = `\n--- ${rel} ---\n${text || '(does not exist yet — use `writes` to create it)'}`;
    srcChars += block.length;
    content.push(textPart(block));
  }

  let payloadBytes = 0;
  if (frames.length) {
    content.push(textPart(`\n=== ${frames.length} RENDERED FRAMES (current build) ===`));
    for (const f of frames) {
      const small = join(workDir, `r${round}-${basename(f.file).replace(/\.\w+$/, '')}.jpg`);
      // Keyed on the round, so a re-render is never reviewed through a cached
      // copy of the previous one. `reviewer.mjs` cached on filename alone and
      // spent a full review describing a build that no longer existed.
      run(['-y', '-i', f.file, '-vf', `scale=${WIDTH}:-2`, '-q:v', '4', small], 'shrink frame');
      payloadBytes += statSync(small).size;
      content.push(textPart(`\n--- ${basename(f.file)} ---${f.label ? `\n${f.label}` : ''}`));
      content.push(imagePart(small, 'image/jpeg'));
    }
  }

  const estIn = frames.length * TOK_PER_IMAGE + Math.ceil((srcChars + INSTRUCTIONS.length) / CHARS_PER_TOK);
  const estOut = 12000;
  const estUsd = (estIn / 1e6) * 2.5 + (estOut / 1e6) * 15;
  const mb = (payloadBytes * 1.37) / 1048576;

  log(`  round ${round}/${rounds}: ${frames.length} frames, ${Math.round(srcChars / 1000)}k chars of source, effort=${effort}`);
  log(`    payload ~${mb.toFixed(1)} MB · est. ~${estIn.toLocaleString('en-US')} in · ~$${estUsd.toFixed(3)}`);
  if (mb > 20) log(`    WARNING: ${mb.toFixed(0)} MB risks an upload timeout — cut frames`);
  if (maxUsd != null && estUsd > maxUsd) {
    throw new Error(
      `estimated $${estUsd.toFixed(3)} exceeds --max-usd=${maxUsd}. ` +
      `Cut frames with --beats=, cut source with --files=, or lower --effort.`,
    );
  }
  if (dryRun) {
    log('    --dry-run: not sending');
    return { json: null, applied: [], failures: [], dry: true };
  }

  const { json, usage, polls } = await ask({
    instructions: INSTRUCTIONS,
    content,
    schema: SCHEMA,
    schemaName: 'model_edit',
    effort,
    maxTokens: 48000,
    log,
  });
  if (ledger) {
    ledger.openai(stage, usage, `model round ${round}`);
    if (polls) ledger.polls(stage, polls);
  }

  // --- apply ----------------------------------------------------------------
  const applied = [];
  const failures = [];

  for (const w of json.writes ?? []) {
    const abs = writable.get(w.path);
    if (!abs) { failures.push(`WRITE REFUSED ${w.path}: not in --files`); continue; }
    writeFileSync(abs, w.contents, 'utf8');
    applied.push(`wrote ${w.path} (${w.contents.split('\n').length} lines) — ${w.why}`);
  }

  // Group by file so several anchors into one file see each other's results.
  const byFile = new Map();
  for (const e of json.edits ?? []) {
    if (!byFile.has(e.path)) byFile.set(e.path, []);
    byFile.get(e.path).push(e);
  }
  for (const [rel, list] of byFile) {
    const abs = writable.get(rel);
    if (!abs) { failures.push(`EDIT REFUSED ${rel}: not in --files`); continue; }
    let text = readFileSync(abs, 'utf8');
    const wasCRLF = isCRLF(text);
    let n = 0;
    for (const e of list) {
      const { text: next, err } = applyEdit(text, e.find, e.replace);
      if (err) {
        failures.push(
          `EDIT FAILED in ${rel}: ${err}\n` +
          `  anchor was:\n${e.find.split('\n').slice(0, 6).map((l) => `    | ${l}`).join('\n')}`,
        );
        continue;
      }
      text = next; n++;
      applied.push(`${rel}: ${e.why}`);
    }
    // Written back in the style it arrived in. `applyEdit` works in LF space,
    // so without this every edited file would silently convert to LF and show
    // up as a whole-file diff.
    if (n) writeFileSync(abs, wasCRLF ? toCRLF(text) : text, 'utf8');
  }

  return { json, applied, failures };
}

export function formatRound(json, applied, failures) {
  const out = [];
  if (json?.reading) out.push(`    sees: ${wrap(json.reading, 10)}`);
  if (json?.plan) out.push(`    plan: ${wrap(json.plan, 10)}`);
  for (const a of applied) out.push(`      ✓ ${a}`);
  // The first line of a failure names the file and the reason; the anchor is
  // on the lines after it. Printing only the first line is how 35 identical
  // "anchor not found" reports gave the operator nothing to diagnose with
  // across three rounds — the one detail that would have identified the cause
  // in seconds was being sent to the model and withheld from the person.
  for (const f of failures) {
    const [head, ...rest] = f.split('\n');
    out.push(`      ✗ ${head}`);
    for (const line of rest.slice(0, 3)) out.push(`      ${line}`);
  }
  if (json?.remaining) out.push(`    left: ${wrap(json.remaining, 10)}`);
  return out.join('\n');
}

function wrap(s, indent) {
  const width = 92 - indent;
  const pad = ' '.repeat(indent);
  const words = String(s ?? '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (line.length + w.length + 1 > width) { lines.push(line); line = w; }
    else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines.join(`\n${pad}`);
}

/**
 * Back up every writable file. Returns a restore() closure.
 *
 * A file that did NOT exist is recorded as such and DELETED on restore. That
 * matters for the main reason this tool creates files at all — adding a new
 * archetype. Without it, a failed run leaves a half-written archetype on disk
 * that the next run reads back as if it were the starting point, and "restore"
 * silently means "restore everything except the thing you were making".
 */
export function backup(writable, workDir) {
  mkdirSync(workDir, { recursive: true });
  const saved = [];
  for (const [rel, abs] of writable) {
    if (!existsSync(abs)) { saved.push({ abs, bak: null, existed: false }); continue; }
    const bak = join(workDir, `${rel.replace(/[\\/]/g, '__')}.bak`);
    copyFileSync(abs, bak);
    saved.push({ abs, bak, existed: true });
  }
  return () => {
    for (const { abs, bak, existed } of saved) {
      if (existed && bak) copyFileSync(bak, abs);
      else if (!existed && existsSync(abs)) rmSync(abs, { force: true });
    }
  };
}
