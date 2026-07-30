# journeys

Interactive 3D **journeys**: one continuous world travelled along a single
monotonic axis — time, distance, or scale. Scroll maps to that axis; camera,
world state, copy and the ribbon are all pure functions of it. Three.js + Vite.
Fully procedural — no external 3D assets, ever.

Sibling project to `howitworks` (`E:\projects\howitworks`, brand: whatDstuff).
That one explains **mechanisms** — N independent looping scenes, one camera
fly-to each. This one explains **journeys**. Do not merge them; the loop-per-
step model is correct there and wrong here.

Five journeys ship: Big Bang → today · Earth → the Moon · launch pad → Mars ·
the Voyager Grand Tour → interstellar space · a blade of grass → the centre
of the Earth.

## Commands (Windows — call node by absolute path; shell cwd drifts)

- Dev: `& "C:\Program Files\nodejs\node.exe" node_modules/vite/bin/vite.js --port 5175`
- Build (run before calling any change done — the dev server masks
  duplicate-identifier errors as a blank page with no console output):
  `& "C:\Program Files\nodejs\node.exe" node_modules/vite/bin/vite.js build`
- Engine + axis math (pure modules, no browser) — must print `SMOKE PASS`:
  `& "C:\Program Files\nodejs\node.exe" scripts/smoke.mjs`. Covers axis
  round-tripping, segment seams, monotonicity, the rebaser band, and **beat
  pacing — in viewport-heights**: it prints every beat's scroll in vh and fails
  if it drops under that journey's OWN `floorVh(index1)`, exported from each
  journey's own `pacing.js` (big-bang tiers its floor by era — 1.5 vh for
  scene beats 19–30, 1.2 vh for the human era 31+ — the other four use a flat
  1.5 vh because every one of their beats stages a concrete scene). Gating on
  a fraction of the AXIS is what let the original pacing bug through — "A star
  is born" was 0.4 vh, about 360 px for the whole formation of the solar
  system, and looked ordinary by every axis-relative measure. The human era
  then repeated it: "The wheel" was 0.13 vh. Runs every registered journey by
  default; pass one or more ids (`node scripts/smoke.mjs voyager`) to check
  only those. Extend it whenever axis or rebase behaviour changes; these are
  the modules most likely to be wrong in ways that only show up 12 decades
  into a journey.
- Screenshots — the only reliable way to SEE a journey (the Browser pane is
  compositor-throttled and its screenshots time out):
  `node scripts/shots.mjs <id> [outDir] [port] [--at=0.1,0.5] [--sheet]`.
  Default is one shot per beat, sampled mid-beat; `--sheet` emits
  `contact-sheet.png` (one image = whole-journey review).
- Deployed URL shape — `node scripts/pages-check.mjs dist /journeys/`, after a
  build. Serves `dist` with GitHub Pages' actual rules (exact file, directory
  index, 301 on a missing trailing slash, `404.html` with a 404 status) and
  checks the asset prefix, cold deep links and in-app nav. **Not `vite
  preview`** — preview falls back to index.html for any unknown path, which is
  precisely what Pages does not do, so a broken deep link passes there and 404s
  in production.
