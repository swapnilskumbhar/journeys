// Sample a finished film into numbered stills, for a blind review.
//
//   node scripts/film-shots.mjs <id> [--every=4] [--per-shot]
//
// Samples the MASTER — silent, and with no captions burned — for the same
// reason `shots.mjs --blind` strips the copy panel: a reviewer who can read
// the words has already been told what the picture means, and cannot un-know
// it. The output directory contains nothing but `frame-000.jpg`, and the key
// mapping frame -> time -> heading is written OUTSIDE it, so the whole
// directory can be handed to `journey-blind-reviewer` unchanged.
//
// Default is one frame every 4 seconds, which is what the review is FOR: a
// per-beat sample would show only the instants the film was composed around
// and would miss a shot that goes dead in its second half. `--per-shot` gives
// the tighter one-frame-per-shot set when that is what is wanted.
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { filmPaths } from './film/lib/env.mjs';
import { run } from './film/lib/ffmpeg.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => {
  const f = args.find((a) => a.startsWith(`--${n}=`));
  return f ? f.split('=').slice(1).join('=') : d;
};
const id = args.find((a) => !a.startsWith('--'));
if (!id) {
  console.error('usage: node scripts/film-shots.mjs <id> [--every=4] [--per-shot]');
  process.exit(2);
}

const paths = filmPaths(id);
if (!existsSync(paths.master) || !existsSync(paths.timeline)) {
  console.error(`no film for ${id} — run scripts/film.mjs first`);
  process.exit(2);
}

const timeline = JSON.parse(readFileSync(paths.timeline, 'utf8'));
const every = Number(flag('every', 4));

let times;
if (args.includes('--per-shot')) {
  times = timeline.shots.map((s) => ({
    t: Math.min(s.end - 0.2, s.start + s.travel + (s.end - s.start - s.travel) * 0.5),
    shot: s.i, heading: s.heading,
  }));
} else {
  times = [];
  for (let t = 1; t < timeline.duration; t += every) {
    const s = timeline.shots.find((x) => t < x.end) ?? timeline.shots[timeline.shots.length - 1];
    times.push({ t, shot: s.i, heading: s.heading });
  }
}

rmSync(paths.review, { recursive: true, force: true });
mkdirSync(paths.review, { recursive: true });

const key = [];
times.forEach((s, i) => {
  const label = `frame-${String(i + 1).padStart(3, '0')}`;
  const file = join(paths.review, `${label}.jpg`);
  run(['-ss', s.t.toFixed(3), '-i', paths.master, '-frames:v', '1', '-q:v', '3', file], 'sample');
  key.push({ label, at: +s.t.toFixed(2), shot: s.shot, heading: s.heading });
});

// The key lives OUTSIDE the frames directory. Blindness that depends on the
// reviewer choosing not to open a file is not blindness.
writeFileSync(`${paths.review}.key.json`, JSON.stringify(key, null, 2));

console.log(`${key.length} frames -> ${paths.review}`);
console.log(`key (NOT for the reviewer) -> ${paths.review}.key.json`);
