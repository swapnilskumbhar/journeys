// Voice, score and sound effects. Three endpoints, all verified live.
//
// THE ONE NON-OBVIOUS THING, and it cost a probe to find: the composition-plan
// path only works with **music_v1**. `/v1/music/plan` returns a plan shaped
// `{positive_global_styles, negative_global_styles, sections[]}`, and posting
// that to `/v1/music` with `model_id: music_v2` fails 422 "Invalid type of
// `composition_plan` used for model music_v2". music_v2 accepts a plain
// `prompt` only.
//
// So there is a real trade: v2 sounds better, v1 lets you say WHERE the music
// changes. This pipeline defaults to the plan path, because a score whose
// sections land on the journey's own acts is the entire reason to score a
// journey rather than to lay a loop under it.
//
// The published docs also name this endpoint `/v1/music/composition_plan`.
// It is `/v1/music/plan`.
import { ELEVEN_KEY, ELEVEN_BASE } from './env.mjs';

const H = () => ({ 'xi-api-key': ELEVEN_KEY, 'content-type': 'application/json' });

async function post(path, body, { raw = false } = {}) {
  const res = await fetch(`${ELEVEN_BASE}${path}`, { method: 'POST', headers: H(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`ElevenLabs ${path} ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return raw ? Buffer.from(await res.arrayBuffer()) : res.json();
}

// --- voice ------------------------------------------------------------------

// ElevenLabs renders em/en-dashes and ellipses as long FIXED pauses that the
// `speed` setting cannot compress, so a dash-heavy script sounds draggy at any
// speed and the speed knob goes nearly inert (measured 2% length spread from
// 0.7→1.0 on a script with four em-dashes, vs 27% on clean prose). Downgrading
// them to commas restores both a snappier read and the knob's authority. Only
// SPACED —/– and ellipses are touched; the hyphen in "single-cylinder" is
// U+002D and never matches.
export function normalizePauses(t) {
  return t
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s*(?:…|\.\.\.)\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * ONE call for the whole script. The point is a single continuous performance:
 * per-line calls reset intonation at every boundary and stitch together with
 * audible seams. The character-level alignment that comes back is what lets us
 * clock the entire film off the voice.
 */
export async function speak(text, { voice, speed = 0.9, model = 'eleven_multilingual_v2' }) {
  const res = await fetch(
    `${ELEVEN_BASE}/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: H(),
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          stability: 0.5, similarity_boost: 0.75, style: 0.0,
          use_speaker_boost: true,
          speed: Math.max(0.7, Math.min(1.2, speed)),
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const json = await res.json();
  const a = json.alignment ?? json.normalized_alignment;
  if (!a?.character_start_times_seconds?.length) throw new Error('TTS returned no alignment');
  return {
    audio: Buffer.from(json.audio_base64, 'base64'),
    chars: a.characters ?? Array.from(text),
    starts: a.character_start_times_seconds,
    ends: a.character_end_times_seconds,
  };
}

/**
 * Word-level timing, reconstructed from the character alignment: walk the
 * chars, accumulate non-space runs, stamp each word with the start of its
 * first char and the end of its last. This is what makes captions match the
 * spoken voice rather than paraphrase it.
 */
export function wordsFromAlignment(chars, starts, ends) {
  const words = [];
  let cur = '', s = 0, e = 0;
  for (let k = 0; k < chars.length; k++) {
    const ch = chars[k];
    if (/\s/.test(ch)) {
      if (cur) words.push({ t: cur, s: +s.toFixed(3), e: +e.toFixed(3) });
      cur = '';
      continue;
    }
    if (!cur) s = starts[k];
    cur += ch;
    e = ends[k];
  }
  if (cur) words.push({ t: cur, s: +s.toFixed(3), e: +e.toFixed(3) });
  return words;
}

// --- score ------------------------------------------------------------------

export const MUSIC_MAX_MS = 600_000;

/** Ask for a plan, so its sections can be re-timed onto the film's own acts. */
export function musicPlan(prompt, lengthMs) {
  return post('/music/plan', { prompt, music_length_ms: clampMusic(lengthMs) });
}

/**
 * Compose from an (edited) plan. music_v1 — see the note at the top.
 *
 * NO `force_instrumental` here, and the reason is worth recording because the
 * obvious fix is the wrong one. big-bang's score came back full of "distant
 * choir textures" and "weightless choir" — voices under a narrator, competing
 * for the same band — because the prompt path set `force_instrumental` and
 * this one did not. Setting it here fails 422: **"`force_instrumental` can
 * only be used with `prompt`."**
 *
 * So on the plan path the ONLY lever is the plan itself: voice-related styles
 * stripped from the global AND local style lists, every voice term added to
 * the negatives, and `lines: []` on every section. See `make-score.mjs`.
 */
export function composeFromPlan(plan) {
  return post(
    '/music?output_format=mp3_44100_128',
    { composition_plan: plan, model_id: 'music_v1' },
    { raw: true },
  );
}

/** Compose from a bare prompt. music_v2 — better model, no section control. */
export function composeFromPrompt(prompt, lengthMs) {
  return post(
    '/music?output_format=mp3_44100_128',
    { prompt, music_length_ms: clampMusic(lengthMs), model_id: 'music_v2', force_instrumental: true },
    { raw: true },
  );
}

export function clampMusic(ms) {
  return Math.max(3000, Math.min(MUSIC_MAX_MS, Math.round(ms)));
}

// --- sound effects ----------------------------------------------------------

export function soundEffect(text, seconds = 3, influence = 0.4) {
  return post(
    '/sound-generation',
    { text, duration_seconds: Math.max(0.5, Math.min(22, seconds)), prompt_influence: influence },
    { raw: true },
  );
}
