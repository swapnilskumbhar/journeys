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
  pacing — in viewport-heights**: it prints every beat's scroll in vh and fails
  if a scene beat (19–30) drops under 1.5 or a human-era beat (31+) under 1.2.
  Gating on a fraction of the AXIS is
  what let the original pacing bug through — "A star is born" was 0.4 vh, about
  360 px for the whole formation of the solar system, and looked ordinary by
  every axis-relative measure. The human era then repeated it: "The wheel" was
  0.13 vh. Extend it whenever axis or rebase behaviour
  changes; these are the modules most likely to be wrong in ways that only show
  up 12 decades into a journey.
- Screenshots — the only reliable way to SEE a journey (the Browser pane is
  compositor-throttled and its screenshots time out):
  `node scripts/shots.mjs <id> [outDir] [port] [--at=0.1,0.5] [--sheet]`.
  Default is one shot per beat, sampled mid-beat; `--sheet` emits
  `contact-sheet.png` (one image = whole-journey review).
- Real scroll path — `node scripts/scroll-check.mjs`. Everything in shots.mjs
  drives `window.__u` directly, which bypasses scroll entirely; this is the only
  check that exercises document scroll → u, the wheel not being eaten by the
  canvas overlay, ribbon tick navigation, **ribbon drag-scrubbing** (tracks the
  pointer, no drift after release) and **camera purity** (hold u, run three
  virtual minutes past, assert the camera has not moved). Run it after touching
  player.js, ribbon.js, or anything about layout.

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
| src/archetypes/ | **the reusable visual vocabulary** — particleField, glowSphere, filaments, planet, terrain, blocks, backdrop, silhouette, panel, water, blob |
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
   **The camera is handed no clock at all**, and `player.js` enforces that by
   not passing one. Where the frame is, which way it faces and what it is aimed
   at are `u` and nothing else, because the reader can arrive at any point from
   any direction at any speed and must get the frame that beat was composed for.
   Idle motion — drift, twinkle, flow — belongs to the LAYERS, which do get `t`.
   A drag also lands whole: damping in the player smooths wheel jitter only, and
   any jump over 1.2 vh is applied in one frame, so the frame never swims to
   catch up with the pointer or keep travelling after it stops.
9. **Verify with evidence, not vibes.** The build must pass, and screenshots
   must have been LOOKED AT before calling anything done. Framing, occlusion and
   copy-vs-visual truth are judged by eyes.

## Status (2026-07-28)

**`big-bang` ships** — 39 beats, Planck epoch to today, 82 vh, its own lazy
chunk. The frame goes where each beat's subject is and only returns to orbit for
"Today": cosmic web → galaxy → molecular cloud → protoplanetary disc → the
Moon-forming impact → a Hadean sea → stromatolite shallows → **one cell at 20
microns** → the Ediacaran seafloor → out of the water onto a Devonian shore →
Siberian flood basalt → **the Chicxulub fireball** → a moonlit migration → a
grain field with people in it → **an ox cart with spoked wheels** → **a
lamplit clay tablet at a 1.5 m frame** → a mill town under coal smoke → the
night-lit planet. Eleven archetypes (particleField, glowSphere, filaments,
planet, terrain, blocks, backdrop, silhouette, **panel**, water, blob) cover
all of it with no bespoke Three.js in the journey folder.

Camera-determinism lesson, the most recent pass:

- **The one thing that was not a function of `u` cost more than everything it
  bought.** The camera bearing was `t * 0.035` — a slow idle orbit so a
  stationary reader never saw a frozen frame. But every composition in the
  journey is authored in WORLD space (`offsetMeters`, `lightDir`, `sunDir`,
  which way the silhouettes face), all of it against a camera on +z. Measured:
  same `u`, the Earth–Moon pair was **28° off at 45 s, 76° at 134 s**, and past
  three minutes the Moon passed behind the planet it had just been thrown off.
  So the frame you got for a beat depended on how long the tab had been open,
  scrubbing to a beat did not reliably show you that beat, and two review shots
  of one `u` were two different pictures — which quietly undermines rule 9 as
  well as rule 8. The bearing is now an authored `AZIMUTH` table beside `CAM`,
  `LOOK_Y` and `PAN`: it swings through the deep field, where plasma shells and
  the cosmic web look the same from any side and turning is free parallax, and
  holds at 0 from the protoplanetary disc onward. Idle motion was always the
  layers' job — they have the clock.
- **Damping is for wheel jitter, and nothing else.** One easing rule was serving
  two gestures. On a drag it meant the frame swam through every scene in between
  while the pointer was still down, then kept travelling after it came up. The
  threshold is in **viewport-heights**, not in `u`, so it keeps its meaning when
  a journey's length changes — the same lesson the pacing gate taught.
