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

- **Is a journey done?** — `node scripts/journey-gate.mjs <id> [--quick]
  [--sweep]`. One command, one verdict, and **the only definition of
  "complete"**. Runs build → smoke → `frame-check --look=32 --gate=ship` →
  scroll-check → pages-check, cheapest-first, stopping at the first failure, and
  starts its own dev server if none is answering. `--quick` is the two-minute
  numeric loop (build + smoke + frame-check) for iterating on one beat;
  `--sweep` re-checks every OTHER journey afterwards, which is mandatory when
  anything under `src/archetypes` or `src/engine` changed. A journey is complete
  when this exits 0 and at no other time — see the pipeline lesson below for
  what it cost to learn that.
- **Is a FILM done?** — `node scripts/film-gate.mjs <id>`, and the pipeline that
  produces one is `node scripts/film.mjs <id> [--dry-run] [--rewrite]
  [--from=<stage>]`. One journey in, one narrated, scored, captioned mp4 out:
  preflight → director → voice → timeline → score/sfx → render → assemble →
  gate, cheapest-first, stopping at the first failure. **`--dry-run` makes zero
  paid API calls** — stub narration at a measured speaking rate, silent score,
  6 fps at 320×180 — and still exercises the solver, renderer, mixer and gate,
  so a pipeline change is debuggable for free. `--from=render` after editing
  camera drift, `--from=assemble` after changing captions or the mix. See the
  film section below.
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
  `node scripts/shots.mjs <id> [outDir] [port] [--at=0.1,0.5] [--sheet]
  [--blind]`. Default is one shot per beat, sampled mid-beat; `--sheet` emits
  `contact-sheet.png` (one image = whole-journey review). **`--blind` hides the
  copy panel, ribbon and hero, and names the files `beat-01.png` rather than
  `09-io-s-volcanoes.png`** — the index→heading key goes to a sibling file
  OUTSIDE the frames directory, so the directory can be handed to a reviewer
  with nothing in it that says what the frames are meant to be. Blindness that
  depends on the reviewer choosing not to open a file is not blindness.
- Was it designed, or typed? — `node scripts/design-lint.mjs [id …]`. Checks
  `DESIGN.md` carries a complete **beat sheet** (`# | heading | midpoint |
  archetypes | px | hue`), that its headings still match `beats.js` in order,
  and that the **density budget** holds. It found `earth-to-moon`'s brief had
  silently drifted three beats out of step with its build.
- **What is wrong with it, and what would fix it?** —
  `node scripts/critique.mjs <id> [--beats=3,7-9] [--focus="…"] [--src=a.js,b.js]
  [--via=terra|agent] [--effort=] [--max-usd=] [--diff] [--brief]`. One bounded
  `gpt-5.6-terra` call that sees the rendered frames **and** the source that
  drew them, returning schema'd findings with an `archetypeGap` flag and a fix
  naming the file and the symbol. `--brief` writes a self-contained instruction
  for `journey-builder`. This is the INFORMED review and it is deliberately not
  `review.mjs` — see the pairing below.
