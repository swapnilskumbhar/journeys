# crust-to-core — design brief

**Written retroactively.** This journey was built before this brief was —
Phase 1 was skipped and code was written directly, which is itself the first
lesson this document has to record honestly rather than paper over. What
follows describes the journey AS BUILT, including two defects that only
turned up in screenshot review and one that only turned up in a later
cleanup pass, not an idealised version of it.

A straight-down descent from a blade of grass to the centre of the Earth:
soil → the deepest mine and the deepest borehole humans have made →
sedimentary strata → the Mohorovičić discontinuity → peridotite and
diamond-depth kimberlite → the transition zone → the lower mantle → the
core–mantle boundary, the sharpest change in the planet → the liquid outer
core and the magnetic dynamo it drives → a solid inner core at the Sun's
surface temperature, held solid by pressure alone.

---

## 1. The axis

**Quantity: depth below the surface, in metres.** 0.3 m (topsoil — a log axis
cannot reach zero, and a third of a metre is real topsoil depth, not an
arbitrary near-zero the way a spacecraft's "1 m off the pad" is arbitrary
elsewhere in this project) to 6.371e6 m, Earth's mean radius — the centre.
Monotonic by construction: this journey has no vehicle, no reversal, nothing
to arrive at except depth itself.

### Why depth, not time or a mineral-composition axis

Two other quantities were considered and rejected. **Geological age** would
have been dishonest: rock at a given depth is not uniformly older than rock
above it (a lava flow can sit on million-year-old sediment), so an age axis
would have to lie about ordering. **Pressure** is monotonic and real, but it
is not the quantity a reader has any intuition for — nobody has a felt sense
of "3 million atmospheres," while "12 kilometres" (roughly the Kola borehole)
and "6,371 kilometres" (the whole radius) are numbers a reader can hold
against each other. Depth is also the one quantity that is unambiguously,
uncontroversially monotonic for a straight-down descent, which is the whole
reason this project prefers a real physical quantity as the axis in the first
place.

### The floor

Same reasoning as every other journey's floor: log space cannot represent
zero, so the axis starts at a small positive real value rather than at 0.
`D0 = 0.3` m is inside real topsoil (topsoil is conventionally 0–30 cm), so
"floor" and "first beat" coincide honestly instead of the floor being an
arbitrary technical necessity sitting below the first real subject.

### Segment table

One segment per beat (27 beats), boundary at each beat's own depth. `space`
is `log` almost everywhere — this axis spans **7.3 decades**, more than any
journey here except `big-bang` — and `linear` only inside the three
STRUCTURAL EVENTS (the Moho, the core–mantle boundary, the inner-core
boundary), each staged as **approach → crossing → aftermath**, the same
three-phase pattern `big-bang`'s K–Pg impact and Moon-forming collision use.

`length = 68` vh. Σweight = 28.35.

| # | beat | depth (m) | space | weight | vh |
| --- | --- | --- | --- | --- | --- |
| 1 | Grass and topsoil | 0.3 | log | 1.10 | 2.64 |
| 2 | The root zone and the soil horizons | 1.5 | log | 0.95 | 2.28 |
| 3 | The water table | 8 | log | 0.95 | 2.28 |
| 4 | The first solid bedrock | 30 | log | 0.95 | 2.28 |
| 5 | Weathered rock, joints and fractures | 120 | log | 0.90 | 2.16 |
| 6 | Mponeng: the deepest mine | 4.0e3 | log | 1.20 | 2.88 |
| 7 | Approaching the deepest hole ever drilled | 9.0e3 | log | 0.90 | 2.16 |
| 8 | The Kola Superdeep Borehole | 1.2262e4 | log | 1.25 | 3.00 |
| 9 | Sedimentary strata, time made visible | 2.0e4 | log | 1.00 | 2.40 |
| 10 | Deep crustal rock, metamorphosed | 3.0e4 | log | 0.95 | 2.28 |
| 11 | Approaching the base of the crust | 3.3e4 | linear | 0.90 | 2.16 |
| 12 | The Mohorovičić discontinuity | 3.5e4 | linear | 1.25 | 3.00 |
| 13 | Into the mantle | 3.7e4 | log | 1.00 | 2.40 |
| 14 | Upper mantle, peridotite | 8.0e4 | log | 0.95 | 2.28 |
| 15 | The asthenosphere | 1.5e5 | log | 1.05 | 2.52 |
| 16 | Where diamonds form | 1.9e5 | log | 1.10 | 2.64 |
| 17 | The transition zone | 5.0e5 | log | 1.05 | 2.52 |
| 18 | The lower mantle | 1.2e6 | log | 0.95 | 2.28 |
| 19 | The D″ layer | 2.85e6 | log | 1.00 | 2.40 |
| 20 | Approaching the core–mantle boundary | 2.87e6 | linear | 0.90 | 2.16 |
| 21 | The core–mantle boundary | D_CMB=2.891e6 | linear | 1.30 | 3.12 |
| 22 | Into the outer core | 2.92e6 | log | 1.05 | 2.52 |
| 23 | The liquid outer core, and the magnetic field | 4.0e6 | log | 1.10 | 2.64 |
| 24 | Approaching the inner-core boundary | 5.10e6 | linear | 0.90 | 2.16 |
| 25 | The inner-core boundary | D_ICB=5.150e6 | linear | 1.30 | 3.12 |
| 26 | The solid inner core | 5.8e6 | log | 1.10 | 2.64 |
| 27 | The centre of the Earth | R_EARTH−200 | linear | 1.30 | 3.12 |

