# voyager — REWORK BRIEF (2026-07-31)

**This section supersedes the beat staging in the original brief below. The
axis reasoning below still stands and is unchanged; the beat list, the camera
plan and the layer plan are replaced.**

The first build scored **0.032 mean occupancy, 0.6 mean adjacent, 30 of 32
beats flagged** — the worst in the repo, and the journey that motivated
`frame-check.mjs`. A blind review of it reads: *"the same white lampshade shape
in the same position on black; beats 22–32 are one picture."*

The writing is good and is mostly kept. What failed is that a journey about
distance was staged as a constant-size object on an empty field.

**Note the original brief's own opening paragraph, still below: it says the
design work here "is almost entirely about NOT looking like twenty black
rectangles with captions".** It named the exact failure mode and then shipped
it. A brief that identifies the risk is not a control; that is what the gate is
for.

## What went wrong, precisely

1. **The sticker.** The probe was drawn at near-constant apparent size in all 32
   frames, so nothing in the picture ever said *travel* — a HUD decal, not a
   world object. It failed the name-the-object test outright.
2. **Eleven beats of nothing at the end.** Beats 22–32 all say some version of
   "space gets emptier" and all render as one white shape on black. That is a
   beat-SELECTION failure, not a staging one, and no amount of tuning fixes it.
3. **The encounters were dots.** Jupiter peaked at 0.074 occupancy, Saturn at
   0.066 — the copy promises a world and the frame delivers a point. Same defect
   `CLAUDE.md` already documents for the K–Pg beat.
4. **Density.** 403 lines of `layers.js` over 32 beats = 12.6/beat, half the
   `design-lint` floor and a fifth of `big-bang`'s 56.

## The three structural decisions

**32 beats → 22.** The outer solar system goes from eleven beats to four. Cut:
"The Moon, in passing", "Banded cloud tops", "Cruise to Uranus", "Cruise to
Neptune", "Sunlight fading toward starlight", "The termination shock" (merged
into the heliopause), "Interstellar space", "Deeper into the dark", "The Oort
cloud". Every one of those was a caption over the same picture.

**The ship stops being the subject.** It appears in six beats at genuinely
different sizes and angles — 90 px at cruise, a 30 px silhouette against
Jupiter's lit face, absent entirely through the encounters — and is gone from
the rest. Continuity is carried instead by the **Sun**, which shrinks and dims
monotonically and measurably across the whole axis, and by the **trajectory**,
flown part bright and remaining part faint so position-in-plan is always
readable.

**Encounters get their own tight axis segments.** Each giant planet needs a
window sized to ~40 planet-radii plus a separately-weighted departure segment —
the departure's weight is the whole control over where the beat's midpoint
lands. The original used ~0.05 AU windows, which at Saturn is still ~100
planet-radii and renders as a point. Each beat's `at` mark must sit ON the
body's true orbital radius; Saturn's were originally 0.4–0.6 AU short of its
real 9.58 AU, so even a correct window was tight around the wrong point.

## Beat sheet

`px` is the subject's intended size at 1440 wide. `midpoint` is what is on
screen 45% into the beat, which is where every review samples.

`px` is measured on the built journey at 1440 wide, not intended — where the
built figure differs from what this brief first asked for, the reason is given
in the row and in "Deviations" below.