- Does the picture show what the copy claims? — `node scripts/review.mjs <id>
  [--film] [--via=terra|agent] [--diff]`. The BLIND review: frames only, no
  captions, no source. **Keep these two apart.** Blindness is what makes
  `review.mjs` trustworthy — you cannot un-see a heading — but "how do I fix
  this" is unanswerable blind, because the fix nearly always lives in a line of
  source no frame can show you. `voyager`'s finding was not "the dish looks
  wrong", it was "`tower` is being used as a magnetometer boom and `capsule` as
  a payload, so the silhouette is a lamp by construction" — visible only by
  reading the frame against `layers.js`. One merged tool that sometimes sees the
  source would silently forfeit the blindness guarantee.
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
| src/archetypes/ | **the reusable visual vocabulary** — particleField, glowSphere, filaments, planet, terrain, blocks, backdrop, silhouette, panel, water, blob, vehicle, trajectory, rocks, strata, tower, cloudDeck, **instrumentedProbe** |
| src/archetypes/instrumented-probe.js | a deep-space probe: parabolic dish with feed and struts, equipment bus, booms in independent directions, `deploy` for launching folded |
| src/kit/camrig.js | `aimCamera(cam, {pos, azimuthDeg, lookAt, pan, rollDeg})` — shared camera-aiming helper; `rollDeg` decides where the travel axis lands on screen |
| src/kit/ | procedural toolkit ported from howitworks (shared by copy) |
| src/journeys/\<id\>/ | meta.js · axis-def.js · beats.js · layers.js · curve.js · index.js · **film.js** (editorial layer, only where a film exists) |
| scripts/ | **journey-gate.mjs** (the verdict) · smoke.mjs · shots.mjs · scroll-check.mjs · **frame-check.mjs** · **design-lint.mjs** · **critique.mjs** (informed) · **review.mjs** (blind) |
| scripts/film/lib/critic.mjs | the INFORMED reviewer — frames + source, prescriptive, schema'd |
| scripts/film/lib/reviewer.mjs | the BLIND reviewer — frames only, descriptive, schema'd |
| scripts/lib/frame-metrics.mjs | the RULER — occupancy/contrast/clip/signature, shared by frame-check and film-gate so a film cannot pass a bar the journey failed |
| scripts/film.mjs · film-gate.mjs · film-shots.mjs | make the film · the film's verdict · sample a master for blind review |
| scripts/film/ | write-script (gpt-5.6-terra, the director) · make-voice · make-score · make-sfx · solve-timeline (the u(t) curve) · render-frames · assemble |
| .claude/agents/ | **journey-builder** (opus, builds against the gate) · **journey-blind-reviewer** (sonnet, Read+Glob only, never sees the brief) · **journey-film** (opus, films against the film gate) |
| .claude/skills/ | **journey-craft** (the craft) · **journey-new** (build a journey) · **journey-film** (film one) · **journey-fix** (repair one that ships and still looks wrong) |

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
- **`voyager`** — **22 beats** (ten were cut: each was a caption over the same
  picture), the real 1977 Grand Tour: separation and boom deployment above a
  receding Earth, four giant-planet encounters bought with gravity assists, the
  Pale Blue Dot, the heliopause, the Golden Record, and an honest closing
  statement about the distance to Proxima Centauri. **The spacecraft is on
  screen in all 22 beats** — a persistent near-foreground escort placed from the
  camera's own basis, standing down only where a beat stages the craft as its
  subject. Gate: occupancy 0.604, contrast 0.186, adjacent 13.1, 0/22 flagged —
  the highest mean occupancy of any journey here.
- **`crust-to-core`** — 27 beats, 68 vh, a straight-down descent from a blade
  of grass to the centre of the Earth: topsoil → the deepest mine and the
  deepest borehole humans have made → the Mohorovičić discontinuity →
  peridotite and diamond-depth kimberlite → the transition zone → the
  core–mantle boundary, the sharpest change in the planet → molten iron and
  the planet's own magnetic dynamo → a solid inner core at the Sun's surface
  temperature, held solid by pressure alone.

Sixteen archetypes (particleField, glowSphere, filaments, planet, terrain,
blocks, backdrop, silhouette, panel, water, blob, vehicle, trajectory,
rocks, strata, **instrumentedProbe**) cover all of it with no bespoke Three.js
in any journey folder.

**Two films ship:** `renders/big-bang/final.mp4` (8m47s) and
`renders/voyager/final.mp4` (5m43s, gate pass, 0/22 shots flagged, blind review
0 high-severity).

## The build pipeline (2026-07-31)

Adding a journey is now one request — the `journey-new` skill runs design brief
→ `journey-builder` agent → gate → blind review → fix rounds, and reports once.
The lessons that shaped it, which are really one lesson four times:

- **A defect no check can see is a defect that ships.** Four journeys were built
  by four agents in a batch. All four built clean, printed `SMOKE PASS`, passed
  `scroll-check`, and were reported complete with "screenshots looked at". One
  was the same white sticker on black in 30 of its 32 beats. Nothing in that
  batch was dishonest; the agents ran everything they had been given and none of
  it could see the picture. `journey-gate.mjs` exists so that "done" is an exit
  code rather than an opinion formed at the end of a long context.
