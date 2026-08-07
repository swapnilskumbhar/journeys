// Was this journey DESIGNED, or was it typed?
//
//   node scripts/design-lint.mjs <id> [--strict]
//
// `journey-craft` step 1 says: write the design brief before any code, and for
// every beat state WHAT IS ON SCREEN AT THE BEAT'S MIDPOINT. It also says
// skipping that step produced the worst journey in the repo. That instruction
// has been sitting in a skill file being agreed with and not followed, because
// nothing checked.
//
// So this checks. It is deliberately a check on STRUCTURE, not on prose
// quality — no lint can tell you a midpoint sentence is honest. What it can
// tell you is that somebody was made to write one for every beat, which is most
// of the value: the four failing journeys mostly did not have midpoint
// sentences at all, and the two beats-worth that did were the two that worked.
//
// THE BEAT SHEET CONTRACT. DESIGN.md must contain a markdown table whose header
// row names, in any order and any capitalisation, columns matching:
//
//   #          — beat index
//   heading    — must match beats.js exactly, in order
//   midpoint   — what is on screen 45% into the beat, where review samples
//   archetypes — which archetypes draw it (rule 2: no bespoke Three.js)
//   px         — intended on-screen size of the subject at 1440 wide
//   hue        — the beat's dominant colour, for the palette arc
//
// Extra columns are ignored. The table may sit anywhere in the file.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const ids = args.filter((a) => !a.startsWith('--'));
const strict = args.includes('--strict');

const targets = ids.length
  ? ids
  : readdirSync(resolve('src/journeys'), { withFileTypes: true })
      .filter((d) => d.isDirectory()).map((d) => d.name);

// Minimum layer code per beat. See the density law in `journey-craft`:
// measured across the five shipping journeys, lines of layers.js per beat is
// the strongest single predictor of whether a journey is worth scrolling.
// big-bang (the one that works) runs 56; voyager and crust-to-core, the two
// worst, run 13 and 12. This floor sits just under halfway to big-bang — it is
// not a quality target, it is the line under which a journey has demonstrably
// not been built at all.
const MIN_LAYER_LINES_PER_BEAT = 25;

let failed = 0;