- Real scroll path — `node scripts/scroll-check.mjs [id] [port]`. Defaults to
  the first registered journey; pass an id to check a specific one (e.g.
  `crust-to-core`). Everything in shots.mjs drives `window.__u` directly,
  which bypasses scroll entirely; this is the only check that exercises
  document scroll → u, the wheel not being eaten by the canvas overlay, ribbon
  tick navigation, **ribbon drag-scrubbing** (tracks the pointer, no drift
  after release) and **camera purity** (hold u, run three virtual minutes
  past, assert the camera has not moved). Run it after touching player.js,
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
| src/archetypes/ | **the reusable visual vocabulary** — particleField, glowSphere, filaments, planet, terrain, blocks, backdrop, silhouette, panel, water, blob, vehicle, trajectory, rocks, strata, **tower, cloudDeck** |
| src/kit/camrig.js | `aimCamera(cam, {pos, azimuthDeg, lookAt, pan, rollDeg})` — shared camera-aiming helper; `rollDeg` decides where the travel axis lands on screen |
| src/kit/ | procedural toolkit ported from howitworks (shared by copy) |
| src/journeys/\<id\>/ | meta.js · axis-def.js · beats.js · layers.js · curve.js · index.js |
| scripts/ | smoke.mjs · shots.mjs · scroll-check.mjs · **frame-check.mjs** · video export (**export-video/narration still need retargeting to `__u`**) |

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
   **Reader INPUT is not a clock.** Left-dragging the canvas turns the view, and
   that does not breach this rule: `u` is already input, and the look offset is
   a second input axis beside it, so the camera stays a pure function of
   `(u, look)` — same inputs, same frame, forever. What the rule bans is state
   that changes on its own. Three properties keep the authored work safe: the
   turn is CLAMPED (±40° yaw, ±22° pitch — parallax, not a new bearing, because
   every composition here is authored in world space against a camera on +z);
   it RETURNS to the authored direction on release, so the next beat is framed
   as written; and it is DISABLED whenever `window.__u` is set, so every review
   and export path is byte-identical. `window.__look = {yaw, pitch}` authors a
   turn deliberately in deterministic mode.
9. **Verify with evidence, not vibes.** The build must pass, and screenshots
   must have been LOOKED AT before calling anything done. Framing, occlusion and
   copy-vs-visual truth are judged by eyes.

## Status (2026-07-29)

**Five journeys ship**, each its own lazy chunk:

- **`big-bang`** — 39 beats, Planck epoch to today, 82 vh. The frame goes
  where each beat's subject is and only returns to orbit for "Today": cosmic
  web → galaxy → molecular cloud → protoplanetary disc → the Moon-forming
  impact → a Hadean sea → stromatolite shallows → **one cell at 20 microns** →
  the Ediacaran seafloor → out of the water onto a Devonian shore → Siberian
  flood basalt → **the Chicxulub fireball** → a moonlit migration → a grain
  field with people in it → **an ox cart with spoked wheels** → **a lamplit
  clay tablet at a 1.5 m frame** → a mill town under coal smoke → the
  night-lit planet.
- **`earth-to-moon`** — pad to lunar surface, the Earth–Moon pair framed with
  the origin at the spacecraft throughout.
- **`earth-to-mars`** — 28 beats, 64 vh, a Hohmann-class transfer with a
  shrinking, dimming Sun as its own first-class subject through the empty
  cruise, ending on rust-coloured ground with foreground boulders (`rocks`).
- **`voyager`** — 32 beats, 82 vh, the real 1977 Grand Tour: four giant-planet
  encounters bought with gravity assists, the Pale Blue Dot, the heliopause,
  and an honest closing statement about the distance to Proxima Centauri.
- **`crust-to-core`** — 27 beats, 68 vh, a straight-down descent from a blade
  of grass to the centre of the Earth: topsoil → the deepest mine and the
  deepest borehole humans have made → the Mohorovičić discontinuity →
  peridotite and diamond-depth kimberlite → the transition zone → the
  core–mantle boundary, the sharpest change in the planet → molten iron and
  the planet's own magnetic dynamo → a solid inner core at the Sun's surface
  temperature, held solid by pressure alone.

Fifteen archetypes (particleField, glowSphere, filaments, planet, terrain,
blocks, backdrop, silhouette, panel, water, blob, **vehicle, trajectory,
rocks, strata**) cover all of it with no bespoke Three.js in any journey
folder.

Rendering and composition lessons, the current pass (`earth-to-moon` rework):

- **Travel must be perpendicular to the camera.** This journey put Earth at -y
  and the Moon at +y, so the flight path ran straight UP the frame: the
  trajectory was a vertical stripe, the ship never crossed anything, the two
  worlds sat 180° apart and no frame could hold both, and the departed planet
  landed underneath the copy panel. Rule 5 asks for the opposite — vertical
  scroll in, horizontal journey out. The fix is `rollDeg` in `camrig.js` plus a
  `ROLL` table: 0° through the ascent (down is NOT arbitrary there — the ground
  really is at -y and a rolled horizon looks broken), 90° across the coast, back
  to 0° for the lunar descent. No object moves; only the camera turns, and the
  roll becomes the story at the point it happens — the world tipping over is
  where a crew stops having a floor. Measured: occupancy 0.393 → 0.461,
  adjacent 8.1 → 10.1, from one number.