- **Under-building, not bad taste, is what actually went wrong.** Lines of
  `layers.js` per beat predicts journey quality better than any other measure
  taken here: big-bang 56 → 0.522 occupancy, earth-to-moon 36 → 0.451,
  earth-to-mars 20 → 0.372, voyager 13 → 0.032, crust-to-core 12 → 0.066. A beat
  needs three planes; one archetype cannot be three planes, so a thin
  `layers.js` produces the "object floating in void" failure by construction,
  before any compositional decision is made. `design-lint.mjs` fails under 25
  lines/beat.
- **A reviewer who can read the caption is not a reviewer.** You cannot un-see a
  heading: read "Io's volcanoes", look at a black frame with a dot in it, and
  your brain supplies the volcano. `shots.mjs --blind` removes the panel AND the
  filenames AND the axis readout, and the review runs as a separate agent with
  `Read`/`Glob` only, given nothing but a directory of `beat-NN.png`. Restricting
  what the reviewer *can* know is the mechanism; asking it to be objective is
  not.
- **A cold agent per round recreates the original failure once per round.** The
  builder is continued with `SendMessage` across review rounds, never
  re-spawned — a fresh one re-derives the engine from `CLAUDE.md` and
  under-builds exactly the way the first batch did.
- **Three rounds, then stop and ask.** Past three, the problem is almost always
  beat SELECTION, which is a design decision and needs the user — not another
  round of tuning numbers.
- **The per-beat floors were never going to be enough.** `frame-check` gated
  each beat against floors so low that `voyager`, at 0.026 mean occupancy,
  nearly cleared them. `--gate=ship` adds the journey-level bar — occupancy
  ≥ 0.25, contrast ≥ 0.06, adjacent ≥ 6.0, flagged ≤ 15% — calibrated against
  big-bang's 0.522/0.149/13.9/13%. Per-beat floors catch broken frames; only the
  journey bar catches a journey that is uniformly not worth scrolling.
- **`class` is not hoisted the way `function` is.** `journey-gate.mjs` caught a
  `StageFailure` declared below the try/catch that used it, which would have
  turned every gate failure into a ReferenceError — the same trap that already
  cost `frame-check.mjs` a `const mean` used before its initialiser. In a script
  whose whole job is reporting failure honestly, the failure path is the one
  that must not itself be broken.

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

## The film pipeline (2026-08-04)

`node scripts/film.mjs <id>` turns a journey into a narrated, scored,
captioned mp4. The pictures come from the journey itself, rendered frame by
frame — **nothing is generated as video**. This is what rule 8 was for:
`player.js` reads `__u`, `stage.js` reads `__vt`, the camera is handed no clock,
so frame N is a pure function of N and a re-render tomorrow is byte-identical.
`gpt-5.6-terra` is the DIRECTOR, not a video model: it is shown one unoccluded
frame per beat and writes narration to what is actually on screen.

- **`u(t)` replaces the fly-to, and it must never stop.** `howitworks` had
  discrete steps and flew the camera between them; a journey has one continuous
  scalar, so the exporter is simpler. But the naive version — jump to the beat,
  hold — is a frozen frame for ten seconds in a piece whose subject is
  travelling. Each shot is a smoothstep TRANSIT into 15% of the beat's own axis
  span, then a slow linear DWELL drift to 80% of it. Mid-dwell lands near the
  0.45 point `shots.mjs` and `frame-check.mjs` already sample, so the frame the
  still gate blessed is the frame the film shows.
- **A frame can be perfectly composed and completely frozen, and no still check
  in this repo can see it.** `frame-check` scores instants; a shot has a
  duration. Six of `voyager`'s 22 shots — the deep cruises, the heliopause, the
  closing star — measured 0.1–0.4 on the film gate's `motion` metric while
  scoring 0.30–0.76 occupancy. Their pictures are fine and they do not change,
  because the scale law holds the subject at a constant apparent size and there
  is nothing else in frame. The fix is an authored **look drift**
  (`look: { from: { yaw: -12 }, to: { yaw: 12 } }`), which rule 8 explicitly
  permits — `look` is a second INPUT axis, and in deterministic mode it is
  authored rather than dragged. Measured: those six went to 1.1–6.7, and their
  occupancy rose too, because turning reveals more world.
