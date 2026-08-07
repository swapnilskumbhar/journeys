// Frames + audio -> master, captioned, final.
//
// Three artefacts, deliberately:
//   master.mp4     silent, no captions — the reusable picture, and the ONLY
//                  thing the gate measures for occupancy, because captions
//                  would flatter exactly the frames the gate exists to catch.
//   captioned.mp4  captions burned in
//   final.mp4      captioned + narration + ducked score + sfx
import { writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { run, probe, duration, loudness } from './lib/ffmpeg.mjs';

const TITLE_SECONDS = 4.5;
const ENDCARD_SECONDS = 3.5;

// ============================================================================
// LEVELS ARE MEASURED, NOT GUESSED
// ============================================================================
// The first version of this multiplied the score by a fixed 0.55 and hoped.
// That fails because a generated score arrives MASTERED: big-bang's came back
// at -13 dB mean with -1.3 dB peaks, which is commercial release level. A
// fixed -5 dB on top of that still leaves the music sitting on the narrator's
// head — and worse, the score has its own internal arc (that one was -18.8 dB
// for its first thirty seconds and -14 dB from then on), so the bed audibly
// swells a minute in and never comes back down.
//
// No fixed multiplier can fix a source whose level you have not measured. So
// both tracks are measured with a real loudness pass, and the gain needed to
// hit these targets is COMPUTED per film. `acompressor` then flattens what is
// left of the score's internal arc, so the bed stays put for eight minutes.
//
// -30 against -16 is a 14 dB separation before ducking and about 22 dB under
// speech. That is documentary underscore: present in the gaps, felt rather
// than heard beneath a line.
// Nudged from -30 to -29 on a listening note: the bed was correct but sat a
// touch too far back. Worth knowing when tuning this by request — "10% louder"
// is +0.83 dB in amplitude, which is at or below the threshold of audibility,
// so a request in percent almost always means "one step up" rather than the
// arithmetic. 1 dB is that step.
const MUSIC_TARGET_LUFS = -29;
const VOICE_TARGET_LUFS = -16;

// Narration arrives with a ~24 dB crest factor: ElevenLabs returns peaks near
// full scale over a low average, so the +14 dB needed to reach -16 LUFS throws
// the peaks well past 0 dBFS. That is what makes the true-peak ceiling
// unreachable — a mix cannot be at -14 LUFS and -2 dBTP at once with a crest
// that wide, and no amount of normaliser tuning changes the arithmetic. The
// answer is the one every broadcast chain uses: compress the voice, then
// normalise. Fast attack to catch plosives, release short enough to recover
// inside a sentence. It also makes the read steadier, which is worth having on
// its own.
const VOICE_DYNAMICS = 'acompressor=threshold=-20dB:ratio=4:attack=5:release=150:makeup=2';

// Flattens the score's own dynamics BEFORE it is ducked. Slow attack and
// release so it acts as a leveller across minutes rather than as an audible
// pump across bars.
const MUSIC_LEVELLER = 'acompressor=threshold=-26dB:ratio=4:attack=200:release=1200:makeup=1';
// A gentle scoop where speech intelligibility lives. Music keeps its low
// weight and its air; it stops competing in the band the voice needs.
const MUSIC_CARVE = 'equalizer=f=1800:t=q:w=1.2:g=-4,highpass=f=45';

// ONE definition, used by both the real mix and the gate's measurement probe.
// If these two ever drift apart the gate measures a duck the film does not
// have, which is worse than not measuring it at all.
//
// `level_sc` is the parameter that actually does the work here and it is easy
// to miss: it scales the sidechain KEY before detection. Narration sits well
// below full scale, so at level_sc=1 the compressor barely registers it and
// the first version of this ducked by only 1.6 dB with a ratio of 6. Making
// the key hot is what turns the knee on.
const DUCK = 'sidechaincompress=threshold=0.02:ratio=12:attack=20:release=400:makeup=1:level_sc=4';

/**
 * dB of gain needed to bring `file` to `targetLufs`. Measured, then applied as
 * a FIXED gain — deliberately not single-pass `loudnorm`, which is dynamic and
 * would re-introduce exactly the moving level this is meant to remove.
 */
function gainToReach(file, targetLufs, fallbackDb = 0) {
  const l = loudness(file);
  if (!l || !isFinite(l.integrated)) return fallbackDb;
  return targetLufs - l.integrated;
}

// Level the compressor is DRIVEN at, which is a different question from the
// level the voice comes out at, and conflating the two cost this pipeline a
// gate failure.
//
// The old chain was `volume(to reach -16), compress`. The gain was measured on
// the RAW file, so it was correct only up to the compressor — which then
// removed an amount of level that depends entirely on how hard it was hit. A
// TTS render 2 dB quieter than usual is driven 2 dB harder, loses more than
// that to 4:1 gain reduction, and the voice arrives under target. Measured on
// voyager: narration came back at -31.95 LUFS (the documented typical is ~-30),
// the mix landed at -20.0 LUFS instead of ~-15.7, and loudnorm then needed
// +6 dB — more than the 2.1 dB of true-peak headroom the mix had, so it
// abandoned linear mode, went dynamic, and delivered -0.3 dBTP against a -2
// request. The gate failed on true peak. The normaliser was not the problem.
//
// So: drive the compressor at a FIXED level, then measure what comes out and
// trim that to the voice target. The compressor now behaves identically for
// every film regardless of what the TTS returns, and the voice lands where it
// is asked to. -16 is the drive the existing sound was tuned at (a typical
// -30 LUFS render plus the ~14 dB it used to receive), so the character is
// unchanged for a nominal file and only the outliers move.
const VOICE_DRIVE_LUFS = -16;

// The voice's own true-peak ceiling, and the reason the two-pass normaliser can
// work at all.
//
// Arithmetic first, because no tuning gets around it. loudnorm's linear pass
// can only run if the gain it needs fits under the true-peak target: a mix at
// I LUFS needs (-14 - I) dB, so its peaks must sit at or below (12 + I) dBTP.
// At a mix loudness near -17 that means about -5 dBTP — a crest of twelve dB.
// Compressed narration measured NINETEEN AND A HALF: -19.97 LUFS at -0.46
// dBTP. Nothing downstream can fix that, and a limiter placed AFTER loudnorm
// fights it (this file has already paid for that experiment). A limiter BEFORE
// the measurement does not fight anything — it just narrows the crest, which
// is the actual defect.
//
// It runs LAST in the voice chain, after the trim, because it is a ceiling and
// a ceiling has to be the final word about peaks. `level=disabled` stops
// alimiter helpfully re-normalising afterwards and undoing the work.
const VOICE_CEILING_DBTP = -6;
const VOICE_LIMITER = `alimiter=limit=${VOICE_CEILING_DBTP}dB:attack=5:release=50:level=disabled`;

// Where the bed sits, expressed as SEPARATION from the voice rather than as an
// absolute number. `MUSIC_TARGET_LUFS`/`VOICE_TARGET_LUFS` still name the
// 13 dB that was tuned by ear; this just applies it to where the voice actually
// landed. Declared as a `function` so it may be used above its definition —
// `const` would not be hoisted, which this repo has paid for three times.
function musicTargetFor(voice) {
  const separation = MUSIC_TARGET_LUFS - VOICE_TARGET_LUFS;
  return (voice?.lufs ?? VOICE_TARGET_LUFS) + separation;
}

function fmtDb(v) {
  if (v == null || !isFinite(v)) return '?';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)} dB`;
}

/**
 * The voice chain, ONE definition, shared by the real mix and the duck probe —
 * same rule as `DUCK`. Drive the compressor at a fixed level, measure what came
 * out of it, trim that to `VOICE_TARGET_LUFS`, then put a ceiling on it.
 *
 * Two audio-only decodes of the narration (~3 s each at 128x), and both are
 * necessary: gain reduction is a function of the programme, not something that
 * can be derived from the constants, and neither is the loudness the limiter
 * leaves behind.
 *
 * `lufs` is what the voice ACTUALLY measures at the end of the chain, and the
 * caller uses it to place the music. The limiter costs about 1.8 dB of
 * loudness, so a music gain computed against the nominal target would sit that
 * much too loud under the voice. What was tuned by ear was the SEPARATION
 * between the two, not either absolute number — loudnorm sets the absolute
 * level of the finished mix regardless.
 */
function voiceChain(narration) {
  const measure = (filter) => {
    const out = probe([
      '-i', narration,
      '-filter_complex', `[0:a]${filter},${loudnormPass1()}[out]`,
      '-map', '[out]', '-f', 'null', '-',
    ]);
    const s = out.lastIndexOf('{');
    const e = out.lastIndexOf('}');
    if (s < 0 || e <= s) return null;
    try {
      const m = JSON.parse(out.slice(s, e + 1));
      return isFinite(Number(m.input_i)) ? { i: Number(m.input_i), tp: Number(m.input_tp) } : null;
    } catch { return null; }
  };

  const drive = gainToReach(narration, VOICE_DRIVE_LUFS);
  const head = `volume=${drive.toFixed(2)}dB,${VOICE_DYNAMICS}`;
  const post = measure(head);
  const trim = post === null ? 0 : VOICE_TARGET_LUFS - post.i;
  const filter = `${head},volume=${trim.toFixed(2)}dB,${VOICE_LIMITER}`;
  const final = measure(filter);
  return {
    filter,
    drive,
    trim,
    postComp: post?.i ?? null,
    lufs: final?.i ?? VOICE_TARGET_LUFS,
    tp: final?.tp ?? null,
  };
}

// TWO-PASS loudnorm, and the two dead ends that led here are worth keeping.
//
//   single-pass loudnorm alone   hits -14 LUFS but its true-peak ceiling is
//                                advisory: asked for -1.5, delivered -0.3.
//   loudnorm then alimiter       enforces the ceiling and then fights the
//                                normaliser that just ran — the limiter pulled
//                                3.7 dB back off and the mix landed at -17.7
//                                LUFS. A static limiter after a dynamic
//                                normaliser cannot win; each undoes the other.
//
// Two-pass is the tool actually designed for this. Pass one measures; pass two
// applies a single LINEAR gain with the measured values supplied, which hits
// the integrated target exactly AND respects true peak, with no dynamics
// applied to the finished mix at all. `TP=-2` leaves inter-sample headroom
// against the gate's -1.0 bar.
const LOUDNESS_TARGET = { I: -14, TP: -2, LRA: 11 };

function loudnormPass1() {
  return `loudnorm=I=${LOUDNESS_TARGET.I}:TP=${LOUDNESS_TARGET.TP}:LRA=${LOUDNESS_TARGET.LRA}:print_format=json`;
}
function loudnormPass2(m) {
  if (!m) return `loudnorm=I=${LOUDNESS_TARGET.I}:TP=${LOUDNESS_TARGET.TP}:LRA=${LOUDNESS_TARGET.LRA}`;
  return `loudnorm=I=${LOUDNESS_TARGET.I}:TP=${LOUDNESS_TARGET.TP}:LRA=${LOUDNESS_TARGET.LRA}` +
    `:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
    `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
}

// --- 1. picture -------------------------------------------------------------

export function encodeMaster(framesDir, out, fps) {
  run([
    '-framerate', String(fps),
    '-i', join(framesDir, '%06d.jpg'),
    // `gradfun` debands the near-flat gradients this project is mostly made of,
    // dithering them just before encode; crf 16 preserves that dither through
    // x264's 8-bit quantization instead of quantizing it straight back out.
    '-vf', 'gradfun=1.2:16',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    out,
  ], 'encode master');
  return out;
}

// --- 2. captions ------------------------------------------------------------

/**
 * A word's time in NARRATION space -> its time on the video timeline.
 * They differ whenever a wordless shot inserted silence and the take was cut
 * into segments around it.
 */
export function toVideoTime(timeline, narrT) {
  const segs = timeline.segments ?? [];
  for (const s of segs) {
    if (narrT >= s.trimFrom && narrT <= s.trimTo) return narrT - s.trimFrom + s.delay;
  }
  // Before the first segment or past the last: clamp to the nearest edge
  // rather than returning something that would place a cue outside the film.
  if (!segs.length) return narrT + (timeline.leadIn ?? 0);
  const first = segs[0], last = segs[segs.length - 1];
  if (narrT < first.trimFrom) return first.delay;
  return last.trimTo - last.trimFrom + last.delay;
}

export function buildCaptions(timeline, words, { karaoke = false } = {}) {
  const { width, height, duration: videoEnd, chrome } = timeline;
  const cues = [];

  // Group verbatim words into readable phrases, broken on real punctuation
  // first and on length only as a fallback. These are the words actually
  // spoken, at the moment they are actually spoken — not a paraphrase.
  const maxWords = 9;
  const maxChars = 52;
  const groups = [];
  let grp = [];
  const flush = () => { if (grp.length) { groups.push(grp); grp = []; } };
  for (const w of words) {
    grp.push(w);
    const len = grp.reduce((n, x) => n + x.t.length + 1, -1);
    const hard = /[.?!]["')\]]?$/.test(w.t);
    const soft = /[,;:—]$/.test(w.t) && grp.length >= 3;
    if (hard || soft || grp.length >= maxWords || len >= maxChars) flush();
  }
  flush();

  const esc = (t) => String(t).replace(/\n/g, '\\N');
  const HILITE = '&H00FFFF&';

  groups.forEach((g, gi) => {
    const gStart = toVideoTime(timeline, g[0].s);
    const nextStart = gi + 1 < groups.length ? toVideoTime(timeline, groups[gi + 1][0].s) : Infinity;
    const gEnd = Math.min(nextStart, toVideoTime(timeline, g[g.length - 1].e) + 1.0, videoEnd);

    if (!karaoke) {
      // One cue per phrase. For long-form this reads as a documentary subtitle;
      // the per-word highlight below is a shorts convention and is noise here.
      cues.push({ start: gStart, end: Math.max(gEnd, gStart + 0.4), text: g.map((x) => esc(x.t)).join(' ') });
      return;
    }
    g.forEach((w, i) => {
      const start = toVideoTime(timeline, w.s);
      const nextWord = i + 1 < g.length ? toVideoTime(timeline, g[i + 1].s) : gEnd;
      const end = Math.max(Math.min(nextWord, gEnd), start + 0.15);
      cues.push({
        start, end,
        text: g.map((x, j) => (j === i ? `{\\c${HILITE}}${esc(x.t)}{\\r}` : esc(x.t))).join(' '),
      });
    });
  });

  // The end card sits in the SAME bottom slot as the captions, so starting it
  // before the last cue clears is a hard collision, not just visual
  // competition. TAIL_PAD has to be generous enough to leave it a window once
  // the final caption's trailing hold expires.
  const lastCueEnd = cues.length ? Math.max(...cues.map((c) => c.end)) : 0;
  let endCardStart = null;
  if (timeline.endCard) {
    endCardStart = Math.max(videoEnd - ENDCARD_SECONDS, Math.min(lastCueEnd + 0.2, videoEnd - 1.5));
    if (endCardStart >= videoEnd - 0.4) endCardStart = null;
  }

  const fontName = 'Arial';
  const fontSize = Math.round(height * 0.040);
  // Captions must clear the ribbon, which occupies the bottom ~10% of the
  // frame whenever chrome keeps it. Anchoring at the usual 60px would put the
  // text straight through the progress track.
  const marginV = chrome === 'none' ? Math.round(height * 0.065) : Math.round(height * 0.135);
  const ts = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return `${h}:${String(m).padStart(2, '0')}:${(s % 60).toFixed(2).padStart(5, '0')}`;
  };

  const lines = [];
  if (timeline.title) lines.push(`Dialogue: 2,${ts(0)},${ts(TITLE_SECONDS)},Title,,0,0,0,,${esc(timeline.title)}`);
  if (endCardStart != null) lines.push(`Dialogue: 2,${ts(endCardStart)},${ts(videoEnd)},EndCard,,0,0,0,,${esc(timeline.endCard)}`);
  for (const c of cues) lines.push(`Dialogue: 0,${ts(c.start)},${ts(c.end)},Cap,,0,0,0,,${c.text}`);

  const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,${fontName},${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,0,0,0,0,100,100,0,0,1,3,1,2,90,90,${marginV},1
Style: Title,${fontName},${Math.round(fontSize * 1.5)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,-1,0,0,0,100,100,6,0,1,3,1,5,90,90,0,1
Style: EndCard,${fontName},${Math.round(fontSize * 1.1)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,0,0,0,0,100,100,2,0,1,3,1,2,90,90,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${lines.join('\n')}
`;
  return { ass, cues, endCardStart };
}