- **`behavior: 'auto'` is not instant.** `html` carries `scroll-behavior:
  smooth`, and `auto` defers to it, so a "non-smooth" scrub still animated the
  page out from under the finger. `'instant'` is the keyword that means instant.

Human-era lessons (beats 30–38):

- **Every era needs the vh gate, not just the one where the bug was found.** The
  life era got per-beat segments and a 1.5 vh floor; the human era was left on a
  single lookback segment and "The wheel" came out at **0.13 vh** — 120 pixels of
  scroll for the whole invention of wheeled transport, Farming at 0.36. Honest
  dates constrain where a beat SITS, never how much scroll it gets: a segment
  boundary at each beat's own mark buys any weighting you like. `smoke.mjs` now
  floors beats 31+ at 1.2 vh.
- **An instantaneous event inside a long beat needs its own segment.** Beat 30
  spans 66 → 7 Myr, so the strike was in the first 1% of it and every review
  frame showed a recovered world. A dedicated linear window (66.2 → 65.9 Ma)
  plus a *separately weighted* aftermath segment puts the beat's midpoint at
  66.0 Ma — the fireball. The aftermath's weight is the whole control: fold it
  back in with the beats that follow and the midpoint slides off the end.
- **Camera height is in UNITS, and units scale with the frame.** `y = 0.45` is
  nine metres up at an 80 m frame. Every human beat was being shot from a
  first-floor window, which puts anything shorter than the camera BELOW the
  horizon, where a silhouette has dark ground behind it instead of sky. Eye
  level down here is `y ≈ 0.1`.
- **Frame ≤ terrain radius / 6**, because the camera sits six units out. The
  Mesozoic ground was a 9e4 m disc being viewed at 3e4 m frames — the camera was
  twice as far out as the world was wide.
- **A scatter has to enclose the camera.** A 42 m crop field photographed from
  66 m away is a picture of a field taken from outside it. And what changes an
  instance's apparent size is landing on the camera's side of the group —
  `offsetMeters`, not a wider `areaMeters`.
- **`blocks` built crescents, not towns.** Walking the grid and stopping at
  `count` fills rows of increasing x and quits; every settlement in the journey
  had been missing its east side since the archetype was written. Score all
  cells, sort, truncate.
- **A warm sky turns any bright glow into a sunrise.** The K–Pg fireball lost to
  its own sky twice — first to the Siberian sun disc, then to the horizon band —
  before the sky was driven to black at the strike.
- **Additive debris beside a fireball is invisible.** Same lesson as the ash and
  the dust, one step further: sparks ADD to the glare they sit in. Dark,
  normal-blended ejecta is what reads, because it blocks the brightest thing in
  the frame.
- **Rows are the difference between a crop and a meadow** — and they only read
  when the gap between rows is several times the spacing along them.
- **Some subjects are not shapes.** "Writing" cannot be told with a skyline; the
  content of the beat is fingernail-sized. `panel` (a slab carrying procedural
  marks) plus a dive to a 1.5 m frame is the answer, and it is the same move the
  journey already makes for a living cell.

Life-era lessons (beats 20–30), on top of the surface and exposure ones below:

- **Pacing bugs hide from axis-relative checks.** Segment weights were set when
  the life era was nine static globes needing no time, and nothing caught it
  when those beats started carrying scenes. Measure in viewport-heights — what
  the reader actually scrolls — and gate on it.
- **A beat's midpoint is where it gets reviewed.** `shots.mjs` samples mid-beat,
  and four separate layers were keyed to arrive or leave before that point, each
  producing a black frame with a caption on it. A layer must cover its beat END
  TO END, and anything whose relevance depends on altitude should be gated on
  `rebase.frameMeters()` rather than on u.
- **Events need three phases, not an aftermath.** The Moon beat showed a molten
  globe with a grey disc beside it while the copy described a collision.
  Approach → strike → coalescence, staged in the layer envelopes, is the pattern
  the K–Pg beat then reused verbatim.
- **Additive blending cannot draw a hole.** Dark molecular cloud, volcanic ash
  and impact dust all came out as grey glows brightening the sky they were
  supposed to blot out. `blending: 'normal'` exists for exactly those.
- **A ground disc must be seen from below its own horizon.** Pull the frame
  wider than the terrain's radius and the world becomes a saucer floating in
  space — the rim alpha fade is designed to read as haze, not as an edge.
- **Silhouettes have no ground-following.** They stand at y=0, so terrain relief
  inside the scatter radius buries them. Keep `flattenMeters` ≥ the cast's
  `areaMeters`, and use `nearFadeMeters` — `centreClear` only holds instances
  off the ORIGIN, and the camera is neither at the origin nor still.

Surface-era lessons:

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
  three lines away from the actual problem. Relatedly: the GLSL lives in JS
  template literals, so a **backtick in a shader comment** ends the literal
  three hundred lines early and the parse error points at the comment.

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