- **Pacing is word count. There is deliberately no seconds knob.** A shot lasts
  exactly as long as its line takes to say, measured from the real ElevenLabs
  alignment. A stretch knob would either insert a silent hole mid-sentence or
  desynchronise everything after it. The one exception is a WORDLESS shot,
  which inserts real silence and cuts the single take into segments around it —
  a seam where silence was wanted anyway costs nothing; a seam between two
  words costs the continuity that made it a single take.
- **Verify an API's shape before building on it; twice here the docs were
  wrong.** The published `gpt-5.6-terra` page rendered an example with an
  `api.anthropic.com` host. ElevenLabs' composition-plan endpoint is
  `/v1/music/plan`, not the documented `/v1/music/composition_plan`, and its
  response is `{positive_global_styles, negative_global_styles, sections[]}`,
  not the documented `chunks[]`. Worst of the three: **a composition plan is
  only accepted by `music_v1`** — posting one with `model_id: music_v2` fails
  422. So v2 sounds better and cannot be sectioned, v1 lets you say where the
  music changes. The plan path is the default, because a score whose sections
  land on the journey's own acts is the entire reason to score a journey rather
  than lay a loop under it.
- **Node's `fetch` gives up at 300 seconds, and that timer starts at the first
  byte UPLOADED.** Two director runs died with a bare `fetch failed` — no
  status, no body, nothing to tell it apart from a network fault. The first
  diagnosis was the obvious one, that a high-effort reasoning call thinks for
  minutes before emitting a token, and the fix for that is real: the Responses
  API's `background: true` plus polling `GET /v1/responses/{id}`, so every
  individual request is short. (Streaming does NOT fix that: undici's body
  timeout applies between chunks and a reasoning model sends nothing until it
  has finished thinking.) But it did not fix the failure, because the failure
  was in the POST, not the wait. `shots.mjs` captures 1440×900 PNGs at ~1.8 MB
  each, and thirty-nine of them is a **35 MB request body** — the upload alone
  outran undici's headers timeout. Frames are now downscaled to 768px JPEG
  before sending: 35.2 MB → 2.86 MB, and nothing is lost, because the vision
  encoder tiles and downsamples anyway (a full-size frame billed 1,630 input
  tokens, the same order as a small one). **A timeout on a request carrying
  images is a payload-size symptom until proven otherwise** — measure the body
  before theorising about the model.
- **A reasoning model's empty answer is well-formed.** Reasoning tokens come out
  of the same budget as the output, so a model that thinks hard and gets cut off
  returns `status: "incomplete"` with a valid response object and no message in
  it. Reading `output[0].content` is doubly wrong: the reasoning item comes
  FIRST, so even a good reply has no content at index 0. Find the item whose
  `type` is `message`, and treat `incomplete` as an error — otherwise a
  truncation surfaces days later as "the director wrote no shots".
- **A generated score arrives MASTERED, so no fixed multiplier can place it.**
  big-bang's came back at -13 dB mean with -1.3 dB peaks — commercial release
  level. The first mix multiplied it by a flat 0.55 and the music sat on the
  narrator's head. Worse, the score had its own arc: -18.8 dB for its first
  thirty seconds, -14 dB from then on, so the bed audibly swelled a minute in
  and never came back. Both tracks are now MEASURED and the gain to reach a
  target is computed per film (music -30 LUFS, voice -16), with `acompressor`
  at 200/1200 ms flattening what remains of the score's internal arc. Fixed
  gain, deliberately not single-pass `loudnorm`, which is dynamic and would
  reintroduce the very moving level being removed. A -4 dB scoop at 1.8 kHz
  keeps the music out of the band speech needs.
- **A score with CHOIR in it makes the narration sound broken, not just loud.**
  big-bang's came back full of "distant choir textures" and "weightless choir"
  — voices under a narrator, competing for the same band. The obvious fix is
  the wrong one: `force_instrumental` works on the prompt path and fails 422 on
  the plan path, **"`force_instrumental` can only be used with `prompt`"**. On
  the plan path the only lever is the plan itself — strip voice terms from the
  global AND local style lists (the planner reaches for choir on any cosmic
  brief, and a global negative does not reach the local styles where it puts
  them), add every voice term to the negatives, and keep `lines: []`.
