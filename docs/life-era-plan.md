# Plan: rebuild the life era (beats 20–30)

> **DONE** — shipped 2026-07-28 across three commits (pacing gate + axis retune;
> water/blob archetypes + seafloor fixes; the beats themselves). Kept as the
> record of what was wrong and why the fixes are shaped the way they are.
> Deviations from this plan, and the four defects found by looking at the
> contact sheet rather than by following it, are listed in §9 at the end.

Agreed direction: **procedural silhouettes** — backlit forms against a lit
backdrop, no external 3D assets. Prototype for beats 26–27 (Ediacaran and
Cambrian seafloor) is built and working; it is the reference for the rest.

This document is the build spec. It exists on disk so it survives context
compaction — build from this file, not from conversation memory.

---

## 1. The defects

### D1 · Beats get almost no scroll (the "blink and it's over" problem)

Measured at `length: 62`:

| Beat | u-span | Scroll |
| --- | --- | --- |
| 20 A star is born | 0.6273→0.6338 | **0.40 vh** |
| 21 The Moon | 0.6338→0.6461 | 0.76 vh |
| 23 Life | 0.6935→0.7079 | 0.89 vh |
| 24 Oxygen catastrophe | 0.7079→0.7174 | 0.59 vh |
| 26 Bodies | 0.7539→0.7575 | **0.22 vh** |
| 27 Cambrian | 0.7575→0.7621 | **0.29 vh** |
| 28 Life leaves the water | 0.7621→0.7828 | 1.28 vh |
| 30 Ten kilometres of rock | 0.8273→0.8488 | 1.33 vh |

The entire formation of the solar system — including a six-decade zoom from a
200 AU disc down to Earth — happens in 360 pixels of scroll. The seafloor scene
built for the Cambrian gets 0.29 vh, so it is invisible in practice.

**Root cause:** segment weights were tuned when the life era was nine static
globes that needed no time. They are unchanged now that those beats carry
scenes.

### D2 · The Moon beat shows an aftermath, not an event

Copy: *"A Mars-sized body strikes the young Earth a glancing blow… the debris
thrown into orbit coalesces."* Screen: a molten Earth with a small unlit grey
disc beside it. No impactor, no impact, no debris, and the Moon is barely
visible because it is dark-side-on and only ~40 px across.

### D3 · Beats 28–30 are back on the orbital globe

*Life leaves the water*, *The Great Dying* and *Ten kilometres of rock* all
render as the same distant sphere. Beat 28 in particular must start **in the
water** and come **out onto land** — that is literally what the beat is about.

### D4 · Found while measuring, not reported

Same class as D1 and it would have shipped: the seafloor prototype's own beats
are the two tightest in the journey.

---

## 2. Fix A — rebalance the axis, and make it enforceable

Two parts, and the second matters more than the first.

**Extend `scripts/smoke.mjs`** to print, and gate on, per-beat scroll in
viewport-heights (it currently only checks gaps as a fraction of the axis, which
hides this entirely):

- print a table of every beat's scroll in vh
- FAIL if any beat from 19 onward gets under **1.5 vh**
- FAIL if any beat anywhere gets under 0.4 vh
- keep the existing collision and dead-stretch checks

This converts "it feels too fast" into an automated gate, so it cannot recur.

**Then retune segments** in `axis-def.js` until the gate passes. Starting point
(weights are relative and normalise, so only ratios matter):

| Range | Space | Weight | Serves |
| --- | --- | --- | --- |
| ago(5e9) → ago(4.60e9) | linear | 0.07 | 19 Our galaxy, the dive |
| ago(4.60e9) → ago(4.53e9) | linear | 0.05 | 20 A star is born |
| ago(4.53e9) → ago(4.46e9) | linear | 0.06 | 21 The Moon (impact sequence) |
| ago(4.46e9) → ago(4.0e9) | linear | 0.05 | 22 Oceans |
| ago(4.0e9) → ago(2.0e9) | lookback | 0.06 | 23 Life, 24 Oxygen |
| ago(2.0e9) → ago(640e6) | lookback | 0.05 | 25 Cells within cells |
| ago(640e6) → ago(440e6) | lookback | 0.13 | 26 Bodies, 27 Cambrian, 28 Land |
| ago(440e6) → ago(66e6) | lookback | 0.06 | 29 The Great Dying |
| ago(66e6) → ago(1) | lookback | 0.19 | 30–39, unchanged |

