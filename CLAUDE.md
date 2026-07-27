# journeys

Interactive 3D **journeys**: one continuous world travelled along a single
monotonic axis — time, distance, or scale. Scroll maps to that axis; camera,
world state, copy and the ribbon are all pure functions of it. Three.js + Vite.
Fully procedural — no external 3D assets, ever.

Sibling project to `howitworks` (`E:\projects\howitworks`, brand: whatDstuff).
That one explains **mechanisms** — N independent looping scenes, one camera
fly-to each. This one explains **journeys**. Do not merge them; the loop-per-
step model is correct there and wrong here.

First journeys: Big Bang → today · Earth → the observable universe ·
launch pad → Mars.

## Commands (Windows — call node by absolute path; shell cwd drifts)

- Dev: `& "C:\Program Files\nodejs\node.exe" node_modules/vite/bin/vite.js --port 5175`
- Build (run before calling any change done — the dev server masks
  duplicate-identifier errors as a blank page with no console output):
  `& "C:\Program Files\nodejs\node.exe" node_modules/vite/bin/vite.js build`
- Engine + axis math (pure modules, no browser) — must print `SMOKE PASS`:
  `& "C:\Program Files\nodejs\node.exe" scripts/smoke.mjs`. Covers axis
  round-tripping, segment seams, monotonicity, the rebaser band, and **beat
  pacing** (no two beats closer than 0.3% of the axis, no gap wider than 11%).
  Extend it whenever axis or rebase behaviour changes; these are the modules
  most likely to be wrong in ways that only show up 12 decades into a journey.
- Screenshots — the only reliable way to SEE a journey (the Browser pane is
  compositor-throttled and its screenshots time out):
  `node scripts/shots.mjs <id> [outDir] [port] [--at=0.1,0.5] [--sheet]`.
  Default is one shot per beat, sampled mid-beat; `--sheet` emits
  `contact-sheet.png` (one image = whole-journey review).
- Real scroll path — `node scripts/scroll-check.mjs`. Everything in shots.mjs
  drives `window.__u` directly, which bypasses scroll entirely; this is the only
  check that exercises document scroll → u, the wheel not being eaten by the
  canvas overlay, and ribbon tick navigation. Run it after touching player.js,
  ribbon.js, or anything about layout.

## Map

| Path | Role |
| --- | --- |
| src/main.js | History-API router: `/` index · `/<id>` journey |
| src/engine/axis.js | the axis model — u ↔ real-world value, linear or log |
| src/engine/rebase.js | **scale rebasing** — how 27 orders of magnitude fit in float32 |
| src/engine/stream.js | layer windowing — mount/dispose around u, with hysteresis |
| src/engine/stage.js | renderer: log depth buffer, emissive + bloom, no floor |
| src/engine/journey.js | `defineJourney` + registry glob (eager meta.js, lazy index.js) |
| src/engine/player.js | scroll → u → camera + layers + one swapped copy panel |
| src/engine/ribbon.js | left→right progress HUD, doubles as navigation |
| src/archetypes/ | **the reusable visual vocabulary** — particleField, glowSphere, filaments, planet |
| src/kit/ | procedural toolkit ported from howitworks (shared by copy) |
| src/journeys/\<id\>/ | meta.js · axis-def.js · beats.js · layers.js · curve.js · index.js |
| scripts/ | smoke.mjs · shots.mjs · scroll-check.mjs · video export (**export-video/narration still need retargeting to `__u`**) |

## Rules

1. **Never write a world-space position.** Declare real quantities in metres and
   convert through `rebase.toWorld()` every frame. A hardcoded
   `mesh.position.z = -400` is a bug that surfaces twelve decades later. Same
   for sizes and for the fade weight (`rebase.weight()`) — objects dissolve in
   and out of the renderable band, they never pop.
2. **Content is data, not code.** A journey declares beats and layers; the
   engine and the archetype library draw them. When a journey needs new
   rendering, add a reusable **archetype** (particle-field, orbital,
   nested-shells, terrain-morph, flow-ribbons) — do not write a bespoke module
   for one topic. This is what makes 100+ journeys possible; break it once and
   the project becomes a pile of one-off apps.
3. **The window is the point.** Never build the whole journey up front. Layers
   mount and dispose around the current axis position, so frame cost is
   independent of journey length. Unmount must dispose geometry, materials and
   textures — Three.js does not free GPU memory on `remove()`.