- **A static limiter after a dynamic normaliser cannot win; use two-pass
  loudnorm.** Three attempts at the final mix, and the first two are the
  instructive ones. Single-pass `loudnorm` hits -14 LUFS but its true-peak
  ceiling is advisory — asked for -1.5, delivered -0.3. Adding `alimiter` after
  it enforced the ceiling and then fought the normaliser that had just run,
  pulling 3.7 dB back off and landing the mix at -17.7 LUFS. (Two smaller traps
  live in that attempt too: `alimiter` limits SAMPLE peaks while the gate
  measures TRUE peak, and inter-sample overshoot was ~1.2 dB here; and
  `level=disabled` is required or alimiter helpfully re-normalises and undoes
  the loudness match.) The tool built for this is loudnorm's two-pass mode:
  pass one measures, pass two applies a single LINEAR gain with the measured
  values supplied, hitting the integrated target exactly and respecting true
  peak with no dynamics applied to the finished mix at all. Guard the handoff —
  loudnorm reports `-inf` for silence, and feeding that into pass two produces
  no audio, which a dry run will hit every time.
- **Measuring the duck on the final mix reports a working duck as broken.**
  During speech the voice dominates, so the mix gets LOUDER exactly where the
  music got quieter. The ducked score is rendered separately, for no other
  purpose than letting the gate measure its level inside speech windows versus
  between them.
- **CSS animation and transition run on the real clock, not the virtual one.**
  Any left enabled makes a frame depend on how long the page has been open,
  which is precisely the defect rule 8 exists against. The renderer disables all
  of it unconditionally — which also removes the copy panel's entrance stutter
  that made `--chrome=full` unusable.
- **`class` and `let` are still not hoisted, and this cost a third script.**
  `film.mjs`'s `let skipNote` sat in the plumbing section below the try/catch
  that read it, so the first stage threw "Cannot access before initialization"
  instead of running. Same trap as `frame-check.mjs`'s `const mean` and
  `journey-gate.mjs`'s `class StageFailure`. In anything whose job is reporting
  failure honestly, the failure path is the one that must not itself be broken —
  and `film-gate.mjs`'s missing-artefact exit calls `finish()` before the
  picture stage has run, so everything `finish()` reads is declared above it.
- **Units are facts, money is an estimate, and the two must not be blurred.**
  `scripts/film/lib/ledger.mjs` records every paid call and writes
  `renders/<id>/cost.json`. Token counts, characters, seconds and call counts
  come from the actual requests and responses, so they are exact; dollars are
  those units times a rate table, and each rate is marked verified or assumed
  with anything derived from an assumed rate flagged `*` in the output. The
  honest reason it works this way: **the balance cannot be read.** ElevenLabs
  exposes the exact credit count at `/v1/user/subscription`, but this repo's
  key is scoped without `user_read` and gets a 401 — grant that scope and the
  ElevenLabs figures become ground truth instead of arithmetic. The ledger
  prints on FAILURE as well as success, because a run that dies at the render
  stage has still paid for its director and its voice. `--max-usd` stops the
  run before the next paid stage rather than after it. **Record a line AFTER
  the call succeeds, not before it** — the music entry was written up front and
  a compose that failed 422 still showed $2 of music in the ledger, a bill for
  something never delivered. The exception is the TTS character count, which is
  billed on submission whether or not the response arrives.
- **A whole film is about six billed calls.** One director call (plus unbilled
  status polls), one TTS call for the entire narration, two for the score
  (plan, then compose), and one per distinct sound effect — sfx are cached by
  name, so a re-run pays nothing for cues that did not change. The render is
  free; it is local GPU time. That shape is why the pipeline is cheap to
  iterate on and why `--from=<stage>` matters: re-rendering costs minutes and
  nothing else.
- **One filter input, used twice, needs `asplit`.** ffmpeg's parser accepts
  `[1:a]` on two chains without complaint and then produces silence on every
  branch after the first.

## The protagonist, and the departure (2026-08-05, `voyager` rework)

A journey named after a spacecraft shipped with a spacecraft in **5 of its 22
beats**, and the one beat that drew it large drew a table lamp. Everything below
came out of fixing that, and most of it generalises.

