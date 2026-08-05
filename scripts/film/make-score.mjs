// The score, cut to the film's own acts.
//
// THE WHOLE IDEA: the music changes where the JOURNEY changes. A single
// generated loop laid under a five-minute film is wallpaper; a score whose
// sections begin exactly where the ice giants begin is part of the telling.
//
// The mechanism is `/v1/music/plan`'s section list. We ask the planner for
// global styles (it is good at those), then REPLACE its sections with one per
// act, timed from the solved timeline.
//
// CONSTRAINT, found by probing rather than by reading: a composition plan is
// only accepted by **music_v1**. Posting one with `model_id: music_v2` fails
// 422. music_v2 takes a bare prompt and nothing else — so it sounds better and
// cannot be sectioned. `--score=prompt` picks that trade the other way.
import { writeFileSync } from 'node:fs';
import { musicPlan, composeFromPlan, composeFromPrompt, MUSIC_MAX_MS } from './lib/elevenlabs.mjs';
import { run } from './lib/ffmpeg.mjs';
import { join } from 'node:path';

// Per-section bounds from the API. An act longer than this is split into
// several sections carrying the same styles, which is also musically better
// than one 4-minute block.
const SECTION_MIN_MS = 3000;
const SECTION_MAX_MS = 120_000;

export async function makeScore({ timeline, film, paths, mode = 'plan', dryRun = false, ledger = null, log = console.log }) {
  const totalMs = Math.round(timeline.duration * 1000);

  if (dryRun) {
    run(['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', timeline.duration.toFixed(3), '-c:a', 'libmp3lame', paths.score], 'dry score');
    log(`score: DRY RUN — ${timeline.duration.toFixed(1)}s of silence`);
    return paths.score;
  }

  const prompt = film.score?.prompt ?? 'slow cinematic ambient underscore, instrumental';

  if (mode === 'prompt') {
    const buf = await composeChunked(totalMs, (ms) => composeFromPrompt(prompt, ms), paths, log);
    // Recorded AFTER the call succeeds. Recording it before meant a compose
    // that failed 422 still showed up as $2 of music in the ledger — a bill
    // for something that was never delivered.
    ledger?.music('score', timeline.duration, 1);
    log(`score: music_v2 from prompt, ${(totalMs / 1000).toFixed(1)}s`);
    return buf;
  }

  // Anything with a human voice in it, banned at the source. The planner will
  // otherwise reach for choir pads on any "cosmic" brief — they are a staple of
  // the genre and they are exactly wrong under narration.
  const NO_VOICES = [
    'vocals', 'choir', 'choral', 'voice', 'vocal pads', 'humming', 'singing',
    'lyrics', 'spoken word', 'aahs', 'oohs',
  ];

  const acts = timeline.acts?.length ? timeline.acts : [{
    name: 'whole', text: prompt, styles: [], negativeStyles: [],
    start: 0, end: timeline.duration,
  }];

  // Global styles from the planner, sections from us.
  const plan = await musicPlan(`${prompt}. Strictly instrumental, no voices of any kind.`, Math.min(totalMs, MUSIC_MAX_MS));
  plan.negative_global_styles = [...new Set([...(plan.negative_global_styles ?? []), ...NO_VOICES])];
  // The planner puts choir in the LOCAL styles too, where a global negative
  // does not reach it.
  const stripVoices = (styles) => (styles ?? []).filter(
    (s) => !NO_VOICES.some((v) => s.toLowerCase().includes(v.split(' ')[0])),
  );
  plan.positive_global_styles = stripVoices(plan.positive_global_styles);
  const sections = [];
  for (const a of acts) {
    const actMs = Math.max(SECTION_MIN_MS, Math.round((a.end - a.start) * 1000));
    const parts = Math.max(1, Math.ceil(actMs / SECTION_MAX_MS));
    const each = Math.round(actMs / parts);
    for (let k = 0; k < parts; k++) {
      sections.push({
        section_name: parts > 1 ? `${a.name} ${k + 1}` : a.name,
        positive_local_styles: stripVoices(a.styles?.length ? a.styles : plan.positive_global_styles),
        negative_local_styles: [...new Set([...(a.negativeStyles ?? []), ...NO_VOICES])],
        duration_ms: Math.max(SECTION_MIN_MS, Math.min(SECTION_MAX_MS, each)),
        // Instrumental: `lines` is where lyrics would go, and a journey film
        // does not want a voice competing with its narrator.
        lines: [],
      });
    }
  }
  plan.sections = sections;

  const planned = sections.reduce((n, s) => n + s.duration_ms, 0);
  log(`score: ${acts.length} acts -> ${sections.length} sections, ${(planned / 1000).toFixed(1)}s planned`);
  writeFileSync(join(paths.audio, 'score-plan.json'), JSON.stringify(plan, null, 2));

  if (planned <= MUSIC_MAX_MS) {
    const buf = await composeFromPlan(plan);
    writeFileSync(paths.score, buf);
    ledger?.music('score', timeline.duration, 2); // the plan call + this one
  } else {
    // Past ten minutes the API will not take one plan. Split at ACT boundaries
    // — never mid-act — so each piece still begins and ends where the film
    // does, and butt-join them.
    await composeInHalves(plan, paths, log);
    ledger?.music('score', timeline.duration, 2);
  }
  log(`score: -> ${paths.score}`);
  return paths.score;
}

async function composeChunked(totalMs, fn, paths, log) {
  if (totalMs <= MUSIC_MAX_MS) {
    writeFileSync(paths.score, await fn(totalMs));
    return paths.score;
  }
  const parts = Math.ceil(totalMs / MUSIC_MAX_MS);
  const files = [];
  for (let k = 0; k < parts; k++) {
    const ms = Math.min(MUSIC_MAX_MS, totalMs - k * MUSIC_MAX_MS);
    const f = join(paths.audio, `score-part-${k}.mp3`);
    writeFileSync(f, await fn(ms));
    files.push(f);
    log(`  score part ${k + 1}/${parts}: ${(ms / 1000).toFixed(0)}s`);
  }
  concat(files, paths.score);
  return paths.score;
}

async function composeInHalves(plan, paths, log) {
  const groups = [];
  let cur = [], acc = 0;
  for (const s of plan.sections) {
    if (acc + s.duration_ms > MUSIC_MAX_MS && cur.length) { groups.push(cur); cur = []; acc = 0; }
    cur.push(s); acc += s.duration_ms;
  }
  if (cur.length) groups.push(cur);

  const files = [];
  for (const [k, sections] of groups.entries()) {
    const f = join(paths.audio, `score-part-${k}.mp3`);
    writeFileSync(f, await composeFromPlan({ ...plan, sections }));
    files.push(f);
    log(`  score part ${k + 1}/${groups.length}: ${sections.length} sections`);
  }
  concat(files, paths.score);
}

function concat(files, out) {
  const inputs = files.flatMap((f) => ['-i', f]);
  const graph = `${files.map((_, i) => `[${i}:a]`).join('')}concat=n=${files.length}:v=0:a=1[out]`;
  run([...inputs, '-filter_complex', graph, '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', '192k', out], 'score concat');
}