Cosmology segments 1–5 keep their current weights (0.13, 0.11, 0.15, 0.13,
0.09). In absolute terms cosmology loses about 4 vh out of 40 — imperceptible —
while the life era roughly doubles.

**Raise `length` 62 → ~78 vh.** Tune by re-running the gate, not by eye.

---

## 3. Fix B — the Moon as an event

Stage it in three phases across the beat's own `local` progress, at a ~4×10⁷ m
frame. This is the template for every "event" beat: the layer envelopes carry
the sequence, not a cut.

- **local 0 → 0.35 — approach.** Theia as a second molten body (`planet`,
  magma 1, ~0.55 Earth radius) closing on a collision course via
  `offsetMeters`, both in frame.
- **0.35 → 0.5 — the strike.** A white flash (`glowSphere`, brief and bright),
  Theia's opacity dropping to zero, Earth's `magma` driven to 1.
- **0.5 → 1.0 — coalescence.** A debris ring (`particleField` disk, seeded hot
  orange) whose radius contracts and whose opacity falls as the Moon
  (`planet`, grey) fades up at the ring's radius, clearly lit with the same
  light direction as Earth so the two read as one system.

Moon must end at ≥120 px across in a 1440-wide frame, and lit — not a dark
disc. Verify by screenshot at three points inside the beat, not just mid-beat.

---

## 4. Fix C — ground level from beat 28 onward

Beat 28 is the hinge: it starts underwater and ends on land.

- **local 0 → 0.3** — shallow water, seafloor visible, camera at ~1 m above the
  bottom looking toward a bright surface (reuse the Cambrian `backdrop` +
  `sea-floor`, with the water shallower).
- **0.3 → 0.55** — the waterline crosses the frame; sky replaces water in the
  upper half. Camera rises above the surface.
- **0.55 → 1.0** — a shore, then low plants, then a Devonian forest of
  `silhouette` `tree` receding into haze.

Frame runs ~15 m → ~120 m. After this beat the journey **never returns to
orbit** until the final pull-back at "Today".

---

## 5. Per-beat spec

Frames are the target frame width in metres. Every beat must hold its frame
across its own span and move in the gap *after* it — the recurring bug is a
beat spending its scroll travelling away from its subject.

| # | Beat | Frame | Scene |
| --- | --- | --- | --- |
| 20 | A star is born | 1e16 → 3e13 | Dark molecular cloud contracting; a knot brightening at its centre; the disc forming out of it |
| 21 | The Moon | 4e7 | Impact sequence — see §3 |
| 22 | Oceans | 1.7e7 → 200 | Descend to a young sea; hot red sky, heavy rain, steam off the water |
| 23 | Life | 3 | Stromatolite domes in shallow water, backlit (`silhouette` `dome`, already written) |
| 24 | Oxygen catastrophe | 8 → 1.7e7 | Bubble columns rising off the mats; then pull out as the sky shifts from orange haze to blue |
| 25 | Cells within cells | 2e-5 | Two translucent membranes, one engulfing the other. A twelve-decade jump from the previous beat — the showcase for the whole engine |
| 26 | Bodies | 6 | **Built** — Ediacaran fronds on the seafloor |
| 27 | Cambrian | 6 | **Built** — animals arriving over the same fronds |
| 28 | Life leaves the water | 15 → 120 | The hinge — see §4 |
| 29 | The Great Dying | 2e4 | Siberian traps: glowing fissures across a dark plain, ash sky, dead-snag silhouettes |
| 30 | Ten kilometres of rock | ground → 1e6 | Incoming streak from ground level; impact flash and shockwave from altitude; then dust and a dark sky |

Beats 31–39 (savanna → industrial city → orbit) are already good. Do not touch.

---

## 6. New archetypes

Built and working: `backdrop`, `silhouette`, `terrain`, `blocks`, plus the
original four.