Tightest beat 2.16 vh (5, 11, 20, 24 — the four "approaching X" beats, each
deliberately the plainest transit between two more eventful stops); widest
3.12 vh (21, 25, 27 — the two structural crossings plus the closing beat,
each given the most room because each is the point of the journey, not a
stretch of it to get through).

### Why the three events get their own tight linear window

An instantaneous (geologically) event inside what would otherwise be one long
log segment lands in the first sliver of it — exactly the K–Pg lesson this
project's own `CLAUDE.md` already records. The Moho, the CMB and the ICB are
each split into approach (still in the material above), crossing (a narrow
linear window a few times the transition's own real sharpness), and
aftermath (the new material, held). This is the same device `voyager`'s
encounter/departure fix and `big-bang`'s impact beat both use, applied to a
structural discontinuity instead of an impact.

### Readout

`formatDepth` (in `depth.js`): centimetres near the surface, then metres,
then kilometres, then — past 1e5 m — **percentage of the way to the centre,
alone**, not concatenated with a kilometre figure. That last part was NOT the
original design: the first version read `"2,895 km down · 45.4% to
centre"`, switching units by concatenation rather than by replacement like
every other branch here. It was changed after `scroll-check.mjs`'s drag test
turned up a real defect it caused — see §7, "known defects."

---

## 2. The beats

27 beats. Heading, real depth and what the beat's MIDPOINT (45% into its own
u-range, where `shots.mjs` samples and where the reader who scrolls at a
constant rate is actually most likely to be reviewing it) shows on screen.