| # | heading | midpoint | archetypes | px | hue |
| --- | --- | --- | --- | --- | --- |
| 1 | The Grand Tour alignment | The ecliptic seen from above its plane as a lit dust disc 35 AU across, the Sun burning at its centre, the four giant planets as markers on their own orbit circles strung out along one radius | particleField, glowSphere, trajectory | Sun 220, planets 26–70 | warm gold |
| 2 | Leaving Earth | Earth a lit gibbous filling the left half, city lights on the terminator; the Titan-Centaur a small lit stack crossing right of it; the escape path arcing away to frame right | planet, vehicle, trajectory, particleField | Earth 570, ship 110 | blue |
| 3 | Into deep cruise | The spacecraft large in three-quarter view mid-frame, bus, boom and dish all readable; the zodiacal dust a band across the frame; Mars a small ochre point BEHIND at frame left, already passed; the Sun a 145 px glare at the left | vehicle, particleField, glowSphere, trajectory | ship 180, Sun 145, Mars 30 | ochre |
| 4 | The asteroid belt | Irregular boulders at three depths, the nearest large and dark on its shadow side, the field receding into the frame with grit between; Sun smaller now; ship small among them | rocks, glowSphere, vehicle, particleField | nearest rock 260 | grey-brown |
| 5 | Approaching the giant | Jupiter a banded disc right of centre and clearly growing; the ship a small lit shape against its face; the Sun reduced to a bright point at far left | planet, vehicle, glowSphere, trajectory | Jupiter 500, ship 40 | tan |
| 6 | Jupiter: the Great Red Spot | Jupiter fills two-thirds of the frame, bands running horizontally, the Great Red Spot a distinct oval below the equator with its wake trailing round the belt | planet, blob, particleField | Jupiter 750 | tan / brick |
| 7 | Io's volcanoes | Io in the foreground, sulphur-yellow and volcanically repaved, a plume rising in a column off its limb; Jupiter behind at its true 19° from Io's own orbit | planet, particleField | Io 485, Jupiter 342 | sulphur yellow |
| 8 | Europa's cracked ice | Europa filling the frame centre-right, a dozen bright lineae running as ARCS across its face, almost no craters; Jupiter a bright crescent edge at frame left | planet, trajectory | Europa 600, Jupiter 215 | pale blue-white |
| 9 | The gravity assist | The whole hyperbolic flyby in frame — Jupiter left of centre, the path wrapping past it at its real 4.9-radius periapsis, flown part bright and unflown faint, the spacecraft on it | trajectory, planet, vehicle, particleField | path spans frame, Jupiter 150, ship 40 | tan |
| 10 | Cruise to Saturn | The Sun measurably smaller and dimmer than beat 3, the ship in a plainly different attitude with its dish edge-on, Saturn a pale point ahead at frame right at its true offset, the galactic band behind | glowSphere, vehicle, particleField, trajectory | Sun 60, ship 400 | deep blue |
| 11 | Saturn: the rings edge-on | Saturn's globe right of centre with the ring plane a single razor-thin bright line crossing the whole frame horizontally | planet, particleField, trajectory | Saturn 620, ring line 1440 | pale gold |
| 12 | The rings, lit | Rings tilted into sunlight, resolved into separate annuli with the Cassini division a real gap and individual ringlets over them; globe partly out of frame | planet, particleField, trajectory | rings 1300 | gold |
| 13 | Titan's haze | Titan a featureless orange disc left of centre, its limb softened by a haze shell; Saturn's ringed bulk behind at reduced brightness | planet, glowSphere, particleField | Titan 560, Saturn 98 | orange |
| 14 | Voyager 1 and 2 diverge | Two ticked trajectory ribbons splitting from one point, one climbing out of the plane and the other holding it; both spacecraft on them at different attitudes; Saturn a point behind | trajectory, vehicle, glowSphere, particleField | ships 240, split spans 900 | cyan / white |
| 15 | Uranus: tipped on its side | Uranus a pale cyan disc, nearly featureless, its ring system standing VERTICALLY across the frame — the 98° tilt readable in one look | planet, particleField, trajectory | Uranus 500, rings 1000 | pale cyan |
| 16 | Neptune: the deepest blue | Neptune deep blue right of centre, banded, with the Great Dark Spot a distinct oval on the disc and diffuse methane cirrus below it | planet, blob, particleField | Neptune 550 | deep blue |
| 17 | Triton's nitrogen geysers | Triton in the foreground, pinkish and cratered, dark geyser plumes off the terminator and dark streaks blown downwind across the ice; Neptune a blue crescent clear of its limb | planet, particleField | Triton 560, Neptune 143 | pink-white |
| 18 | Pluto's distance, and the Kuiper belt | A sparse field of icy bodies at three depths and a range of sizes, dimly lit, receding into the frame; no dominant subject — this beat is about the field | rocks, particleField, glowSphere | nearest body 200 | dim grey |
| 19 | The Pale Blue Dot | A wide shaft of scattered sunlight crossing the frame diagonally with a fainter second one behind it, and inside the first a single bright point — Earth — everything else dark | particleField, glowSphere | Earth 4, shaft 1300 | warm streak on black |
| 20 | The heliopause | A structured plasma boundary filling the frame as a knotted violet shell, warm solar-wind plasma piled up on the sunward side and colder interstellar material past it | filaments, particleField | spans frame | violet |
| 21 | The Golden Record | The record filling most of the frame at an angle, gold, its grooves and engraved cover diagram legible as marks; the spacecraft's structure dark around it | panel, vehicle, backdrop | record 665 | gold |
| 22 | The Sun as just another star | A dense field of stars, warm and cool, with nothing distinguishing any of them; the Sun one unremarkable 4 px point among its neighbours | particleField, glowSphere | Sun 4 | black / white |

