// The voiceover, and the clock the whole film runs on.
//
// ONE call for the entire script. That is not an optimisation — it is the
// design. Synthesising line by line resets intonation at every boundary and
// stitches together with audible seams; one call is one continuous
// performance. The character-level alignment that comes back is what lets a
// shot last exactly as long as its own sentence.
import { writeFileSync } from 'node:fs';
import { speak, wordsFromAlignment, normalizePauses } from './lib/elevenlabs.mjs';
import { VOICE_ID } from './lib/env.mjs';
import { run } from './lib/ffmpeg.mjs';

// Rough spoken rate used only by --dry-run, in words per second. Measured
// against real takes at speed 0.9; close enough that a dry run's pacing is
// representative and its frame count is realistic.
const DRY_WPS = 2.6;

export async function makeVoice({ film, paths, speed = 0.9, voice = VOICE_ID, dryRun = false, ledger = null, log = console.log }) {
  const narrated = film.shots
    .map((s, i) => ({ i, text: normalizePauses((s.narration ?? '').trim()) }))
    .filter((s) => s.text);

  if (!narrated.length) throw new Error('film.js carries no narration');

  if (dryRun) {
    // Synthetic alignment at a fixed rate, plus real silence of the right
    // length. Everything downstream — the solver, the renderer, the mix —
    // then exercises its true code path for free.
    let t = 0;
    const timings = {};
    const words = [];
    for (const { i, text } of narrated) {
      const start = t;
      for (const w of text.split(/\s+/)) {
        const d = 1 / DRY_WPS;
        words.push({ t: w, s: +t.toFixed(3), e: +(t + d * 0.9).toFixed(3) });
        t += d;
      }
      t += 0.45; // the breath between lines
      timings[i] = { start: +start.toFixed(3), end: +(t - 0.45).toFixed(3) };
    }
    run(['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', t.toFixed(3), '-c:a', 'libmp3lame', paths.narration], 'dry narration');
    writeFileSync(paths.timings, JSON.stringify(timings, null, 2));
    writeFileSync(paths.words, JSON.stringify(words));
    log(`voice: DRY RUN — ${narrated.length} lines, ${words.length} words, ${t.toFixed(1)}s of silence`);
    return { timings, words, seconds: t };
  }

  // One continuous script; track each shot's inclusive character span in it,
  // keyed by the shot's ORIGINAL index so a wordless shot never shifts the
  // mapping of the ones around it.
  const SEP = ' ';
  let full = '';
  const spans = [];
  narrated.forEach(({ i, text }, k) => {
    const startChar = full.length;
    full += text;
    spans.push({ i, startChar, endChar: full.length - 1 });
    if (k < narrated.length - 1) full += SEP;
  });

  log(`voice: ElevenLabs single take — ${full.length} chars, ${narrated.length} lines, speed ${speed}`);
  // Recorded BEFORE the call: characters submitted is what is billed, whether
  // or not the response arrives.
  ledger?.tts('voice', full.length);
  const { audio, chars, starts, ends } = await speak(full, { voice, speed });

  const clamp = (arr, idx) => arr[Math.max(0, Math.min(arr.length - 1, idx))];
  const timings = {};
  for (const { i, startChar, endChar } of spans) {
    timings[i] = { start: +clamp(starts, startChar).toFixed(3), end: +clamp(ends, endChar).toFixed(3) };
  }
  const words = wordsFromAlignment(chars, starts, ends);

  writeFileSync(paths.narration, audio);
  writeFileSync(paths.timings, JSON.stringify(timings, null, 2));
  writeFileSync(paths.words, JSON.stringify(words));

  const seconds = Math.max(...Object.values(timings).map((t) => t.end));
  log(`voice: ${seconds.toFixed(1)}s, ${words.length} words -> ${paths.narration}`);
  return { timings, words, seconds };
}