| # | heading | depth | on screen at the MIDPOINT |
| --- | --- | --- | --- |
| 1 | Grass and topsoil | 0.3 m | A pale sky glimpsed through grass blades (`backdrop` + `silhouette`), dark organic topsoil below |
| 2 | The root zone and the soil horizons | 1.5 m | The strata wall alone — dark, cooler-toned soil, no more sky |
| 3 | The water table | 8 m | Darker, cooler soil tones (saturated ground) |
| 4 | The first solid bedrock | 30 m | Grey unbroken rock, foreground boulders (`rocks`) |
| 5 | Weathered rock, joints and fractures | 120 m | Same grey rock, foreground boulders continuing |
| 6 | Mponeng: the deepest mine | 4.0e3 m | Hot, dark mine rock; an orange glow accent and heat-haze particles; the borehole-shaft scale reference enters |
| 7 | Approaching the deepest hole ever drilled | 9.0e3 m | Darker rock, the borehole shaft prominent, heat haze fading |
| 8 | The Kola Superdeep Borehole | 1.2262e4 m | Dark drill-hot rock, mineral rubble (`rocks`), the borehole shaft near its own real endpoint |
| 9 | Sedimentary strata, time made visible | 2.0e4 m | Pale, horizontally BANDED rock (`strata`'s `bandFreq` uniform is driven high only here) — the one beat built to look like a page of a book |
| 10 | Deep crustal rock, metamorphosed | 3.0e4 m | Denser, darker recrystallised rock, bands gone |
| 11 | Approaching the base of the crust | 3.3e4 m | Crust-toned rock, unremarkable — the plainest beat in the journey by design |
| 12 | The Mohorovičić discontinuity | 3.5e4 m | A bright, near-white flash plane (`blob`) exactly at the boundary depth |
| 13 | Into the mantle | 3.7e4 m | Olive-green peridotite — an abrupt colour change from beat 12's crust tones |
| 14 | Upper mantle, peridotite | 8.0e4 m | Held olive-green, softer grain |
| 15 | The asthenosphere | 1.5e5 m | Same green, even softer texture (the "flows like glass" material cue is texture, not motion — nothing in this shell actually flows) |
| 16 | Where diamonds form | 1.9e5 m | A dark kimberlite pipe (`blob`, squashed vertical) and bright white/blue sparkle points (`particleField`) against green mantle rock |
| 17 | The transition zone | 5.0e5 m | Muted brown-grey rock, no special accent — an honest admission that phase transitions invisible to the eye stay invisible here |
| 18 | The lower mantle | 1.2e6 m | Dense red-brown rock (bridgmanite tone) |
| 19 | The D″ layer | 2.85e6 m | Darker, streaky red-brown rock with visible banding/veining (`bandFreq`, `veinDensity` both raised) and several dark drifting blobs (the slab graveyard) |
| 20 | Approaching the core–mantle boundary | 2.87e6 m | Near-black rock, right at the edge of the faint self-luminous hint |
| 21 | The core–mantle boundary | D_CMB | A bright orange flash (`glowSphere`) at the crossing depth, rock giving way to glow |
| 22 | Into the outer core | 2.92e6 m | Fully glowing orange material, mottled with grain — no more "lit rock," now self-luminous |
| 23 | The liquid outer core, and the magnetic field | 4.0e6 m | Glowing orange-gold material with drifting bright convection points (`particleField`) |
| 24 | Approaching the inner-core boundary | 5.10e6 m | Glowing, slightly paler/hotter-toned material |
| 25 | The inner-core boundary | D_ICB | Glowing material shifting toward the inner core's warmer-white palette |
| 26 | The solid inner core | 5.8e6 m | Warm white-gold self-luminous material, grain still visible, a distant bright sphere ahead (`glowSphere`) |
| 27 | The centre of the Earth | R_EARTH−200 | The same warm white-gold material, the ahead-sphere now closest and largest it gets |

Copy is factual and unhyped, matching the register the other three briefs
establish. Every checkable number (Mponeng ~4 km and ~60 °C, Kola's 12.262 km,
continental crust averaging ~35 km, the Moho found seismically in 1909,
diamond formation at 150–200 km, the transition zone at 410–660 km, the
core–mantle boundary at 2,891 km, the inner-core boundary at 5,150 km /
radius 1,221 km) is real.

---

## 3. The scale law

`SCALE` (in `index.js`) holds frame width in metres at each beat's own mark,
interpolated in log space via `plog`, exactly like `earth-to-mars` and
`voyager`. Because almost every layer in this journey sizes itself as a
FRACTION OF `rebase.frameMeters()` rather than in fixed metres (the `strata`
shell always fills the view by construction; `rocks` and the borehole shaft
both size themselves off the current frame), this table's real job is
choosing, at each landmark, roughly how wide a slice of rock the reader is
looking at — a couple of metres for a blade of grass, kilometres for the
borehole shaft, hundreds of kilometres through the mantle, millions at the
core. It runs from `frame = 2 m` at the surface to `frame = 3.2e6 m` at the
centre — 6.2 decades of zoom-out across 7.3 decades of depth, because the
last stretch (outer core through centre) is deliberately held WIDER than the
raw log progression would give it, so the glowing material reads as an
enveloping field rather than a a hard-edged small subject.

### Camera tables

`CAM`, `LOOK_Y`, `PAN`, `AZIMUTH` (via `src/kit/camrig.js`'s `aimCamera`, the
same helper `earth-to-mars` and `voyager` use):

- **`CAM`** is nearly constant: `[0, 0.05–0.08, 6.2]` for the whole journey.
  There is no vehicle and no ground plane to stand on, so there is no reason
  for camera height to vary — the "eye level scales with the frame" lesson
  from `big-bang` does not apply here because nothing in this journey is a
  human figure standing on a terrain disc.
- **`LOOK_Y`** is a shallow, steady look-down (0.1 at the surface easing to
  around −0.3 through the deepest beats, back toward −0.1 at the centre) —
  the honest posture for a straight-down descent, never so steep the copy
  panel's own subject (the wall ahead) tips out of frame.
- **`PAN`** shifts from 0.5 to 0.9 early and holds, same convention as every
  other journey: clearing the subject from behind the copy panel.
- **`AZIMUTH`** rotates slowly through the plainest crust/mantle stretches
  (free parallax against a wall that would otherwise be near-featureless for
  long runs, the same device `big-bang`'s deep field and `voyager`'s cruise
  use) and is HELD AT 0 through the three structural events — the Moho, the
  CMB, the ICB — so nothing about the one moment that matters is also
  spinning, the same discipline `CLAUDE.md` already records against the
  Earth–Moon camera's idle bearing.

Because `strata` is a shell always centred on the camera and everything else
is frame-relative, this journey does **not** need `LOOK_X` or an off-axis
subject placement the way `earth-to-mars`'s Sun beat or `voyager`'s Great Red
Spot beat do — there is no second body competing for the frame. That is a
real simplification relative to the other two batch journeys, not an
oversight.

---

## 4. Archetype plan

| layer | archetype | why |
| --- | --- | --- |
| the one continuous rock/metal wall | **`strata`** (new) | see below |
| foreground boulders, mine/borehole rubble, mineral inclusions | `rocks` (new, built for `earth-to-mars`'s foreground-boulder gap, reused here) | a solid, angular, individually-readable lump — the general case `panel`'s flat marked surfaces cannot cover |
| the borehole shaft (Mponeng → Kola) | `trajectory` | a fixed vertical line, the recurring scale reference the human-scale beats need |
| grass | `silhouette` (`reed` kind) | already built for exactly this — blades against a bright backdrop |
| the opening sky glimpse | `backdrop` | the only beat in the journey with any sky at all |
| Mponeng heat-glow, kimberlite/diamond sparkle, D″ slab drift, CMB flash, convection currents, the ahead-core body | `glowSphere`, `particleField`, `blob` | reused verbatim, no new capability needed |

### `strata`: what it is and why it is general, not crust-to-core-specific

`src/archetypes/strata.js` is a material shell that always encloses the
camera — the direct inverse of `backdrop`, which is a shell meant to be seen
THROUGH (a sky, a sea surface). `strata` is meant to be looked AT from every
direction, because the material fills the whole frame. It is driven by:

- **one continuous function of real depth** for band colour, band
  frequency (used for readable sedimentary layering in exactly one beat),
  vein density (kimberlite veins, D″ streaks) and grain — so 27 beats read as
  one continuously changing material, not 27 discrete palette swaps;
- **one continuous `glow` term**, 0 (lit only by an authored lamp) to 1
  (fully self-luminous), that ramps gently through the D″ layer and crosses
  STEEPLY exactly at the core–mantle boundary, rather than fading gradually
  across the whole mantle — the visual equivalent of the axis's own
  approach/crossing/aftermath structure.

Nothing about this is specific to rock. Any future journey whose reader is
"inside" a substance rather than looking across empty space toward a subject
— fog, ice, tissue, the inside of a star — can reuse `strata` the same way
this journey reuses `backdrop` for its own one sky beat. This is what rule 2
is for: the archetype is the reusable idea ("a material enclosing the
viewer"), not the rock texture.

---

## 5. Known defects, found after this brief should have existed

Three real defects were only caught in screenshot review and one only in a
later verification pass — recorded here because that is exactly what this
document is supposed to prevent happening silently again.

1. **A world-space-fixed lamp direction rendered most of the journey
   near-black.** The first `strata` fragment shader lit the shell with
   `nl = dot(vDir, normalize(uLampDir))` where `uLampDir` was a single fixed
   WORLD-space vector. Since the camera's `AZIMUTH` rotates over the course
   of the journey, the "lit" hemisphere of the shell stayed fixed in world
   space while the camera's forward direction swung past it — for most of
   the crust and mantle beats, the camera was looking at the UNLIT
   hemisphere, and the wall read as a black rectangle despite `opacity`
   being 1 throughout. The fix: a strong ambient floor (0.55 base, only 0.55
   more from the directional term) so an authored "lamp" reads as
   illumination from wherever the camera happens to be facing, since it was
   never meant to be a real directional sun in the first place.
2. **Near-white saturated fill under this stage's bloom (threshold ~0.42) is
   a blown-out blank rectangle in a different colour, not a solved "glowing"
   beat.** The inner core was first authored at literal near-white
   (`0xfff8e8`-class), and beats 25–27 converged on one indistinguishable
   pale wash — the same-brown-wall failure surviving in a lighter palette.
   Capped the glow palette short of pure white and kept `grain` meaningfully
   non-zero even while fully self-luminous.
3. **The inner-core-boundary-through-centre trio (25–27) is still the least
   differentiated stretch of the journey**, even after fix #2 — this was
   flagged honestly in the first verification pass and addressed in a
   follow-up tuning pass (see the session's cleanup notes); if this document
   is read before that pass lands, treat beats 25–27 as the journey's
   weakest point.
4. **A long, variable-length ribbon readout string cost real drag accuracy**
   — not in the app itself, but in `scroll-check.mjs`'s own test harness.
   `formatDepth`'s deep branch originally concatenated a kilometre figure AND
   a percentage (`"2,895 km down · 45.4% to centre"`), a string whose length
   swings roughly 19–34 characters across the axis. `.ribbon-readout` is
   `min-width` but not `max-width` (grows with content) and sits beside
   `.ribbon-track` (`flex: 1`) in a flex row, so the track visibly narrows as
   the reader scrubs into long-format territory. `scroll-check.mjs`'s drag
   test captured the track's bounding box ONCE before a sequence of drags;
   once the box went stale mid-sequence, every synthetic pointer move
   targeted the wrong live pixel, reproducing a consistent ~3% error. This
   was NOT a real end-user defect — `ribbon.js`'s own drag handler re-reads
   `getBoundingClientRect()` on every `pointermove`, so a real user's pointer
   never actually decouples from the track — but it was a real, if cosmetic,
   readout-width instability, and the fix (switching the deep branch to
   percentage ALONE, dropping the concatenation) removes the instability at
   its source rather than papering over it in the test.

---

## 6. Risk list

1. **The central, named risk: this journey is inside opaque solid rock or
   metal for its entire length, with no sky, no horizon, and no light source
   that physically belongs there — the single greatest risk of "twenty
   identical brown rectangles."** Addressed by `strata`'s continuous
   depth-driven material function (real, large colour/texture change at
   every landmark — dark soil, pale banded sediment, green peridotite,
   red-brown lower mantle, glowing orange core, warm white-gold inner core),
   the lit-to-glowing arc crossing sharply at the CMB, and a recurring
   fixed-scale reference (the borehole shaft) through the only stretch of
   the journey that is otherwise the plainest (the crust). Verified by
   contact sheet across three iterations — the first pass genuinely failed
   this risk (see defect #1 above) before the ambient-lighting fix.
2. **Additive blending cannot draw a hole**, and this journey has a great
   deal of dark material (soil, crust, the D″ layer). Every dark accent
   (mine rubble, borehole rubble, the slab graveyard, the CMB approach) is
   drawn through `rocks`' own lit shading or `blob`'s normal-style fill
   rather than additive particles, for the same reason `big-bang`'s ash and
   dust needed `blending: 'normal'`.
3. **A zero-effort bloom threshold turns any dense glowing field into a
   white rectangle** — the exact failure in defect #2 above. The fix
   (capped palette, non-zero grain even while glowing) is the general answer
   this project's own `CLAUDE.md` already calls for; this journey is the
   first to need it for a MATERIAL rather than a point-particle field.
4. **An instantaneous structural event inside a long segment** — the Moho,
   the CMB, the inner-core boundary — needs its own tight linear window plus
   a separately-weighted aftermath, same as `big-bang`'s K–Pg beat. Applied
   to all three from the start (see §1), unlike `voyager`'s first pass which
   discovered the same need after the fact.
5. **The transition zone (beat 17) has no accent at all** — an honest
   admission rather than an invented one: the 410/660 km phase transitions
   are real and seismically detected but produce no visible surface feature
   at any scale a camera could show, and inventing one would be the kind of
   fabricated visual this project's honesty standard argues against. This is
   a deliberate plain beat, not an oversight, but it is also the single
   beat most likely to read as "just more brown wall" on a casual scroll.
6. **Camera purity and drag-scrub fidelity depend on the readout string's
   width staying roughly stable** — not documented anywhere before this
   journey exposed it (see defect #4). Any future journey with a similarly
   variable-length readout should watch for the same ribbon-track-narrowing
   effect.

---

## 7. Staged implementation plan (as actually followed)

**S1 — the `rocks` and `strata` archetypes**, plus the Voyager
encounter/departure fix, both prerequisite work for this batch.
→ `vite build` passes; `earth-to-mars` beat 27 re-shot and looked at.

**S2 — axis, meta, depth constants, beats, pacing, registration.**
→ `smoke.mjs crust-to-core` prints `SMOKE PASS`, every beat ≥ its 1.5 vh
floor.

**S3 — layers**, written in one pass rather than leg-by-leg (a process
shortcut relative to the other three journeys' staged builds — this is
part of why Phase 1 was skipped rather than a separate decision).
→ `vite build`, `shots.mjs crust-to-core --sheet`, looked at — and found
broken (defect #1: near-black through most of the journey).

**S4 — lighting and bloom fixes**, iterated three rounds against the
contact sheet until the palette was genuinely distinguishable beat to beat.

**S5 — full verification**: `smoke.mjs`, `vite build`, `shots.mjs --sheet`,
`scroll-check.mjs` for all five journeys, `pages-check.mjs dist /journeys/`.

**S6 — this document**, written after the fact, plus a cleanup pass on the
drag-lag defect (#4), the Voyager Uranus/Neptune/Triton framing, and beats
25–27's differentiation — see the session's final report for what changed
in that pass.