### Deviations from the brief above, and why

- **Beat 3 — Mars is behind, not ahead.** The beat's own copy says "past Mars'
  orbital distance", and its midpoint lands at 1.95 AU, so Mars is 0.43 AU
  astern. The brief asked for it at frame right; putting it there would have
  contradicted the sentence directly under it.
- **Beat 9 — Jupiter is 150 px, not 700.** These two cannot both be true.
  Voyager 1's real closest approach was 4.9 Jupiter radii, so a true-scale
  flyby path is ten planet-widths across; at the 700 px framing the brief
  implies, every part of the trajectory that BENDS is outside the frustum, and
  the beat becomes a third portrait of the same banded disc. The manoeuvre is
  the subject, so the manoeuvre got the frame.
- **Beat 9 — the limb is upper-left, not lower-left.** The copy panel owns the
  lower left, and `frame-check` masks it; a subject placed there is both
  hidden from the reader and invisible to the gate.
- **Beat 21 — 665 px, not 700.** Arithmetic, not judgement: at a 0.30 m frame
  a 0.30 m disc is 665 px.

## Pacing

22 beats, flat 1.5 vh floor — every beat stages a concrete scene, so there is no
tiered floor of the kind `big-bang` needs. Target length ~62 vh. Beat 19, the
Pale Blue Dot, takes the widest weight in the journey: it is the emotional
centre and the one beat that must not be rushed.

## Density budget

22 beats × 40–60 lines = **880–1320 lines of `layers.js`**. The original was
403. Under 550 and the journey has not been built; `design-lint.mjs` will say
so.

---

# Original brief (superseded above, retained for the axis reasoning)

The Voyager mission, Earth to interstellar space and beyond: launch inside a
once-every-176-years planetary alignment, four giant-planet encounters bought
with gravity assists rather than fuel, the Pale Blue Dot, the actual physical
boundary of the Sun's influence, and a closing honest statement about the
distance to the nearest other star. This is the grandest and emptiest of the
three spaceflight journeys — most of its axis is real, correctly-scaled
nothing — and DESIGN work here is almost entirely about NOT looking like
twenty black rectangles with captions.

---

## 1. The axis

**Quantity: heliocentric range — distance from the Sun, in metres.** This is
the deliberate INVERSE of earth-to-mars' choice of path length: Voyager's real
flight path bends hard at every gravity assist and is not remotely radial, so
path length is not even well-defined without picking a projection, while
heliocentric range is exactly the quantity JPL's own Voyager tracker reports,
is true of the actual mission, and — critically — is monotonically increasing
for the entire post-Saturn cruise, which is most of this journey's length.
Earth-to-mars needed path length because a straight-line axis would have
suppressed the interplanetary distance the whole journey argues for; this
journey needs range because a path-length axis would need a fictional
projection of a trajectory this brief cannot render.

Floor: **1 AU (1.496e11 m)**, which is not an arbitrary near-zero the way the
other two journeys' floors are — Earth's own orbital radius is genuinely
where the spacecraft starts. Far end: **268,000 AU (~4.0e16 m)**, Proxima
Centauri's real distance, closed out with an honest travel-time statement
(see beat 32) rather than any implication Voyager is headed there.