export function burnCaptions(masterPath, assPath, out, outRoot) {
  // Everything is passed as a bare basename and ffmpeg is run FROM outRoot —
  // see the note on `run`'s cwd parameter for why a full Windows path here
  // silently breaks the subtitles filter.
  run([
    '-i', basename(masterPath),
    '-vf', `subtitles=${basename(assPath)}:fontsdir='C\\:/Windows/Fonts'`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    basename(out),
  ], 'burn captions', outRoot);
  return out;
}

// --- 3. audio ---------------------------------------------------------------

/**
 * Mix narration, score and sfx onto the captioned picture.
 *
 * The score is SIDE-CHAINED to the voice rather than set to a fixed quiet
 * level: a bed loud enough to be felt during the silences is too loud under
 * speech, and one quiet enough under speech is inaudible without it. The
 * compressor is what lets the music actually come up in the gaps between
 * lines — which, in a journey, is where the pictures are doing the talking.
 */
export function mixAudio({ videoIn, out, timeline, narration, score, sfxCues, log = () => {} }) {
  const dur = timeline.duration;
  const inputs = ['-i', videoIn];
  const chains = [];
  const mixLabels = [];
  let n = 0; // input index; 0 is the video

  const voice = narration && existsSync(narration) ? voiceChain(narration) : null;
  const musicGainDb = score && existsSync(score) ? gainToReach(score, musicTargetFor(voice)) : 0;
  if (score) {
    log(
      `levels: voice drive ${fmtDb(voice?.drive)} -> post-comp ${voice?.postComp?.toFixed(1) ?? '?'} LUFS, ` +
      `trim ${fmtDb(voice?.trim)} -> ${voice?.lufs?.toFixed(1) ?? '?'} LUFS at ${voice?.tp?.toFixed(1) ?? '?'} dBTP; ` +
      `music ${musicGainDb.toFixed(1)} dB to ${musicTargetFor(voice).toFixed(1)} LUFS ` +
      `(${(VOICE_TARGET_LUFS - MUSIC_TARGET_LUFS).toFixed(0)} dB under the voice)`,
    );
  }

  // narration, cut into its segments
  let voiceLabel = null;
  if (narration && existsSync(narration)) {
    inputs.push('-i', narration);
    const ai = ++n;
    const segs = timeline.segments?.length
      ? timeline.segments
      : [{ trimFrom: 0, trimTo: 1e6, delay: timeline.leadIn ?? 0 }];

    if (segs.length === 1) {
      const s = segs[0];
      chains.push(`[${ai}:a]${voice.filter},atrim=start=${s.trimFrom},asetpts=PTS-STARTPTS,adelay=${ms(s.delay)}|${ms(s.delay)}[v0]`);
    } else {
      // One source, many uses: it must be split before it can be trimmed more
      // than once. Reusing [ai:a] directly is silently accepted by the parser
      // and then produces silence on every branch after the first.
      chains.push(`[${ai}:a]${voice.filter},asplit=${segs.length}${segs.map((_, k) => `[vs${k}]`).join('')}`);
      segs.forEach((s, k) => {
        chains.push(`[vs${k}]atrim=start=${s.trimFrom}:end=${s.trimTo},asetpts=PTS-STARTPTS,adelay=${ms(s.delay)}|${ms(s.delay)}[v${k}]`);
      });
    }
    if (segs.length === 1) voiceLabel = 'v0';
    else {
      chains.push(`${segs.map((_, k) => `[v${k}]`).join('')}amix=inputs=${segs.length}:normalize=0[voice]`);
      voiceLabel = 'voice';
    }
  }

  // score, ducked under the voice
  if (score && existsSync(score)) {
    inputs.push('-i', score);
    const ai = ++n;
    // Trim/pad to the film's exact length: a score that ends early leaves a
    // hole, and one that runs long is cut mid-phrase by the output bound.
    chains.push(
      `[${ai}:a]volume=${musicGainDb.toFixed(2)}dB,${MUSIC_LEVELLER},${MUSIC_CARVE},` +
      `atrim=0:${dur.toFixed(3)},apad,atrim=0:${dur.toFixed(3)},asetpts=PTS-STARTPTS[music]`,
    );
    if (voiceLabel) {
      chains.push(`[${voiceLabel}]asplit=2[voiceOut][voiceKey]`);
      chains.push(`[music][voiceKey]${DUCK}[ducked]`);
      mixLabels.push('ducked', 'voiceOut');
    } else {
      mixLabels.push('music');
    }
  } else if (voiceLabel) {
    mixLabels.push(voiceLabel);
  }

  // sfx
  for (const [k, cue] of (sfxCues ?? []).entries()) {
    if (!existsSync(cue.file)) continue;
    inputs.push('-i', cue.file);
    const ai = ++n;
    chains.push(`[${ai}:a]volume=${cue.gain ?? 0.7},adelay=${ms(cue.at)}|${ms(cue.at)}[x${k}]`);
    mixLabels.push(`x${k}`);
  }

  if (!mixLabels.length) return null;

  // amix preserves the authored balance (normalize=0); loudnorm then brings the
  // FINISHED mix to the streaming target. Without it the export lands well
  // under platform loudness and sounds thin next to the normalized feed around
  // it — which reads as amateur before a word is understood.
  const body =
    `${chains.join(';')};` +
    `${mixLabels.map((l) => `[${l}]`).join('')}amix=inputs=${mixLabels.length}:normalize=0[mixed]`;

  // Pass 1 — measure the assembled mix. Audio only, decoded to nothing.
  const measured = measureGraph(inputs, body);
  if (measured) {
    log(`mix measured: ${Number(measured.input_i).toFixed(1)} LUFS, ${Number(measured.input_tp).toFixed(1)} dBTP -> normalising to ${LOUDNESS_TARGET.I}`);
  } else {
    log('mix measurement failed — falling back to single-pass loudnorm');
  }

  // Pass 2 — apply it.
  run([
    ...inputs,
    '-filter_complex', `${body};[mixed]${loudnormPass2(measured)}[out]`,
    '-map', '0:v', '-map', '[out]',
    // NOT -shortest: the narration ends before the video does, and that tail is
    // deliberate — it is the end card's window. Bound by the picture instead.
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', dur.toFixed(3),
    out,
  ], 'audio mix');
  return out;
}