| Archetype | For | Notes |
| --- | --- | --- |
| `water` | 22, 24, 28 | Horizontal plane, procedural wave normals, seen from above AND below. Needed for the waterline crossing in beat 28. |
| `blob` | 25 | Translucent membrane-bounded body with a bright rim; wobbles. Cells, bubbles, vesicles. |
| `particleField` — `blending` option | 20, 29, 30 | Currently additive only. Dark absorbing particles are needed for molecular cloud, ash and dust; add `blending: 'additive' \| 'normal'`. |
| `terrain` — `lava` drive | 29 | Emissive fissures on the ground. Port the `crack` logic already working in `planet.js`. |

New `silhouette` kinds needed: none — `frond`, `segmented`, `tree`, `dome`,
`figure`, `reed` cover the plan. `dome` and `tree` are written but unused so far.

---

## 7. Order of work

1. smoke.mjs vh gate + axis retune + `length` — **do this first**, alone, and
   confirm the gate passes. Everything else is wasted if beats stay at 0.3 vh.
2. Fix the two known prototype flaws: featureless seabed, blown backdrop glare.
3. Beat 21 (Moon impact) — highest-value single beat, and it proves the
   event-sequencing pattern the later beats reuse.
4. Beat 28 (the waterline) — needs `water`; proves the hinge.
5. Beats 22, 23, 24 — ocean surface and shallows, reusing `water`.
6. Beat 25 — needs `blob`.
7. Beats 29, 30 — need the `blending` option and terrain `lava`.
8. Beat 20 — molecular cloud, once `blending` exists.

## 8. Verification

- `scripts/smoke.mjs` prints SMOKE PASS **including the new vh gate**
- `scripts/shots.mjs big-bang --sheet` — look at every frame, not just the
  changed ones
- Event beats (21, 28, 30) additionally shot at `--at=` three points inside
  their span, because mid-beat sampling alone hides sequencing bugs
- `scripts/scroll-check.mjs` after any player/ribbon/length change
- Build must pass before anything is called done

---

## 9. What actually happened

**Pacing.** The vh gate is beats 19–30 at 1.5 vh, plus a 0.15 vh floor
everywhere else — not the 0.4 vh global floor this plan asked for. The wheel and
writing are honestly 1,300 years apart, which on a log-lookback axis is 0.2% of
the journey no matter how it is weighted; a 0.4 vh floor could only be met by
lying about one of the dates. Result: scene beats went 20.3 → 30.9 vh, cosmology
kept its absolute scroll (beat 5 was 0.39 vh and is 0.38), and all 15.6 extra vh
of page length went to the life era.

**The Moon.** 120 px was not achievable honestly. Earth and the Moon at four
Earth radii do not both fit a frame that leaves the Moon that large; it ends at
~85 px, at 3.45 Earth radii — the low end of the range the giant-impact models
give. The copy is explicitly about how close it was, so the distance won.

**Four defects this plan did not predict**, all found in the contact sheet:

1. *"Our galaxy" was a black frame.* The disc is fixed at its real 9.5e20 m and
   dropped off the rebase band before the beat's own midpoint. Three other
   layer hand-offs had the same shape. Mid-beat is where a beat gets reviewed —
   a layer has to cover its beat end to end.
2. *`silhouette`'s `dome` drew inverted arcs* (PI→2PI in a y-flipped canvas is
   the bottom half of the ellipse), so every stromatolite was a flat slab.
3. *The seabed had no relief at all* — `terrain`'s flatten radius defaults to
   600 m, larger than the whole 60 m seafloor, so the lift term was zero
   everywhere. Its colour wavelengths were hardcoded savanna numbers too.
4. *The K–Pg pull-back overshot the ground disc*, turning the world into a
   saucer floating in frame.

**Extra archetype work** beyond §6: `particleField` `innerRadius` (a filled disc
reads as a spray, a ring reads as something in orbit), `terrain` `lightColor` +
colour drives (one surface crossing a lighting change), `backdrop` `sunGain` (a
broad source has to be dim), `silhouette` `nearFadeMeters`, and a distance
normal-flatten in `water` to kill grazing-angle moiré.
