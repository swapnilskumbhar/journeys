// Sound effects, cached by name.
//
// Sparse on purpose. Most of a journey is vacuum, rock or deep time, and a
// film that scatters whooshes across every scale change sounds like a trailer
// rather than a documentary. Three or four cues in a whole film is right.
//
// Cached by `name`, so re-running the pipeline after a script edit costs
// nothing for cues that did not change — and so a cue can be replaced by hand
// with a real recording just by dropping a file at that path.
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { soundEffect } from './lib/elevenlabs.mjs';
import { run } from './lib/ffmpeg.mjs';

export async function makeSfx({ timeline, paths, dryRun = false, ledger = null, log = console.log }) {
  const cues = [];
  const seen = new Map();
  // Only GENERATED effects are billed; a cache hit costs nothing and must not
  // appear in the ledger, or a re-run would look more expensive than it was.
  let billed = 0;
  let billedSeconds = 0;

  for (const shot of timeline.shots) {
    for (const cue of shot.sfx ?? []) {
      const file = join(paths.sfx, `${cue.name}.mp3`);
      if (!seen.has(cue.name)) {
        if (existsSync(file)) {
          log(`  sfx ${cue.name}: cached`);
        } else if (dryRun) {
          run(['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', String(cue.seconds ?? 3), '-c:a', 'libmp3lame', file], 'dry sfx');
        } else {
          writeFileSync(file, await soundEffect(cue.prompt, cue.seconds ?? 3));
          billed++;
          billedSeconds += cue.seconds ?? 3;
          log(`  sfx ${cue.name}: generated (${cue.seconds ?? 3}s)`);
        }
        seen.set(cue.name, file);
      }
      cues.push({
        name: cue.name,
        file,
        // Cue times are authored relative to the SHOT; the mixer needs them on
        // the film's timeline.
        at: shot.start + (cue.at ?? 0),
        gain: cue.gain ?? 0.7,
      });
    }
  }

  if (billed) ledger?.sfx('sfx', billed, billedSeconds);
  if (cues.length) log(`sfx: ${cues.length} cues, ${seen.size} distinct, ${billed} generated`);
  return cues;
}