/**
 * The ducked score, rendered on its own. Nothing uses this for output — it
 * exists so `film-gate.mjs` can PROVE the duck happened by measuring the
 * score's level inside speech versus between it. Measuring the final mix
 * cannot answer that question: during speech the voice dominates, so the mix
 * gets louder exactly where the music got quieter.
 */
export function renderDuckedScore({ out, timeline, narration, score }) {
  if (!existsSync(score) || !existsSync(narration)) return null;
  const dur = timeline.duration;
  // The SAME measured gains and the SAME chain as the real mix. If this probe
  // used different numbers the gate would be grading a mix nobody will hear.
  const voice = voiceChain(narration);
  const musicGainDb = gainToReach(score, musicTargetFor(voice));
  const segs = timeline.segments?.length ? timeline.segments : [{ trimFrom: 0, trimTo: 1e6, delay: timeline.leadIn ?? 0 }];
  const chains = [];
  if (segs.length === 1) {
    const s = segs[0];
    chains.push(`[0:a]${voice.filter},atrim=start=${s.trimFrom},asetpts=PTS-STARTPTS,adelay=${ms(s.delay)}|${ms(s.delay)}[voiceKey]`);
  } else {
    chains.push(`[0:a]${voice.filter},asplit=${segs.length}${segs.map((_, k) => `[vs${k}]`).join('')}`);
    segs.forEach((s, k) => chains.push(`[vs${k}]atrim=start=${s.trimFrom}:end=${s.trimTo},asetpts=PTS-STARTPTS,adelay=${ms(s.delay)}|${ms(s.delay)}[v${k}]`));
    chains.push(`${segs.map((_, k) => `[v${k}]`).join('')}amix=inputs=${segs.length}:normalize=0[voiceKey]`);
  }
  chains.push(
    `[1:a]volume=${musicGainDb.toFixed(2)}dB,${MUSIC_LEVELLER},${MUSIC_CARVE},` +
    `atrim=0:${dur.toFixed(3)},apad,atrim=0:${dur.toFixed(3)},asetpts=PTS-STARTPTS[music]`,
  );
  chains.push(`[music][voiceKey]${DUCK}[out]`);
  run([
    '-i', narration, '-i', score,
    '-filter_complex', chains.join(';'),
    '-map', '[out]', '-t', dur.toFixed(3),
    out,
  ], 'ducked score probe');
  return out;
}

function ms(seconds) { return Math.max(0, Math.round(seconds * 1000)); }

/**
 * Run the assembled mix graph through loudnorm's measuring pass and return the
 * measured values. Audio only, `-f null`, so it costs a decode and writes
 * nothing.
 */
function measureGraph(inputs, body) {
  const out = probe([
    ...inputs,
    '-filter_complex', `${body};[mixed]${loudnormPass1()}[out]`,
    '-map', '[out]', '-f', 'null', '-',
  ]);
  const start = out.lastIndexOf('{');
  const end = out.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    const m = JSON.parse(out.slice(start, end + 1));
    // loudnorm reports -inf for silence (a dry run), and feeding that back in
    // makes pass two produce nothing at all.
    return isFinite(Number(m.input_i)) ? m : null;
  } catch { return null; }
}
