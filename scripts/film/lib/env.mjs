// Keys, paths and the dry-run switch. One place, so no other film module
// touches `process.env` directly.
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';

// .env is never auto-loaded into process.env for a plain `node script.mjs`
// invocation — that is a Vite-dev-server-only behaviour. Without this, keys
// sitting in .env are invisible and every generator silently degrades.
// Guarded: CI and fresh checkouts may have no .env at all.
if (existsSync(resolve('.env'))) process.loadEnvFile(resolve('.env'));

// NOTE the variable name. This repo's .env uses OPENAI_KEY, not the
// OPENAI_API_KEY that every OpenAI example uses — reading the conventional
// name here would find nothing and fall through to "no director configured",
// which looks like a missing feature rather than a typo.
export const OPENAI_KEY = process.env.OPENAI_KEY ?? process.env.OPENAI_API_KEY ?? '';
export const OPENAI_BASE = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
// Verified live: `gpt-5.6-terra` on /v1/responses, text+vision, strict
// json_schema. The bare `gpt-5.6` alias routes to Sol and must not be used
// when Terra is what was asked for.
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.6-terra';

export const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY ?? '';
export const ELEVEN_BASE = 'https://api.elevenlabs.io/v1';
export const VOICE_ID = process.env.VOICE_ID ?? 'pNInz6obpgDQGcFmaJgB';

const require = createRequire(import.meta.url);
export const FFMPEG = require('ffmpeg-static');

/** Everything a film writes, derived from the journey id. */
export function filmPaths(id) {
  const root = resolve('renders', id);
  const p = {
    root,
    frames: join(root, 'frames'),
    audio: join(root, 'audio'),
    sfx: join(root, 'sfx'),
    // Blind stills the director looks at. Deliberately OUTSIDE renders/ and
    // reusing shots.mjs's own convention, so the same directory can be handed
    // to `journey-blind-reviewer` unchanged.
    blind: resolve('review-shots', `${id}-blind`),
    // Sampled from the finished master for the film's blind review — silent,
    // caption-free, numbered only.
    review: resolve('review-shots', `${id}-film-blind`),
    film: resolve('src/journeys', id, 'film.js'),
    timeline: join(root, 'timeline.json'),
    narration: join(root, 'audio', 'narration.mp3'),
    words: join(root, 'audio', 'words.json'),
    timings: join(root, 'audio', 'timings.json'),
    score: join(root, 'audio', 'score.mp3'),
    master: join(root, 'master.mp4'),
    captioned: join(root, 'captioned.mp4'),
    final: join(root, 'final.mp4'),
    ass: join(root, 'captions.ass'),
    report: join(root, 'film-gate.json'),
  };
  return p;
}

export function ensureDirs(p) {
  for (const d of [p.root, p.frames, p.audio, p.sfx]) mkdirSync(d, { recursive: true });
}

/** Fail loudly and early rather than half-way through a 20-minute render. */
export function requireKeys(names) {
  const missing = [];
  if (names.includes('openai') && !OPENAI_KEY) missing.push('OPENAI_KEY');
  if (names.includes('eleven') && !ELEVEN_KEY) missing.push('ELEVENLABS_API_KEY');
  if (missing.length) {
    throw new Error(`missing in .env: ${missing.join(', ')}`);
  }
}