- **The gate cannot see whether a thing looks like the thing.** `frame-check`
  measures occupancy, contrast and adjacent distance: it tells you a frame is
  not empty, not black and not a copy of its neighbour. `voyager`'s craft scored
  0.42 occupancy and passed every numeric bar in the repo while rendering as a
  white bowl, a gold ball and a spike. That gap is why `critique.mjs` exists —
  a model with eyes finds it, an agent with tools fixes it, the gate proves
  nothing else broke.
- **`vehicle` is an axial launch-stack generator, and a deep-space probe is not
  a stack.** Every primary mass in `vehicle` builds bottom-to-top on local y and
  its dish is a bare sphere cap on that same axis. `layers.js` had pressed
  `capsule` into service as a payload and `tower` as a magnetometer boom — and
  that substitution IS the lamp: white bowl, gold ball, tapered base, one spike.
  No parameter could have fixed it, because the defect was the axis.
  `instrumentedProbe` is the general answer and serves Galileo, Cassini,
  Pioneer and New Horizons too. **The tell, before you spend a round tuning:
  cover the caption and ask a stranger to name the object.** "Some vertical
  bars" or "a table lamp" is an archetype gap.
- **What makes a dish read as an antenna is the STRUTS.** A paraboloid
  (`LatheGeometry` from `z = depth·(r/R)²`, not a sphere cap) with a thick rim,
  a feed horn standing off the vertex on a real focal length, and a tripod
  holding it there. The struts break the silhouette into something nameable.
  And asymmetry is the whole difference between a probe and a lamp: booms
  leaving the bus in three different directions, one of them very long and very
  thin.
- **A probe launches FOLDED.** Booms stow against the bus inside the shroud and
  extend after separation. Building them straight into the shared group welds
  the craft permanently open and the beat where it unfolds cannot exist —
  `instrumentedProbe`'s `deploy` needs each boom in its own group pivoted at its
  root, which is a structural decision, not a parameter.
- **THE PROTAGONIST HAS TO BE ON SCREEN.** Five of 22 beats is a slideshow of
  planets that happen to be in the right order. Every appearance was its own
  windowed layer, so the craft blinked in and out and the gaps between windows
  were most of the journey — and the five appearances were at five different
  sizes in four different corners, so even where it WAS present there was
  nothing to track. One continuous presence, same corner, same size, fixes both.
- **A fixed WORLD offset does not hold a fixed SCREEN position.** `azimuthAt`
  swings this camera 44° across the journey, so an authored offset slides right
  out of frame. `screenAnchoredMeters` in `plan.js` rebuilds the exact basis
  `aimCamera` constructs from the same four tables `index.js` feeds it, and
  returns a world position for a camera-space `{right, up, ahead}`. One formula,
  not two that have to agree. It also fixed the booster, which had been cropped
  at the frame edge for as long as the journey existed.
- **A persistent near-foreground object must not read as a sticker.** Three
  things keep it a real object: a true distance in front of the lens so it
  parallaxes against what it passes, the same light vector as every world in the
  journey, and an attitude that is a slow function of `u`. All pure functions of
  `u` — rule 8 intact, and it measurably RAISES occupancy because a turning
  object reveals more.
- **A mute is a promise that something better is taking over.** The escort stood
  down for seven "hero" shots — but two of them drew the craft at 0.045 and
  0.075 of the frame, 25 and 40 px, while suppressing a 140 px escort. Trading a
  legible spacecraft for an invisible one. Both layers deleted.
- **A layer's MOUNT RANGE silently overrides every opacity envelope you write.**
  `L('earth', 1.0, 1.02, …)` — 1.02 AU is three million kilometres — hard
  unmounted the planet the reader was leaving, and no fade could have saved it.
  When a layer vanishes and its opacity looks right, check the range first.
- **Gating visibility on FRAME WIDTH breaks wherever the frame law moves
  sharply.** Earth gated on `frames(rebase, 2.0e6, 9.0e8)` while the FRAME table
  ran 5.2e12 → 1.5e7 → 1.0e11, so the gate could only ever be open in a thin
  slice in the middle. Measured: Earth absent at 4,655 km, absent at 6,410 km,
  suddenly huge at 8,758 km, gone by 1.18 AU. A journey whose second beat is
  called "Leaving Earth" never showed Earth getting smaller.
