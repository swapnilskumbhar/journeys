// Drive the journey along u(t) and screenshot every frame.
//
// This is the whole reason rule 8 exists. `player.js` reads `window.__u` and
// ignores scroll; `stage.js` reads `window.__vt`/`__vtDelta` instead of a wall
// clock; the camera is handed no clock at all. So frame N here is a pure
// function of N, and re-rendering tomorrow gives byte-identical output.
//
// TWO TRAPS, both already paid for once in this repo's history:
//
//   1. `waitForFunction` MUST poll on an interval. Playwright's default is
//      'raf' — and the init script below has replaced requestAnimationFrame
//      with a queue that only drains on __vt.advance(), which cannot run until
//      the wait resolves. With the default, the first (always-false) check is
//      the only check and this deadlocks until timeout.
//
//   2. CSS animation and transition run on the REAL clock, not the virtual
//      one. Any of it left enabled makes a frame depend on how long the page
//      has been open, which is the exact defect rule 8 was written against.
//      So all of it is disabled, unconditionally.
import { chromium } from 'playwright';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { makeCurve } from './solve-timeline.mjs';

const CHROME_HIDE = {
  // Nothing over the world at all — the picture and only the picture.
  none: '.beat-panel, .ribbon, .journey-hero, .home-hero, .back-link, .scroll-hint',
  // The ribbon stays: it is this product's signature, it reads as designed
  // motion graphics rather than as UI, and it tells a viewer where they are
  // in a journey that has no other landmarks.
  ribbon: '.beat-panel, .journey-hero, .home-hero, .back-link, .scroll-hint',
  // The real page. Truest to the product; the panel eats a third of the frame.
  full: '.scroll-hint',
};

export async function renderFrames(timeline, { port = 5175, outDir, quality = 92, onProgress } = {}) {
  const { id, fps, width, height, chrome = 'ribbon', frames: total } = timeline;
  const curve = makeCurve(timeline);

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // Real GPU in headless: without these, Chromium renders WebGL on SwiftShader
  // (CPU) at roughly a second a frame.
  const browser = await chromium.launch({
    args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });

  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  // Installed before any page script runs — it has to replace the clock the
  // whole app animates on. Real timers stay real: they gate boot and lazy
  // chunk loading, not animation.
  await page.addInitScript((dt) => {
    let now = 0;
    let cbs = [];
    let nextId = 1;
    const t0 = Date.now();
    performance.now = () => now;
    Date.now = () => t0 + now;
    window.requestAnimationFrame = (cb) => { const id = nextId++; cbs.push({ id, cb }); return id; };
    window.cancelAnimationFrame = (id) => { cbs = cbs.filter((e) => e.id !== id); };
    window.__vtDelta = dt;
    window.__vt = {
      advance(ms) {
        now += ms;
        const due = cbs;
        cbs = [];
        for (const e of due) e.cb(now);
      },
      now: () => now,
    };
    // Set before boot so the very first rendered frame is the authored opening
    // frame, not wherever u happens to default to.
    window.__u = 0;
  }, 1 / fps);

  await page.goto(`http://localhost:${port}/${id}`);
  await page.waitForFunction(
    () => window.__journey?.journey?.beats?.length > 0,
    null,
    { timeout: 180000, polling: 500 }, // interval polling — see trap 1 above
  );
  await page.waitForTimeout(2500); // real time: fonts and the lazy chunk arrive over the network

  await page.addStyleTag({
    content: `
      ${CHROME_HIDE[chrome] ?? CHROME_HIDE.ribbon} { visibility: hidden !important; }
      body { overflow: hidden; }
      /* trap 2: every frame must be a function of state, never of wall time */
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    `,
  });

  // Warm-up: run the virtual clock a couple of seconds at u=0 so layers have
  // mounted and any entrance envelope has settled before frame 0 is captured.
  for (let i = 0; i < fps * 2; i++) {
    await page.evaluate((ms) => window.__vt.advance(ms), 1000 / fps);
  }

  const frameMs = 1000 / fps;
  const t0 = Date.now();
  for (let f = 0; f < total; f++) {
    const t = f / fps;
    const u = curve(t);
    const look = lookAt(timeline, t);
    // One round trip for all three, rather than three.
    await page.evaluate(({ u, look, ms }) => {
      window.__u = u;
      window.__look = look;
      window.__vt.advance(ms);
    }, { u, look, ms: frameMs });

    // JPEG q92 — several times faster to capture than PNG, and the `gradfun`
    // deband at encode time mops up any residual banding in the dark gradients
    // that this project is mostly made of.
    await page.screenshot({ path: join(outDir, `${String(f).padStart(6, '0')}.jpg`), quality });

    if (onProgress && (f % fps === 0 || f === total - 1)) {
      const done = f + 1;
      const rate = done / ((Date.now() - t0) / 1000);
      onProgress({ frame: done, total, seconds: t, etaSeconds: (total - done) / (rate || 1) });
    }
  }

  await browser.close();
  return { frames: total, errors: [...new Set(errors)] };
}

