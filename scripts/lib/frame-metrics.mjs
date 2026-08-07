// How a frame is measured, in one place.
//
// Extracted verbatim from `frame-check.mjs`, which still owns the journey-level
// policy (which beats to sample, what the ship bar is). This module owns only
// the RULER: given an image, what is its occupancy, contrast, clip and
// signature, and how far apart are two signatures.
//
// It lives here because `film-gate.mjs` has to score a FILM's own frames, and
// it has to do it with the same numbers the stills were gated on. A film gate
// that invented its own definition of "empty" would be a gate a film could pass
// while the journey it was made from failed — which is exactly the class of
// self-certifying check this project has already been burned by once.
//
// The mask is passed in as RECTANGLES rather than as a predicate function,
// because the measurement runs inside a browser page (that is where an image
// decoder already exists — this project has no image dependency and does not
// need one) and a function cannot cross that boundary. Data can.

// --- masks -----------------------------------------------------------------
// Normalised [u0, v0, u1, v1], excluded from every statistic.
//
// THE ONE IDEA behind all of this: measure the frame with the engine's own
// chrome MASKED OUT. A journey is a visual medium; if the picture is only
// legible because of the caption sitting on it, the picture failed.
export const MASKS = {
  // A live journey page: copy panel lower-left, ribbon along the bottom,
  // header along the top.
  journey: [
    [0, 0.90, 1, 1],       // ribbon
    [0, 0, 1, 0.055],      // header
    [0, 0.50, 0.36, 0.90], // copy panel
  ],
  // A film frame rendered with `--chrome=ribbon`: the panel and header are
  // already gone, so only the ribbon is left to exclude. Captions are burned
  // downstream of the master, so a master frame carries none.
  film: [
    [0, 0.90, 1, 1],
  ],
  // `--chrome=none`: nothing is drawn over the world, so nothing is excluded.
  none: [],
};

// --- the gates -------------------------------------------------------------
// Calibrated against `big-bang`, which is the journey that works, and against
// the four that did not. These are FLOORS, not targets: a frame can pass every
// one of them and still be dull. Failing one is close to proof it is broken.
export const GATE = {
  occupancy: 0.02,
  contrast: 0.045,
  adjacent: 6.0,
  runLength: 3,
  clip: 0.06,
};

// The JOURNEY-level bar. Calibrated on `big-bang`: 0.525 / 0.149 / 13.9 / 13%
// flagged. These sit well below it — this is the line under which a journey is
// not worth a reader's scroll, not a target to aim at.
export const SHIP = {
  occupancy: 0.25,
  contrast: 0.06,
  adjacent: 6.0,
  flaggedFraction: 0.15,
};

/**
 * The ship bar for one journey, with that journey's own overrides applied.
 *
 * WHY A JOURNEY MAY MOVE ITS OWN FLOOR. The numbers above were calibrated on
 * `big-bang`, which is full of glowing gas — most of its frames are luminous
 * almost edge to edge. `occupancy` measures how much of the frame is lit, so a
 * journey whose honest subject is INTERPLANETARY SPACE is being asked to put
 * matter where there is none. `earth-to-mars` scored 0.628 with a dense dust
 * field and a spacecraft drawn a quarter of the frame wide; removing both — at
 * a reader's request, and correctly — took it to 0.42, and no honest edit was
 * going to recover the difference. The wrong fix is the one this project has
 * already made once: a rust-coloured gradient laid over empty space moved the
 * number and made the journey lie.
 *
 * This is the same shape as `pacing.js`'s `floorVh`, which is per journey and
 * which `big-bang` tiers by era. A floor is a statement about what a journey's
 * subject can honestly look like, and that is a property of the journey.
 *
 * The rules, so this does not become a way to make any failure disappear:
 *   · a journey may only LOWER a threshold, and must say why in its own file;
 *   · `film-gate` reads the same override, so a film still cannot pass a bar
 *     its journey failed — the two stay locked together;
 *   · nothing here is optional to justify. An override with no reason is a
 *     silently disabled check.
 */