- **Hold the frame across a beat — EXCEPT when the subject is not at the
  origin.** Everywhere else in this table a flat pair of anchors is correct.
  For a body receding behind you, a held frame plus a receding planet is the one
  case where holding does the job, and the departure needed the frame to WIDEN
  faster than the ship recedes so Earth shrinks every frame.
- **Check whether an axis quantity is an altitude or a centre distance.**
  `fromEarth(m) = (AU + m)/AU` and the ribbon prints `m` as "km from Earth" — an
  altitude — while the Earth layer placed the planet's CENTRE at `m`. They
  disagree by one planetary radius, and since beat 1 held to 6,000 km inside a
  6,371 km planet, **the journey opened with the camera underground.** A sphere
  with front-face culling seen from inside draws nothing, which is exactly what
  the first three departure samples showed.
- **Two objects that have just come apart are ONE event.** Staging them as two
  independent placements is what made the departure read as two stickers: the
  spent stage at one fixed screen spot, the spacecraft at another, neither
  moving relative to the other, so nothing said they had ever been attached.
  `separationFormation` returns both from one derivation — one centroid, one
  tangent, one gap that **starts at zero** and grows. Coincident at the start is
  what "still attached" means.
- **Discarded hardware tumbles.** A spent stage holding a rigid attitude reads
  as a second working spacecraft flying in formation.
- **A trajectory line and the craft on it must come from one formula.** The path
  was drawn in world space from its own shape while the craft was placed by
  screen anchoring — two derivations with no reason to meet, and they did not.
  `voyagerPositionMeters` is now the single answer to "where is Voyager", and
  `departure-path` is translated so its own progress point lands there.
  `trajectory` builds geometry once and only translates it, so the path cannot
  be re-shaped per frame — but it can be moved, and moving it is enough.
  **Residual, named honestly:** once the craft is off the origin for
  visibility, the Earth→craft direction and the escape tangent are no longer
  the same vector, so the line's tail does not pass exactly through Earth. That
  is the price of a screen-anchored protagonist, not a bug to tune away.
- **A declared parameter is not an implemented one.** `vehicle` declares `fins`
  and never reads it — no fin-building code exists — and this file previously
  documented fins as a fix that had been applied. The booster carried a
  `fins: {…}` config that drew nothing for as long as the journey existed.
- **Key an event's envelope to the EVENT, not to a round number on the axis.**
  The booster's plume throttle held full until `1.00009 AU`, which is 13,500 km,
  so the beat showed an engine firing four hundred kilometres of altitude after
  the propellant was gone. Write the conversions in the source: `400 km =
  1.0000027 AU` is unreadable otherwise, and unreadable numbers do not get
  checked.
- **Over-correction is its own defect.** Having found a deployed spacecraft
  flying beside its own burning booster, the first fix suppressed the craft
  through the entire ascent — equally wrong, because by 14,000 km it had
  separated and its booms were going out. The honest boundary was BURNOUT, not
  altitude.
- **The Browser pane cannot drive this app.** rAF is throttled there, so the
  streamer never mounts a layer and a scene traverse returns nothing — two
  separate debugging attempts died on it. Use `shots.mjs` and read the PNGs.
- **`command | tail` reports tail's exit code.** A gate piped for readability
  will look like it passed. Read the verdict in the text.

## Terra as the second model (2026-08-05)

`gpt-5.6-terra` now does three jobs here, and the pattern is the same each time:
**one bounded call with a strict schema, in place of an unbounded agent
transcript.** Every AI step offers `--via=terra|agent`.

- **Bounded beats cheap.** A subagent review is images entering a context,
  reasoning across many turns, the whole context re-sent each turn, and a bill
  you cannot know in advance. Measured: a schema'd critique of 5 frames and 2
  source files at high effort is $0.137 and returns a complete new archetype
  API.
- **Blindness becomes ENFORCED rather than requested.** With a subagent you are
  trusting it not to open the key file sitting beside the frames. An API call
  simply does not contain one. This repo's rule is that restricting what the
  reviewer CAN know is the mechanism and asking it to be objective is not — an
  API call is the stronger form of that rule.
- **Findings become diffable.** After a fix round, "gone" and "not mentioned
  this time" are indistinguishable in prose and completely different facts.
  `--diff` answers it against a stable schema. Watch `introduced` too: a rework
  that trades one high finding for two mediums has not helped.
