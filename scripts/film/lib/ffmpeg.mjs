// ffmpeg plumbing. `ffmpeg-static` ships ffmpeg only — there is no ffprobe in
// this tree — so every measurement below is parsed out of ffmpeg's own stderr.
import { spawnSync } from 'node:child_process';
import { FFMPEG } from './env.mjs';

/**
 * Run ffmpeg. Throws with the tail of stderr, which is where ffmpeg says why.
 *
 * `cwd` exists for one reason: libass. The `subtitles=` filter takes its
 * argument through ffmpeg's own filter-argument escaping, and a Windows
 * drive-letter path (`E:\...`) breaks it — the colon reads as an argument
 * separator. Running from the output directory lets the filter take a plain
 * relative filename with no colon in it.
 */
export function run(args, label = 'ffmpeg', cwd = undefined) {
  const r = spawnSync(FFMPEG, ['-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 1 << 26, cwd });
  if (r.status !== 0) {
    throw new Error(`${label} failed:\n${(r.stderr ?? Buffer.alloc(0)).toString().slice(-2500)}`);
  }
  return r;
}

/** Same, but returns stderr instead of throwing — for the measuring passes. */
export function probe(args) {
  const r = spawnSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 1 << 26 });
  return (r.stderr ?? Buffer.alloc(0)).toString();
}

export function duration(file) {
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(probe(['-i', file, '-f', 'null', '-']));
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0;
}

/**
 * Integrated loudness, in LUFS, of a finished mix. This is the measuring pass
 * of a two-pass loudnorm — `print_format=json` makes loudnorm report what it
 * MEASURED rather than apply anything.
 */
export function loudness(file) {
  const out = probe([
    '-i', file,
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json',
    '-f', 'null', '-',
  ]);
  // The JSON block is the last {...} ffmpeg prints on stderr.
  const start = out.lastIndexOf('{');
  const end = out.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    const j = JSON.parse(out.slice(start, end + 1));
    return {
      integrated: Number(j.input_i),
      truePeak: Number(j.input_tp),
      range: Number(j.input_lra),
    };
  } catch { return null; }
}

/**
 * Mean volume (dBFS) across an arbitrary SET of time windows in one pass.
 *
 * `aselect` keeps only the frames whose timestamp falls inside one of the
 * windows and `asetpts` restamps what survives into a continuous stream, so
 * volumedetect sees exactly those regions and nothing else. One call per set
 * rather than one per window — a 22-shot film has ~44 windows, and 44 ffmpeg
 * launches to answer one question is not a measurement, it is a wait.
 */
export function meanVolumeIn(file, windows) {
  if (!windows.length) return null;
  const expr = windows.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`).join('+');
  const out = probe([
    '-i', file,
    '-af', `aselect='${expr}',asetpts=N/SR/TB,volumedetect`,
    '-f', 'null', '-',
  ]);
  const m = /mean_volume:\s*(-?[\d.]+) dB/.exec(out);
  return m ? Number(m[1]) : null;
}

/** Complement of `windows` within [0, total] — the gaps between them. */
export function invertWindows(windows, total, pad = 0.25) {
  const gaps = [];
  let t = 0;
  for (const [a, b] of windows) {
    if (a - pad > t + 0.3) gaps.push([t, a - pad]);
    t = Math.max(t, b + pad);
  }
  if (total - t > 0.3) gaps.push([t, total]);
  return gaps;
}