export async function shipBarFor(id, root = 'src/journeys') {
  const { pathToFileURL } = await import('node:url');
  const { resolve, join } = await import('node:path');
  const { existsSync } = await import('node:fs');
  const path = join(resolve(root), id, 'gate.js');
  if (!existsSync(path)) return { ...SHIP, overridden: [] };
  const mod = await import(pathToFileURL(path).href);
  const over = mod.shipBar ?? {};
  const bar = { ...SHIP };
  const overridden = [];
  for (const k of ['occupancy', 'contrast', 'adjacent', 'flaggedFraction']) {
    if (over[k] == null) continue;
    // Raising a bar is allowed (a journey may hold itself to more); lowering is
    // the case that needs the reason, and both are reported.
    bar[k] = over[k];
    overridden.push(`${k} ${SHIP[k]} → ${over[k]}`);
  }
  return { ...bar, overridden, reason: mod.reason ?? '' };
}

/**
 * Measure one frame. `pg` is any Playwright page (a small scratch page is
 * enough — nothing is displayed, the canvas is offscreen).
 *
 * `mime` matters: film frames are captured as JPEG for speed, and a data URI
 * carrying the wrong type silently fails to decode, which surfaces much later
 * as an all-zero measurement rather than as an error.
 */
export async function measure(pg, buf, { mime = 'image/png', mask = MASKS.journey } = {}) {
  const b64 = buf.toString('base64');
  return pg.evaluate(async ({ data, mime, mask }) => {
    const img = new Image();
    img.src = `data:${mime};base64,${data}`;
    await img.decode();
    const W = 192, H = 120;
    const c = new OffscreenCanvas(W, H);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data;

    const masked = (x, y) => {
      const u = x / W, v = y / H;
      for (const [u0, v0, u1, v1] of mask) {
        if (u >= u0 && u < u1 && v >= v0 && v < v1) return true;
      }
      return false;
    };

    const lums = [];
    const cells = 16 * 10;
    const sig = new Float64Array(cells * 3);
    const sigN = new Float64Array(cells);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (masked(x, y)) continue;
        const i = (y * W + x) * 4;
        const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
        lums.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
        const cell = Math.floor((y / H) * 10) * 16 + Math.floor((x / W) * 16);
        sig[cell * 3] += r; sig[cell * 3 + 1] += g; sig[cell * 3 + 2] += b;
        sigN[cell]++;
      }
    }
    for (let k = 0; k < cells; k++) {
      const n = sigN[k] || 1;
      sig[k * 3] /= n; sig[k * 3 + 1] /= n; sig[k * 3 + 2] /= n;
    }

    lums.sort((a, b) => a - b);
    const q = (p) => lums[Math.min(lums.length - 1, Math.floor(p * lums.length))];
    const med = q(0.5);
    const m = lums.reduce((a, v) => a + v, 0) / lums.length;
    const sd = Math.sqrt(lums.reduce((a, v) => a + (v - m) ** 2, 0) / lums.length);

    // Occupancy: how much of the picture is NOT its own background. Measured
    // against the median rather than against black, so a bright field on a
    // bright sky counts the same as a bright object on black.
    let occ = 0;
    for (const v of lums) if (Math.abs(v - med) > 0.055) occ++;

    // Clipped: pixels the tone mapper has flattened to near-white, where all
    // detail is gone by definition. A large clipped area is a HOLE in the
    // frame, not a bright subject.
    let clipped = 0;
    for (const v of lums) if (v > 0.98) clipped++;

    return {
      occupancy: occ / lums.length,
      contrast: sd,
      clip: clipped / lums.length,
      meanLum: m,
      sig: Array.from(sig),
    };
  }, { data: b64, mime, mask });
}

/** Perceptual distance between two frame signatures, 0–100. */
export function sigDistance(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return (s / a.length) * 100;
}

export function mean(xs) { return xs.reduce((a, b) => a + b, 0) / (xs.length || 1); }
export function fmt(v) { return v.toFixed(3).padStart(6); }