### Segment table

One segment per beat (32 beats), boundary at each beat's own mark, `space`
linear inside four tight clusters (Jupiter's four sub-beats, Saturn's four,
Neptune/Triton, Voyager-today/Golden-Record) where consecutive beats sit
within a fraction of a percent of each other in AU — log space works there
too, but linear makes the near-equal spacing explicit. `length = 82` vh,
`Σweight = 34.40`.

| # | beat | distance | space | weight | vh |
| --- | --- | --- | --- | --- | --- |
| 1 | The Grand Tour alignment | 1.00 AU | log | 1.15 | 2.74 |
| 2 | Leaving Earth | 1.02 AU | log | 1.00 | 2.38 |
| 3 | The Moon, in passing | 1.03 AU | log | 0.90 | 2.15 |
| 4 | Into deep cruise | 1.5 AU | log | 0.95 | 2.27 |
| 5 | The asteroid belt | 2.7 AU | log | 1.05 | 2.50 |
| 6 | Approaching the giant | 4.5 AU | log | 1.00 | 2.38 |
| 7 | Jupiter: the Great Red Spot | 5.20 AU | linear | 1.20 | 2.86 |
| 8 | Banded cloud tops | 5.203 AU | linear | 1.00 | 2.38 |
| 9 | Io's volcanoes | 5.205 AU | linear | 1.10 | 2.62 |
| 10 | Europa's cracked ice | 5.207 AU | linear | 1.05 | 2.50 |
| 11 | The gravity assist | 5.25 AU | linear | 1.15 | 2.74 |
| 12 | Cruise to Saturn | 7.5 AU | log | 1.00 | 2.38 |
| 13 | Saturn: the rings edge-on | 9.0 AU | linear | 1.10 | 2.62 |
| 14 | The rings, lit | 9.4 AU | linear | 1.05 | 2.50 |
| 15 | Titan's haze | 9.58 AU | linear | 1.00 | 2.38 |
| 16 | Voyager 1 and 2 diverge | 9.70 AU | log | 1.10 | 2.62 |
| 17 | Cruise to Uranus | 14 AU | log | 1.00 | 2.38 |
| 18 | Uranus: tipped on its side | 19.20 AU | log | 1.15 | 2.74 |
| 19 | Cruise to Neptune | 25 AU | log | 1.00 | 2.38 |
| 20 | Neptune: the deepest blue | 30.10 AU | linear | 1.20 | 2.86 |
| 21 | Triton's nitrogen geysers | 30.15 AU | log | 1.05 | 2.50 |
| 22 | Pluto's distance, Kuiper belt | 39.50 AU | log | 1.05 | 2.50 |
| 23 | The Pale Blue Dot | 40.50 AU | log | 1.35 | 3.22 |
| 24 | Sunlight fading toward starlight | 60 AU | log | 1.00 | 2.38 |
| 25 | The termination shock | 94 AU | log | 1.15 | 2.74 |
| 26 | The heliopause | 121 AU | log | 1.20 | 2.86 |
| 27 | Interstellar space | 130 AU | log | 1.05 | 2.50 |
| 28 | Voyager 1, today | 166 AU | linear | 1.10 | 2.62 |
| 29 | The Golden Record | 166.1 AU | log | 1.10 | 2.62 |
| 30 | Deeper into the dark | 1,000 AU | log | 0.95 | 2.27 |
| 31 | The Oort cloud | 20,000 AU | log | 1.05 | 2.50 |
| 32 | The Sun as just another star | 268,000 AU | log | 1.20 | 2.86 |

Tightest beat 2.15 vh (3), widest 3.22 vh (23, the Pale Blue Dot — the
journey's emotional centre gets its own extra weight, not a shared "cruise"
segment). Every beat clears the 1.5 vh floor with at least 0.6 vh of margin.

### Readout

`distance.js`'s `formatDistance`: AU while under 5,000 AU (the unit this
mission is actually quoted in — JPL's own tracker), then light-years once the
number would otherwise run to five or six digits.

---

## 2. The beats

