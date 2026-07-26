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
| src/kit/ | procedural toolkit ported from howitworks (shared by copy) |
| src/journeys/\<id\>/ | meta.js (eager card) · index.js (the journey) · layers |
| scripts/ | video export / narration / review tooling (ported, **needs retargeting**) |

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

## Status (2026-07-26)

Scaffold only — engine primitives written, **nothing rendered yet**. `axis`,
`rebase`, `stream`, `stage`, `journey`, `player`, `ribbon` compile and the build
is clean, but no journey exists, so none of it has been exercised against real
content. Expect the first journey (Big Bang) to reshape the player and prove or
break the layer contract. Ported `scripts/` still target howitworks' step model
(`__hiw`, discrete step indices) and will not run here until retargeted to the
`__u` scalar — which should be simpler, not harder.