4. **One copy panel, contents swapped** — never one DOM section per beat. Beat
   counts are unbounded; the DOM cost must stay O(1), same as the scene graph's.
5. **Vertical scroll in, horizontal journey out.** Never hijack horizontal
   scroll. The left→right reading comes from the ribbon and the camera. Any
   full-viewport overlay needs `pointer-events: none` or it eats the wheel — and
   the wheel is this product's only input.
6. **Real URLs from day one.** History API routing, a prerendered HTML shell per
   journey, OG tags, sitemap. howitworks shipped hash routing and its whole
   library is one page to search; that mistake is not repeated here.
7. **The engine is shared.** Never bend axis/rebase/stream/stage to one
   journey's needs — put special behaviour in that journey's own folder.
8. **Determinism for export.** The player reads `window.__u` when defined and
   scroll otherwise; the stage reads `window.__vt`. A journey's visual state
   must be a pure function of `u` — no accumulated state, no wall-clock reads —
   or exported video will not be reproducible.
9. **Verify with evidence, not vibes.** The build must pass, and screenshots
   must have been LOOKED AT before calling anything done. Framing, occlusion and
   copy-vs-visual truth are judged by eyes.

## Status (2026-07-27)

**`big-bang` ships** — 39 beats, Planck epoch to today, its own lazy chunk.
The zoom does not stop at Earth: after the K–Pg beat the same dive that went
cosmic-web → galaxy → disc continues to the ground — a campfire on the savanna
(300 m frame), firelight spreading across a night aerial for Out of Africa,
fields, a lamplit village for the wheel, the first city for writing, the
electrified industrial city — then pulls back to orbit so "Today" ends on the
night-lit planet. Six archetypes (particleField, glowSphere, filaments, planet,
**terrain**, **blocks**) cover all of it with no bespoke Three.js in the
journey folder.

Surface-era lessons, in addition to the exposure ones below:

- **Lights read at any scale; geometry does not.** A 4 m hut is sub-pixel in a
  1.5 km frame. Every settlement is sold by a warm point-field (lamps) plus a
  block field that only needs to read as texture — same trick as the Out of
  Africa fire constellation. Never fix this by inflating building sizes.
- **Key ground visibility on the FRAME, not on u.** The terrain fades in below
  ~1.1e6 m frames and out above; Earth fades on the rebase band at almost the
  same widths, so orbit↔surface hand-offs cost nothing and the fall is never a
  black screen.
- **The terrain plane is square.** Its rim must alpha-fade to a circle or the
  corners read as a dark sheet during the pull-back.
- `patch` is a GLSL reserved word. Shader compiles fail with a one-word hint
  three lines away from the actual problem.

Things the first journey taught, which the next one should not relearn:

- **Exposure is the hard part, not geometry.** Additive points with 1/z
  attenuation and a zero bloom threshold turn any dense field into a white
  rectangle. Point size is clamped in the shader (`uMaxSize`) and bloom runs a
  0.42 threshold. Every dense field also carries an explicit opacity multiplier
  well below 1.
- **`rebase.weight()` is not optional.** Any layer sized in fixed metres must
  fade on the band, or the scale law leaves it behind as a full-frame wash
  rather than removing it. All four archetypes do this by default
  (`respectBand`). `MAX_UNITS` is 150 — about 20× the frame — for this reason.
- **Pace the scale law against the BEATS, not the axis.** Several beats
  originally spent their entire scroll travelling away from their own subject.
  Hold the frame across a beat, then move in the gap after it.
- **"Physically where the observer was" ≠ legible.** The camera used to dive
  inside the primordial plasma, which is true and renders as featureless white.
  The camera now stays 4.5–7 units out for the whole journey; whether we are
  "inside" something is decided by that layer's radius, not by moving.
- **Verify the real scroll path separately.** `shots.mjs` drives `__u` and will
  happily pass while scrolling is broken; `scroll-check.mjs` caught an
  unreachable final beat and off-by-one ribbon navigation.

Still to do: `export-video.mjs` / `make-narration.mjs` are the howitworks
originals and still target `__hiw` + discrete step indices. Retargeting them to
the `__u` scalar should be simpler than the original, not harder. Nothing is
deployed yet — no host, no domain, no OG images (`/og/<id>.png` is referenced by
the prerender step but not generated).