32 beats; heading, real distance, and what is on screen at the midpoint are
in `beats.js`'s comments and the table above. Highlights of what each
midpoint shows: launch — the Titan-Centaur stack, Earth still full-disc
behind; the asteroid belt — a sparse debris field the ship visibly threads,
correctly nearly-empty; Jupiter — GRS as a dark-red accent on the limb, Io's
plume as a bright jet, Europa a small icy companion; the gravity assist — the
Grand Tour path's authored kink, bright behind the ship, faint ahead; Saturn
— two ring-edge trajectory circles, edge-on then lit; Uranus — a nearly
featureless pale cyan disc; Neptune — deep blue with Triton's geyser jet;
the Pale Blue Dot — a sub-pixel point in a scattered sunbeam, held for the
journey's widest beat; the heliopause — a shell of particles changing colour
and tightening as the plasma boundary is crossed; the Golden Record — a small
gold disc visible on the bus; the close — the Sun a bare point among stars.

Copy is factual and unhyped, matching the register CLAUDE.md and both earlier
briefs establish: every checkable number (176-year alignment period, the
Dec 2004 termination-shock crossing, the Aug 2012 heliopause crossing, the
40.5 AU / Feb 1990 Pale Blue Dot photograph, ~166 AU today, 4.0134 ly to
Proxima Centauri, ~74,000 years of travel time at Voyager 1's ~17 km/s) is
real.

---

## 3. The scale law and the empty-cruise risk

This is the central design problem, named up front per the brief. Four
devices, decided here rather than discovered in review:

1. **The Sun is a continuous, physically-driven subject for the WHOLE
   journey**, not just one beat the way earth-to-mars uses it. Its radius and
   brightness both track real inverse-square flux (`fluxAt(d)` in
   `layers.js`) from launch to the closing frame — four-plus orders of
   magnitude of dimming the reader can watch happen continuously, held at a
   fixed off-axis screen position (`SUN_ANGLE`, mirrored in the camera's
   `LOOK_X` bias) so it never has to be re-found.
2. **`trajectory` draws the whole Grand Tour plan** as one authored curve with
   a visible kink at each gravity assist — flown part bright, unflown part
   faint — so the reader always has a concrete "where am I in the plan"
   object even during beats with no planet nearby.
3. **The heliosphere boundary is drawn as a real structure with a crossing**,
   not narrated as a fact: a diffuse shell of particles brightens approaching
   the termination shock, then changes colour and tightens at the heliopause
   — "the moment the plasma density jumps" made visible.
4. **Every multi-beat encounter (Jupiter, Saturn) is staged as several beats
   with distinct concrete features** (a storm accent, a volcanic jet, ring
   edges then lit rings, a hazy moon) rather than one static planet held for
   its whole encounter — the same anti-monotony device the human era of
   big-bang and the Mars EDL sequence use for a different problem (there, too
   little scroll per event; here, too little visual incident per unit scroll).

### Scale table (frame width in metres, held per beat)

Unlike the two-body earth-to-moon/mars law, this journey passes FIVE bodies
sharing one y-axis convention, so the frame is authored directly per beat
(`SCALE` table in `index.js`) rather than derived from a single two-body
formula: wide (AU-scale, `0.02–2` AU) through empty cruise so the ship, the
faint trajectory and the stars all read; tight (a few times the relevant
planet's own radius, `1.5e8`–`6e8` m) through each flyby. Selected anchors:
Jupiter closest approach 2.0e8 m (radius 6.99e7 m → subtends a large fraction
of frame height); Saturn 3.2–3.6e8 m; Uranus 1.6e8 m; Neptune 1.5e8 m; the
Pale Blue Dot beat 0.05 AU (~7.5e9 m, wide enough that Earth is honestly
sub-pixel and drawn as a point, never geometry); the closing frame ~9,000 AU,
wide enough that the Sun is unambiguously a point among points.

---

## 4. The camera

Same `aimCamera`/CAM/LOOK_Y/LOOK_X/PAN/AZIMUTH convention `earth-to-mars`
established, reused verbatim (no changes to `src/kit/camrig.js`). `LOOK_X`
carries the Sun's fixed off-axis bearing for nearly the whole journey (the
throughline device above) plus a few dedicated swings toward an off-axis
planetary feature (the Great Red Spot). `LOOK_Y` swings positive toward each
approaching body and returns toward 0 through the empty stretches, mirroring
earth-to-mars' vertical convention exactly.

---

## 5. Archetype plan

No new archetypes and no engine/kit changes — every layer reuses the existing
library exactly as inherited: `planet` (Jupiter/Saturn/Uranus/Neptune, colour
uniforms only — no bespoke gas-giant shader was written; band structure is
represented honestly as an accent rather than invented geometry the archetype
does not support), `glowSphere` (the Sun, Earth, the Moon, Europa, Titan,
Pluto, the Pale Blue Dot), `particleField` (stars, the asteroid belt, Io's
plume, Triton's geysers, the Kuiper belt, the termination shock and
heliopause shells, the Oort cloud, the sunbeam streak), `trajectory` (the
Grand Tour path with its assist kinks, Saturn's ring edges as closed-path
circles), `blob` (the Great Red Spot accent, the Golden Record disc),
`vehicle` (the Voyager bus: one stage, a capsule body, a dish — no panels,
because Voyager is RTG-powered, not solar), `backdrop` (a plain deep-space
sky for the closing frame).

---

## 6. Risk list

1. **Most of this journey is real, correctly-scaled emptiness — the named
   central risk.** Addressed by the four devices in §3. This is the
   single biggest open question in the honest self-assessment below: several
   cruise beats (4, 12, 17, 19, 24, 30) were not individually re-shot and
   re-tuned after the first pass, and are the most likely to still read as
   thin on inspection.
2. **A gas giant with no band-structure shader risks reading as a plain
   sphere with the wrong colour.** Mitigated by the GRS/Io/Europa/Titan
   accent layers giving each encounter at least one legible point of visual
   incident beyond the sphere itself, but this is a real, named simplification
   relative to a bespoke atmosphere shader, which was judged out of scope for
   the archetype library at this stage (rule 2 — extend the archetype
   generally later if a future gas-giant journey needs real banding, rather
   than write one here).
3. **Additive blending cannot draw the sunbeam streak's texture or the
   heliopause's density jump as anything but a glow.** The sunbeam streak
   is `normal`-blended for exactly this reason; the heliopause and
   termination-shock shells are deliberately left additive (they represent
   plasma density, which genuinely IS a brightening, not an occluding
   surface) — the one place this journey's physics argues against the
   `blending: normal` default the rest of the project uses for solid/occluding
   material.
4. **Placing five bodies on one shared y-axis convention risks angular
   collisions the way Mars' Olympus Mons beat had with the Sun.** Checked
   explicitly for the Sun-vs-planet angle at each flyby anchor in the camera
   table; not verified by eye at every single beat (see honest report).
5. **`rebase.weight()`, `respectBand`, frame ≤ body radius × several,
   opacity envelopes on every layer** — all the standing defects this
   project's CLAUDE.md records — apply here exactly as elsewhere and were
   followed by convention rather than independently re-derived.

---

## 7. Staged implementation plan

**S1 — axis, meta, distance, pacing, curve, registration.**
`smoke.mjs` prints `SMOKE PASS` including `voyager`, every beat ≥ 1.5 vh.

**S2 — beats and DESIGN.md** (this document).

**S3 — layers**: (a) Sun + stars + vehicle + Earth/Moon departure, (b) the
asteroid belt + Grand Tour trajectory, (c) Jupiter cluster, (d) Saturn
cluster, (e) Uranus/Neptune + Triton, (f) Pluto/Kuiper + Pale Blue Dot,
(g) heliosphere boundary + Golden Record + Oort cloud + closing backdrop.
→ after each: `vite build`, `shots.mjs voyager … --sheet`, looked at.

**S4 — camera/scale tuning** against the contact sheet.

**S5 — full verification**: `smoke.mjs`, `vite build`, `shots.mjs --sheet`,
`scroll-check.mjs` for all four journeys, `pages-check.mjs dist /journeys/`.