/**
 * The authored look offset. A second INPUT axis beside u — rule 8 permits
 * exactly this, and in deterministic mode it is authored rather than dragged,
 * so the frame stays a pure function of its inputs.
 *
 * WHY A SHOT MAY NEED TO DRIFT. Some beats do not change on their own. A deep
 * cruise, a starfield, a boundary in empty space: u advances across the beat
 * and the picture is identical at both ends, because the scale law is holding
 * the subject at a constant apparent size and there is nothing else in frame.
 * That reads as a frozen screen for the ten or fifteen seconds the line takes,
 * and it is invisible in any single frame — which is why it survived every
 * still check this project has and had to be caught by the film gate's own
 * `motion` metric.
 *
 * A slow parallax turn across such a shot is the standard documentary answer
 * to a static subject, and here it is nearly free: the world is already built
 * in every direction. Authored as `look: { from: {...}, to: {...} }`, it
 * drifts across the WHOLE shot. `look: { yaw, pitch }` still means a held
 * offset, eased in over the transit.
 *
 * The player clamps to ±40° yaw and ±22° pitch. Beyond that is not parallax,
 * it is a new bearing, and every composition here is authored in world space
 * against a camera on +z.
 */
const YAW_LIMIT = 40;
const PITCH_LIMIT = 22;

function lookAt(timeline, t) {
  const shots = timeline.shots;
  const i = shots.findIndex((o) => t < o.end);
  const s = i >= 0 ? shots[i] : shots[shots.length - 1];
  if (!s?.look) return { yaw: 0, pitch: 0 };

  // Drifting form: ease across the entire shot, transit included, so the move
  // is one continuous gesture rather than a snap followed by a crawl.
  if (s.look.from || s.look.to) {
    const from = s.look.from ?? { yaw: 0, pitch: 0 };
    const to = s.look.to ?? { yaw: 0, pitch: 0 };
    const k = clamp01((t - s.start) / Math.max(1e-6, s.end - s.start));
    const e = k * k * (3 - 2 * k);
    return clampLook({
      yaw: (from.yaw ?? 0) + ((to.yaw ?? 0) - (from.yaw ?? 0)) * e,
      pitch: (from.pitch ?? 0) + ((to.pitch ?? 0) - (from.pitch ?? 0)) * e,
    });
  }

  // Held form: ease in over the transit from wherever the previous shot left
  // the view, then hold, so a cut never snaps the bearing.
  const prev = i > 0 ? shots[i - 1].look : null;
  const from = prev
    ? (prev.to ?? prev ?? { yaw: 0, pitch: 0 })
    : { yaw: 0, pitch: 0 };
  const local = t - s.start;
  if (s.travel > 0 && local < s.travel) {
    const k = clamp01(local / s.travel);
    const e = k * k * (3 - 2 * k);
    return clampLook({
      yaw: (from.yaw ?? 0) + ((s.look.yaw ?? 0) - (from.yaw ?? 0)) * e,
      pitch: (from.pitch ?? 0) + ((s.look.pitch ?? 0) - (from.pitch ?? 0)) * e,
    });
  }
  return clampLook({ yaw: s.look.yaw ?? 0, pitch: s.look.pitch ?? 0 });
}

function clampLook({ yaw, pitch }) {
  return {
    yaw: Math.max(-YAW_LIMIT, Math.min(YAW_LIMIT, yaw)),
    pitch: Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch)),
  };
}
function clamp01(x) { return Math.min(1, Math.max(0, x)); }