- **Keep the agent path.** An agent can follow up on its own suspicion and
  fact-check against the web; a single call cannot. `--via=agent` prints the
  brief and spends nothing — worth it for a second opinion from a different
  model on something about to ship.
- **Creation stays agent-backed, and that asymmetry is real.** Review and
  direction are bounded single calls. Building a journey is an
  edit → gate → read-failure → edit loop, and one API call cannot run one.
- **Frames dominate every bill** at ~1,700 tokens each. `--beats=` is the
  biggest lever in the repo: critiquing the four beats you are unhappy with
  costs an eighth of critiquing thirty-two and answers the same question. Check
  the estimate BEFORE sending — `--max-usd` refuses, rather than reporting an
  overspend afterwards.
- **Downscale to 768px, always.** The film reviewer was sending full-size
  frames; 86 of them is a 35 MB body that died with `UND_ERR_HEADERS_TIMEOUT` —
  the same payload lesson `write-script.mjs` already carried. Downscaled:
  6.3 MB, 177k → 36k input tokens, $0.496 → $0.153, identical findings quality.
- **A model can be more specific than you expect, and still wrong about
  architecture.** The critic correctly diagnosed the lamp and specified the
  replacement API in detail — then proposed a new *archetype* for the
  separation formation. Archetypes DRAW things; a formation draws nothing. It
  belongs in the journey's `plan.js` beside the other shared derivations.

## Film pipeline, second pass (2026-08-05)

- **Measure a gain AFTER the processing it is supposed to survive.** The voice
  chain was `volume(to reach -16 LUFS), compress` — so the gain was correct up
  to the compressor, which then removed an unknown amount. One quiet narration
  (-31.95 LUFS against a typical -30) was driven 2 dB harder, the mix landed at
  -20 instead of -15.7, and loudnorm then needed +6 dB against 2.1 dB of peak
  headroom, abandoned linear mode and went dynamic. **The gate failed on the
  normaliser and the normaliser was not the cause.** Drive the compressor at a
  fixed level, measure what comes out, trim to target, and put the true-peak
  ceiling BEFORE the normaliser — a limiter after it fights it, which this file
  already documented as a dead end.
- **A hand-edited narration line is silently ignored on `--from=render`.**
  Whether a shot is wordless is decided by the absence of a timing entry — i.e.
  by what the VOICE actually said — so editing `film.js` and resuming from the
  render keeps the old take. A full nine-minute render produced a byte-identical
  timeline. It now throws and names `--from=voice`. The preflight was already
  printing the true answer (`4m47s / 2 audio segments` against the pipeline's
  `5m52s`) with nothing comparing them.
- **A stale frames directory reviews the wrong film.** Capture was gated on
  `!existsSync(dir)`, so a review came back clean about a cut nobody had made.
  Frames must be newer than the master. Cost $0.50 to learn.
- **A wordless shot on the wrong beat costs more than the silence.** The
  director made the Golden Record silent — the most affecting object in the
  journey, passing in five seconds of nothing — and the NEXT line opened
  "Beyond it, the record rides on…", referring to a record the film had never
  introduced. Check that every pronoun and definite article has an antecedent
  the audience has actually heard. Wordless shots belong on a picture that needs
  no words, not on the one carrying the most meaning.
- **`cost.json` is written per invocation and OVERWRITTEN.** A run resumed with
  `--from=` leaves a ledger showing only the last stage, so the on-disk record
  cannot answer "what did this film cost end to end". Accumulate across resumes.
- **The escort changed which shots freeze.** Six shots previously measured
  0.1–0.4 on `motion`; a near-foreground object turning slowly with `u` adds
  parallax that was not there when those drift values were tuned. Re-measure
  after any change to a persistent layer rather than copying the old numbers —
  this pass needed authored drift on exactly one shot.

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

Video export is **done** — see the film pipeline above. `export-video.mjs` and
`make-narration.mjs` remain in `scripts/` as the howitworks originals targeting
`__hiw` + discrete step indices; they are superseded by `scripts/film.mjs` for
this project and only worth keeping until the good parts they still hold (the
ASS caption builder, the `gradfun` encode settings) are confirmed fully carried
over. `make-thumbnails.mjs` and `make-postkit.mjs` are still un-retargeted.