- **The frame-check gate.** `scripts/frame-check.mjs` masks out the copy panel,
  ribbon and header and measures only the picture left: `occupancy`, `contrast`,
  `adjacent`. It exists because a batch of four journeys built clean, passed
  smoke and scroll-check, was signed off as "screenshots looked at", and shipped
  with 20 of 32 `voyager` beats being the same white sticker on black. If the
  picture is only legible because of the caption on it, the picture failed.
  `--look=32` additionally scores the view off-axis, which readers can now reach
  by dragging. See the `journey-craft` skill for the composition rules behind it.
- **A scale law can cancel the only thing a stretch has to show.** The coast's
  documented law is `frame = 0.571 × min(...)` — frame the nearer body at seven
  units — but the TABLE anchored one value per beat and held it while the
  distance grew, so `k` drifted 7 → 2 inside a single beat and the frame widened
  at exactly the rate that cancelled Earth shrinking. Earth was the same ~20°
  disc at 25,000 km and at 260,000 km. Sampling the real formula densely gives
  the actual arc: 69° → 21° → 6.7° → 2.1°. Same defect class as the anchor-drift
  lesson below, one step worse: the table did not merely drift, it inverted the
  narrative.
- **One geometry can be right for the limb and wrong for the cruise.** `SUN` was
  tuned so the terminator crossed the visible disc from ORBIT, where the camera
  is beside the planet. On the way out the ship is ABOVE Earth and the camera
  looks down the +y face, which a sun carrying 0.12 in y barely lights — so
  every coast beat rendered the NIGHT hemisphere, a dark ball with city lights,
  while the copy said "the whole Earth". Earth now has its own `EARTH_SUN` with
  a real +y term; the Moon and the ascent keep theirs.
- **PBR without a light renders black.** `vehicle` moved from a custom lambert
  shader to `MeshStandardMaterial` so hard surfaces get roughness, metalness and
  real shadows — the `castShadow` flags in `kit/geometry.js` had been inert
  since the port because no light and no shadow map ever existed on this stage.
  The rig is `stageOptions.sun` and it is OPT-IN, which immediately cost
  `voyager` 0.026 → 0.019 occupancy for one build: it uses `vehicle` and had no
  sun. Any journey using a PBR archetype must declare a sun.
- **Boxes make a town; they cannot make a structure.** The launch complex was
  `blocks` and read as one brown slab beside the rocket. A tower is mostly
  HOLES — legs, bay ties, alternating cross-bracing, a crane head, swing arms
  reaching to the vehicle. That is an archetype gap, not a tuning problem:
  `tower` (`src/archetypes/tower.js`) now serves derricks, masts, cranes and
  scaffolding too. Apply the name-the-object test: cover the caption, and if a
  stranger would say "some vertical bars", no lighting or scale will save it.
- **A layer can be mounted, visible, at 0.86 opacity, and still invisible.**
  `cloudDeck` replaced 3,000 point sprites (a sprite is a round hard-edged disc,
  so a field of them reads as cotton balls whatever the count). The deck sits at
  a real 2 km, and with the camera aimed at the horizon the whole layer
  compressed into a band at the skyline. Aiming down helped and did not fix it.
  The actual cause was transparent RENDER ORDER: the deck and the terrain under
  it are both transparent, and Three sorts transparent objects by distance to
  the camera, which for two near-coplanar sheets seen almost edge-on is a coin
  toss the ground kept winning. An explicit `renderOrder` fixed it in one line.
  **Sorting is not a way to say "this is on top"; saying so is** — and when a
  layer probes as mounted, visible and at full opacity, stop tuning its
  parameters and go looking at draw order.

Spaceflight-and-descent batch lessons (`earth-to-mars`, `voyager`,
`crust-to-core`), the most recent pass:

- **A subject off the camera's own boresight is INVISIBLE, not merely
  off-centre.** This cost two journeys in the same batch. `earth-to-mars` lost
  the Sun during "a dimmer sun" and, separately, its whole Mars-as-a-point
  sequence, because the layer's authored offset direction and the camera's
  authored `LOOK_X`/aim were two independently-chosen numbers meant to
  coincide — measured, they drifted 70°+ apart. `earth-to-moon`'s Earthrise
  beat had the same defect for a different reason: Earth sits diametrically
  opposite the Moon on the shared Y axis, and there is no `LOOK_Y` scalar that
  aims at a nearby body ahead and a distant one behind in the same shot. Fix:
  a layer that must appear ON the camera's aim point should be placed at a
  world position DERIVED FROM the same formula the camera uses to aim,
  never at an independently-authored offset — one number, not two that are
  supposed to agree.
- **Anchor tables keyed to a beat's own start-mark drift by the beat's
  MIDPOINT — where it is actually reviewed.** `voyager`'s first pass gave the
  scale law and vertical look an anchor TABLE per beat, interpolated between
  marks. That works exactly AT the anchors and nowhere else: by 45% into a
  beat (`shots.mjs`'s sampling point), a moving subject's true offset has
  already drifted from the value the table was built for, so several beats
  pointed the camera at empty space. The fix is a literal per-frame FORMULA
  of `u`, not a table: `frame = max(4 × radius, 1.3 × |offset|)`, with
  "nearest body" chosen by the axis position itself rather than authored per
  beat. `earth-to-mars`'s two-body law (`frame = 0.571 × min(...)`) is the
  same idea one body simpler.
- **The encounter/departure segment split is the general fix for "the copy
  promises a world and the frame delivers a dot."** Same pattern as this
  file's own K–Pg lesson, generalised: any beat built around a close approach
  needs its own TIGHT axis segment sized to a few times the subject's own
  radius (not an arbitrary "small" fraction of the full journey — `voyager`'s
  first attempt at this used ~0.05 AU windows around Saturn/Uranus/Neptune,
  which is still ~100–300 planet-radii and renders as a point), plus a
  separately-weighted departure segment whose weight is the whole control
  over where the beat's own midpoint lands. The beat's own MARK also has to
  sit ON the body's true position — Saturn's two beats were marked 0.4–0.6 AU
  short of Saturn's real 9.58 AU orbital radius, so even a perfectly tight
  segment was tight around the wrong point.
- **The origin-is-the-spacecraft convention generalises to N bodies.** Every
  body's offset from the ship is `trueDistance(body) − shipDistance`, positive
  ahead, negative behind, recomputed every frame from the axis value — proven
  for two bodies in `earth-to-moon`/`earth-to-mars`, and `voyager` runs it for
  six (Earth, the Sun, and four giant planets) with the camera aimed at
  whichever is currently nearest in heliocentric range.
- **A field entirely inside opaque solid material is exactly as prone to
  "twenty identical rectangles" as a field of real emptiness is to "twenty
  black rectangles."** `crust-to-core` is inside rock or metal for its whole
  length, no sky, no horizon. The fix needed a genuinely new archetype:
  `strata` (`src/archetypes/strata.js`) is a material shell enclosing the
  camera — the inverse of `backdrop`, which is a shell meant to be seen
  THROUGH — driven by ONE continuous function of real depth for colour,
  band structure, vein density and grain, plus a second continuous `glow`
  term (0 = lit only by an authored lamp, 1 = fully self-luminous) that
  crosses steeply exactly at the core–mantle boundary rather than fading
  across the whole mantle. A first pass lit this shell with a literal
  fixed-world-space lamp direction, which meant whichever hemisphere the
  camera happened to be facing (it rotates via `AZIMUTH`) was frequently the
  UNLIT one — the wall read as a black rectangle for most of the crust and
  mantle despite `opacity` being 1 the whole time. An authored "lamp" that is
  meant to read as illumination from wherever the camera looks needs a strong
  ambient floor, not a strictly directional term.
- **Near-white saturated fill under this stage's bloom (threshold ~0.42) is
  a blown-out blank rectangle in a different colour, not a solved "glowing"
  beat.** `crust-to-core`'s inner core was first authored at literal
  `0xfff8e8`-class near-white, and every one of its last three beats
  converged on one indistinguishable pale wash. Capping the glow palette
  short of pure white and keeping `grain` non-trivially non-zero even while
  fully self-luminous is what keeps "rock that glows" readable as MATERIAL
  through to the final beat, rather than as a light source with no texture
  left in it.
- **A ribbon readout whose STRING LENGTH swings widely across the axis
  visibly narrows the scrub track, and `scroll-check.mjs`'s drag test can
  make that look like an engine bug.** `crust-to-core`'s `formatDepth`
  concatenated a kilometre figure AND a percentage past 1e5 m
  (`"2,895 km down · 45.4% to centre"`), swinging ~19–34 characters wide.
  `.ribbon-readout` is `min-width` but not `max-width`, and sits beside
  `.ribbon-track` (`flex: 1`) — so the track visibly narrows as the reader
  scrubs into long-format territory. This is cosmetic for a real user
  (`ribbon.js`'s drag handler re-reads `getBoundingClientRect()` on every
  `pointermove`, so a pointer never actually decouples from the track), but
  `scroll-check.mjs`'s own drag test captured the track's bounding box ONCE
  before a sequence of drags, so a stale box produced a reproducible ~3%
  "lag" that looked exactly like the pointer failing to keep up — worth
  ruling out the READOUT FORMATTER and the TEST'S OWN caching before
  suspecting `player.js`'s damping/jump-threshold logic (rule 8), which was
  not the cause here. Fixed in both places: the test now re-measures the
  track before every drag step, and the formatter now switches units
  (percentage alone, past 1e5 m) rather than concatenating two.
- **A general boulder/rubble archetype was a real gap, not a tuning
  problem.** `earth-to-mars`'s final surface beat needed foreground rock and
  reused `panel`'s `bootprint` kind (tilted upright) for it, which rendered as
  two vertical grid-textured slabs — the wrong archetype for the subject,
  since `panel` draws a flat MARKED surface, not a solid lump. `rocks`
  (`src/archetypes/rocks.js`) is the general fix: one low-poly icosahedron,
  instanced, each vertex displaced by a hash of (vertex position, per-instance
  seed) so every instance is a differently irregular lump from one shared
  geometry, with flat per-face shading recovered from screen-space
  derivatives of the displaced view-space position rather than any
  per-instance CPU-side normal recomputation. It now serves Martian
  foreground boulders, Kola-borehole rubble, and `crust-to-core`'s mineral
  inclusions alike.

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

## Deployment

Target is **GitHub Pages at `swapnilskumbhar.github.io/journeys/`** — a project
repo, so the site lives under a PREFIX, not at a domain root.

- `SITE_BASE` and `SITE_ORIGIN` (set in `.github/workflows/deploy.yml`) are the
  only two places the deployed location is written down. A custom domain later
  is `SITE_BASE=/` plus a `public/CNAME`, and nothing else changes.
- **Nothing may hardcode a leading `/`.** `src/routes.js` owns the URL shape;
  links come from `hrefFor()` and route lookups from `slugAt()`. A hardcoded
  root path is the same class of bug as a hardcoded world-space position — it
  works where it was written and breaks where it ships. This cost the router,
  both nav links, the canonical tags and the sitemap on the first pass.
- **Dev stays at the root**, build and `vite preview` carry the prefix. The
  review scripts drive `localhost:5175/<id>` directly and a dev-only prefix
  would break all of them to prove nothing.
- Deep links need no SPA rewrite: the prerender step emits `dist/<id>/index.html`
  per journey, which a static host resolves as an ordinary file. That is the
  payoff for rule 6 that was not obvious when it was written.
- The prerender's head rewriting must not assume attributes are on one line.
  `<meta name="description" …>` is wrapped across three in `index.html`, and a
  literal one-line regex meant the description and og:description were never
  substituted on any page — silently, because a regex that misses returns the
  string unchanged. `setMeta()` warns instead.

Left before this is actually live: Pages has to be switched to "GitHub Actions"
as its source once by hand (Settings → Pages), and `/og/<id>.png` is referenced
by every shell but never generated, so links unfurl without a card.

Still to do: `export-video.mjs` / `make-narration.mjs` are the howitworks
originals and still target `__hiw` + discrete step indices. Retargeting them to
the `__u` scalar should be simpler than the original, not harder.