for (const id of targets) {
  const problems = [];
  const warnings = [];
  // A whole missing COLUMN produces one complaint per beat, which for a 32-beat
  // journey is 32 identical lines — noise an agent then has to read past to
  // find the one real defect. Per-beat findings are collected by category and
  // collapsed when they affect more than a couple of beats.
  const perBeat = new Map();
  const beatProblem = (cat, i, msg) => {
    if (!perBeat.has(cat)) perBeat.set(cat, { msg, beats: [], fatal: true });
    perBeat.get(cat).beats.push(i + 1);
  };
  const beatWarning = (cat, i, msg) => {
    if (!perBeat.has(cat)) perBeat.set(cat, { msg, beats: [], fatal: false });
    perBeat.get(cat).beats.push(i + 1);
  };
  const dir = resolve('src/journeys', id);
  const designPath = join(dir, 'DESIGN.md');

  if (!existsSync(designPath)) {
    console.log(`\n${id}\n  ✗ no DESIGN.md — the brief is step 1, not documentation written afterwards`);
    failed++;
    continue;
  }

  const md = readFileSync(designPath, 'utf8');
  const { beats } = await import(pathToFileURL(join(dir, 'beats.js')).href);

  // --- the beat sheet ------------------------------------------------------
  const table = findBeatSheet(md);
  if (!table) {
    problems.push(
      'no beat sheet table found. DESIGN.md needs a markdown table with columns\n'
      + '      matching: # | heading | midpoint | archetypes | px | hue',
    );
  } else {
    if (table.rows.length !== beats.length) {
      problems.push(
        `beat sheet has ${table.rows.length} rows, beats.js has ${beats.length} beats — `
        + 'the brief and the build have drifted apart',
      );
    }

    const n = Math.min(table.rows.length, beats.length);
    for (let i = 0; i < n; i++) {
      const row = table.rows[i];
      const where = `beat ${String(i + 1).padStart(2, '0')}`;

      // The heading match is the check that keeps the brief honest over time.
      // A brief that no longer describes the journey is worse than no brief,
      // because it is trusted.
      const declared = norm(row.heading);
      const actual = norm(beats[i].heading);
      if (declared && actual && declared !== actual) {
        problems.push(`${where}: DESIGN.md says "${row.heading}", beats.js says "${beats[i].heading}"`);
      }

      // The midpoint sentence. THE check — this is the one that would have
      // stopped four journeys from being built.
      if (!meaningful(row.midpoint)) {
        beatProblem('midpoint', i, 'no midpoint sentence — what is on screen 45% into this beat?');
      } else if (row.midpoint.trim().length < 25) {
        beatWarning('midpoint-short', i, 'midpoint sentence is very short');
      }

      if (!meaningful(row.archetypes)) {
        beatProblem('archetypes', i, 'no archetypes named — which archetype draws this?');
      }
      if (!meaningful(row.px)) {
        beatProblem('px', i, 'no intended subject size. "visible" is not a bar; state px at 1440 wide');
      }
      if (!meaningful(row.hue)) {
        beatWarning('hue', i, 'no hue given, so the palette arc is unplanned');
      }
    }

    // Palette arc: adjacent eras should differ in hue, not just in content.
    // Advisory, because a genuinely monochrome stretch can be a real choice —
    // but four in a row is how `crust-to-core` became a brown wall.
    const hues = table.rows.map((r) => norm(r.hue)).filter(Boolean);
    let run = 1;
    for (let i = 1; i < hues.length; i++) {
      run = hues[i] === hues[i - 1] ? run + 1 : 1;
      if (run === 4) {
        warnings.push(`beats ${i - 2}–${i + 1}: four consecutive beats share hue "${hues[i]}"`);
      }
    }
  }

  // --- the density budget --------------------------------------------------
  const layersPath = join(dir, 'layers.js');
  if (existsSync(layersPath)) {
    const lines = readFileSync(layersPath, 'utf8').split('\n').length;
    const perBeat = lines / (beats.length || 1);
    if (perBeat < MIN_LAYER_LINES_PER_BEAT) {
      problems.push(
        `density: layers.js is ${lines} lines over ${beats.length} beats = ${perBeat.toFixed(1)}/beat, `
        + `under the ${MIN_LAYER_LINES_PER_BEAT} floor.\n`
        + '      This journey has not been built, it has been sketched. Every beat needs three\n'
        + '      planes (near, mid, far); one archetype per beat is the "object floating in void"\n'
        + '      failure mode by construction.',
      );
    }
  }

  // --- report --------------------------------------------------------------
  // Fold the collapsed per-beat findings in. Three or more beats sharing a
  // finding is a missing column, not three separate mistakes, and reads better
  // as one line naming the range.
  for (const [, v] of perBeat) {
    const line = v.beats.length > 2
      ? `${v.msg}\n      → ${v.beats.length} beats: ${ranges(v.beats)}`
      : v.beats.map((b) => `beat ${String(b).padStart(2, '0')}: ${v.msg}`).join('\n  ' + (v.fatal ? '✗ ' : '! '));
    (v.fatal ? problems : warnings).push(line);
  }

  console.log(`\n${id}`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  for (const w of warnings) console.log(`  ! ${w}`);
  if (!problems.length && !warnings.length) console.log('  ✓ brief is complete');
  else if (!problems.length) console.log(`  ✓ no blocking problems (${warnings.length} advisory)`);

  if (problems.length || (strict && warnings.length)) failed++;
}

console.log(failed ? `\nDESIGN LINT FAIL — ${failed} journey(s)` : '\nDESIGN LINT PASS');
process.exit(failed ? 1 : 0);

// --- parsing ---------------------------------------------------------------
// Finds the first markdown table carrying the required concepts. Matching is by
// KEYWORD rather than by exact header text, so a brief can call the column
// "midpoint frame" or "what's on screen at midpoint" and still be understood —
// the point is to make people write the content, not to make them guess a
// schema.
function findBeatSheet(md) {
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|')) continue;
    const header = cells(lines[i]).map((c) => c.toLowerCase());
    const col = (...keys) => header.findIndex((h) => keys.some((k) => h.includes(k)));

    const idx = {
      heading: col('heading', 'title', 'beat name'),
      midpoint: col('midpoint', 'on screen', 'mid-beat'),
      archetypes: col('archetype', 'layers', 'draws'),
      px: col('px', 'size', 'pixels'),
      hue: col('hue', 'colour', 'color', 'palette'),
    };
    // Needs at least a heading and a midpoint column to be the beat sheet.
    if (idx.heading < 0 || idx.midpoint < 0) continue;

    const rows = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim().startsWith('|')) break;
      const c = cells(line);
      // The |---|---| separator row.
      if (c.every((x) => /^:?-{2,}:?$/.test(x.trim()) || x.trim() === '')) continue;
      rows.push({
        heading: at(c, idx.heading),
        midpoint: at(c, idx.midpoint),
        archetypes: at(c, idx.archetypes),
        px: at(c, idx.px),
        hue: at(c, idx.hue),
      });
    }
    if (rows.length) return { rows };
  }
  return null;
}

function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim());
}
function at(arr, i) { return i >= 0 ? (arr[i] ?? '') : ''; }

// A cell holding "—", "tbd", "?" or similar is not an answer. Briefs get
// written under time pressure and this is where the pressure lands.
function meaningful(s) {
  const t = (s ?? '').trim().toLowerCase();
  if (t.length < 3) return false;
  return !['tbd', 'todo', 'n/a', 'na', '-', '—', '–', '?', '??', 'same', 'as above'].includes(t);
}

function norm(s) {
  return (s ?? '').toLowerCase().replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
}

// [1,2,3,5,6,9] → "1–3, 5–6, 9"
function ranges(ns) {
  const out = [];
  let start = ns[0], prev = ns[0];
  for (const n of ns.slice(1)) {
    if (n === prev + 1) { prev = n; continue; }
    out.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = n;
  }
  out.push(start === prev ? `${start}` : `${start}–${prev}`);
  return out.join(', ');
}
