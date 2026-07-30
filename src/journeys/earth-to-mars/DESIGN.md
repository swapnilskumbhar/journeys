# earth-to-mars — design brief

A heavy two-stage stack lifts off Florida, burns for Mars on a Hohmann-class
transfer, and sets down on the ochre ground east of Olympus Mons. Same
contract as `earth-to-moon`: the axis is a real distance, the camera is a
function of it, and the subject the Moon journey cannot offer — the Sun
visibly shrinking and dimming, because Mars really does receive 43% of Earth's
sunlight — is what this journey is *for*.

---

## 1. The axis

**Quantity: distance travelled along the flight path, in metres, pad to
Martian surface.** Monotonic by construction, exactly like `earth-to-moon`:
the vehicle never reverses, and the axis continues past touchdown as distance
walked from the ladder so the last two beats do not collide at zero altitude.

Anchors:

| symbol | value | source |
| --- | --- | --- |
| `R_EARTH` | 6.371e6 m | mean radius |
| `R_MARS` | 3.3895e6 m | mean radius |
| `TRANSFER` | 5.60e11 m | **path length**, not the ~2.25e11 m straight-line opposition distance |
| `MARS_D` | `TRANSFER` | Earth's surface to Mars' surface, along the path |

### Why 5.60e11 m and not the straight-line distance

A Hohmann transfer is half of an ellipse with the Earth's and Mars' orbits as
its two apses: semi-major axis `a = (1 AU + 1.524 AU)/2 = 1.888e11 m`,
semi-minor `b = sqrt(1 AU × 1.524 AU) = 1.846e11 m`. Half the Ramanujan
ellipse-perimeter approximation gives an arc length of **5.86e11 m** for the
transfer orbit itself; the ascent, parking-orbit and descent legs shave a
little off the two ends. **5.60e11 m** is the round number this journey uses
for the pad-to-surface path — it is the number that makes "the path length,
not the straight line" true (the straight-line distance is under half of it),
and it is why the interplanetary cruise, not the ascent or the landing, owns
most of the axis: it is most of the real distance.

### The floor

Same reasoning as `earth-to-moon`: log space cannot reach zero, so the floor
is **1 m**, about where the stack clears the hold-down arms. Ignition sits at
4 m.

### Segment table

One segment per beat, boundary at each beat's own distance — `smoke.mjs` gates
every beat in viewport-heights, not as a fraction of the axis, for the same
reason recorded in both `CLAUDE.md` and `earth-to-moon/DESIGN.md`: a pacing
bug that looks fine relative to the axis can still be 0.13 vh on screen.

`length = 64` vh. Σweight = 29.60.

| # | beat | D (m) | space | weight | vh |
| --- | --- | --- | --- | --- | --- |
| 1 | The pad | 1 | log | 1.00 | 2.16 |
| 2 | Ignition | 4 | log | 1.25 | 2.70 |
| 3 | The tower clears | 130 | log | 1.00 | 2.16 |
| 4 | Max Q | 1.4e4 | log | 1.10 | 2.38 |
| 5 | Staging | 6.5e4 | log | 1.25 | 2.70 |
| 6 | The sky goes black | 9.5e4 | log | 0.90 | 1.95 |
| 7 | Parking orbit | 2.0e5 | linear | 0.95 | 2.05 |
| 8 | One quiet orbit | 2.05e5 | linear | 0.90 | 1.95 |
| 9 | Trans-Mars injection | 2.2e5 | log | 1.20 | 2.59 |
| 10 | Earth shrinking behind | 1.0e7 | log | 1.00 | 2.16 |
| 11 | Nothing close to anything | 1.0e9 | log | 0.85 | 1.84 |
| 12 | A dimmer sun | 3.0e10 | log | 0.90 | 1.95 |
| 13 | Crossing Earth's orbit | 1.5e11 | log | 0.85 | 1.84 |
| 14 | The cruise stage unfolds | 2.2e11 | log | 0.95 | 2.05 |
| 15 | A course correction | 3.6e11 | log | 1.05 | 2.27 |
| 16 | Crossing Mars' orbit | 5.0e11 | log | 0.90 | 1.95 |
| 17 | A point of light | 5.30e11 | log | 1.00 | 2.16 |
| 18 | A disc | 5.55e11 | log | 1.00 | 2.16 |
| 19 | Ochre, and a white cap | 5.590e11 | log | 1.05 | 2.27 |
| 20 | Olympus Mons, Valles Marineris | 5.598e11 | log | 1.05 | 2.27 |
| 21 | Entry interface | MARS_D-1.25e5 | linear | 1.30 | 2.81 |
| 22 | Peak heating | MARS_D-6.0e4 | linear | 1.20 | 2.59 |
| 23 | Parachute | MARS_D-1.1e4 | linear | 1.20 | 2.59 |
| 24 | Heat shield away | MARS_D-2.0e3 | linear | 1.00 | 2.16 |
| 25 | Powered descent | MARS_D-1.4e3 | linear | 1.20 | 2.59 |
| 26 | Touchdown | MARS_D | linear | 1.30 | 2.81 |
| 27 | The first frame | +9 | linear | 1.10 | 2.38 |
| 28 | An evening star | +55 | linear | 1.15 | 2.48 |

Tightest beat 1.84 vh (11, 13), widest 2.81 vh (21, 26) — every beat clears the
1.5 vh floor with margin, because the cruise (the journey's real risk) is
given *more* beats rather than left to a single long one.

### Readout

`distance.js` mirrors `earth-to-moon`'s: metres/km while close to a body,
`X,XXX,XXX km from Earth` while outbound, switching to **AU** past 1 Gm (the
unit the number is actually quoted in once it is interplanetary), then
counting down to Mars past the trajectory's own geometric midpoint, then
altitude above Mars, then `on Mars` / `N m from the ladder`.

---

## 2. The beats

| # | heading | D (m) | on screen at the beat's MIDPOINT |
| --- | --- | --- | --- |
| 1 | The pad | 1 | The stack on the pad, taller and heavier than an Apollo stack — a Mars transfer vehicle carries its own upper cruise stage — floodlit, service tower alongside |
| 2 | Ignition | 4 | Full vehicle, flame trench lit white, ground glare, plume wider than the stack |
| 3 | The tower clears | 130 | Vehicle above the tower, pad shrinking, tipping onto its heading |
| 4 | Max Q | 1.4e4 | Small against deep blue, thin contrail collar, sea far below |
| 5 | Staging | 6.5e4 | Spent first stage tumbling behind, second stage's plume lit ahead of it |
| 6 | The sky goes black | 9.5e4 | Stars above a still-blue, visibly curved horizon |
| 7 | Parking orbit | 2.0e5 | Coasting, Earth's blue limb filling the lower frame, plume out |
| 8 | One quiet orbit | 2.05e5 | Same altitude, the terminator crossing beneath, city lights on the dark side |
| 9 | Trans-Mars injection | 2.2e5 | The stage burning again, pulling off the limb; Earth already visibly smaller |
| 10 | Earth shrinking behind | 1.0e7 | Earth a fat, receding disc below the ship, Moon a small companion point |
| 11 | Nothing close to anything | 1.0e9 | A small craft, a faint trajectory line, stars — the honest picture of deep space |
| 12 | A dimmer sun | 3.0e10 | The Sun measurably smaller and cooler-white than at Earth, ship in the foreground |
| 13 | Crossing Earth's orbit | 1.5e11 | The trajectory line crossing a faint ring marking Earth's own path, both worlds gone to points |
| 14 | The cruise stage unfolds | 2.2e11 | Solar panels swung out to their full span, catching a noticeably dimmer sun |
| 15 | A course correction | 3.6e11 | A brief, precise burn — a thin blue flame, no visible effect on the empty backdrop |
| 16 | Crossing Mars' orbit | 5.0e11 | The trajectory crossing a second faint ring — Mars' own path — with Mars now a bright point ahead |
| 17 | A point of light | 5.30e11 | An ochre-tinted star, brighter than anything else ahead, no disc yet |
| 18 | A disc | 5.55e11 | A small hard-edged ochre disc, still smaller than the Moon ever got |
| 19 | Ochre, and a white cap | 5.590e11 | Mars fills a third of the frame — rust-red dust, a bright polar cap, a hard terminator |
| 20 | Olympus Mons, Valles Marineris | 5.598e11 | A vast shield volcano on the limb and a canyon system scored across the disc |
| 21 | Entry interface | MARS_D-1.25e5 | The capsule wrapped in a thin plasma sheath, orange-white, streaming behind |
| 22 | Peak heating | MARS_D-6.0e4 | The sheath at its brightest and widest, the ship briefly the only visible thing |
| 23 | Parachute | MARS_D-1.1e4 | A single large canopy open above, deceleration visible in the ground's slowing rush |
| 24 | Heat shield away | MARS_D-2.0e3 | The shield falling away below, revealing the lander's underside and legs |
| 25 | Powered descent | MARS_D-1.4e3 | Retro engines lit, a dust plume starting to billow off the ground below |
| 26 | Touchdown | MARS_D | Engines off, dust settling fast in the thin air, four legs planted on rust-coloured ground |
| 27 | The first frame | +9 | Rust sky near the sun, a butterscotch band at the horizon, rocks in the foreground |
| 28 | An evening star | +55 | A figure on ochre ground, dusk sky, Earth a small blue-white point low over the horizon |

Copy is factual and quiet, the same register as `earth-to-moon`: no "giant
leap" language. Every checkable number (43% of Earth's sunlight at Mars, a
125 km entry interface, a Hohmann transfer's ~9-month duration in real
missions even though this axis is distance, not time) is real.

---

## 3. The scale law

Same convention as both existing journeys: `SCALE` holds frame width in
metres, `scaleAt(u) = plog(SCALE, u) / 4`, camera stands ~6 units out.

### The origin is the spacecraft

Earth's centre sits at `y = -(R_EARTH + d)` for the outbound leg; Mars'
centre sits at `y = +(MARS_D - R_MARS - d)` for the whole journey — both
signed distances from the ship, both on the world Y axis, recomputed every
frame from the axis value, exactly as `earth-to-moon` does it for the Earth–
Moon pair. Free-flight framing reuses the inherited rule directly:

```
frame = 0.571 × min(R_EARTH + d, MARS_D - R_MARS - d)
```

frames the nearer body at ~7 units, continuous through the geometric midpoint
(d ≈ 2.80e11 m). This is the SAME law `earth-to-moon` derived — it is a
property of "origin at the spacecraft, camera six units out," not of the
Earth–Moon pair specifically, which is why it transfers verbatim.

### Solving the empty-cruise risk (the biggest risk in this journey)

Six consecutive beats (10–16) are real interplanetary space, where "two
bodies and a ship" genuinely runs out for most of the ~4.6 decades between
1e7 m and 5e11 m. Four deliberate devices, decided here rather than
discovered in review:

1. **The `trajectory` archetype draws the actual Hohmann arc**, not a straight
   line — `path(s)` returns points on the transfer ellipse, so the coast has
   a visible curve and a marker that is visibly *travelling*, not idling.
2. **The Sun shrinks and dims, on camera, as a first-class subject** (beat
   12), not a background object: `glowSphere`'s radius and `sunGain` both
   track a real inverse-square-ish falloff, so "a dimmer sun" is something the
   reader can watch happen rather than a line of copy.
3. **Two rings mark Earth's and Mars' own orbital paths** (beats 13 and 16) —
   faint `trajectory` circles the ship's path visibly crosses — giving two of
   the six coast beats a concrete event (a crossing) instead of pure dead air.
4. **The cruise stage itself is a subject, once** (beat 14): `vehicle`'s
   `panels`/`deploy` fields — present in the archetype since `earth-to-moon`
   but never exercised there — swing solar panels out to full span, which
   both breaks up six beats of "small ship, stars" and finally proves that
   code path.

### The table, with the pixel size of the subject

1440 px wide; visible width = 2.6 × frame.

| D (m) | frame (m) | subject, and how big it is |
| --- | --- | --- |
| 1 | 140 | 130 m vehicle ≈ 55% of frame height |
| 4 | 160 | held: plume needs room below the stack |
| 130 | 460 | vehicle ~115 px, tower alongside |
| 1.4e4 | 5.2e4 | frame ≈ 3.7 × altitude — horizon held steady |
| 6.5e4 | 2.6e5 | Earth's limb enters the band; ~150° of curved floor |
| 9.5e4 | 5.0e5 | limb ~150°, terrain fully faded |
| 2.0e5 | 3.8e6 | Earth radius 6.7 units at 7.0 units down → ~93° |
| 2.2e5 | 3.9e6 | held across TMI |
| 1.0e7 | 1.9e7 | Earth ~24° — "fits the window" |
| 1.0e9 | 5.8e8 | Earth 0.9°, Mars a point 300+ units off, ship at k≈3 (0.16 frames) |
| 3.0e10 | 1.5e8 | Sun subtends 0.53° here vs 0.53° AT EARTH — this is the frame where the SUN itself, not a planet, is sized and dimmed as the subject |
| 1.5e11 | 8.6e10 | the geometric peak is close; ring crossing at true scale |
| 2.2e11 | 1.6e11 | panels deployed to their true span, ~0.16 frames |
| 3.6e11 | 1.4e11 | course-correction flame small and precise |
| 5.0e11 | 6.0e10 | Mars ring crossing |
| 5.30e11 | 6.4e9 | Mars a point — sub-pixel disc, drawn as a bright dot |
| 5.55e11 | 2.5e8 | Mars ~31° — a hard-edged disc, still smaller in this frame than the Moon ever got in `earth-to-moon`'s (frame is wider here — Mars is a smaller body seen from farther) |
| 5.590e11 | 1.9e6 | Mars fills a third of frame, cap and terminator resolve |
| 5.598e11 | 4.2e5 | Olympus Mons on the limb, Valles Marineris scored across the disc |
| MARS_D-1.25e5 | 3.0e5 | entry interface, thin plasma sheath forming |
| MARS_D-6.0e4 | 6.0e4 | peak heating, sheath at its widest |
| MARS_D-1.1e4 | 9.0e3 | canopy open, ground detail resolving |
| MARS_D-1.4e3 | 7.0e2 | dust plume beginning |
| MARS_D | 45 | lander at true ~6 m ≈ 13% of visible width |
| +9 | 1.4 | a boot/rock scene, ~150 px foreground detail |
| +55 | 16 | figure at eye level, Earth drawn at true angular size (~10 arcsec at Mars, a POINT of light, not a disc — the composition, not the geometry, is what sells "evening star": see camera notes) |

### Why the vehicle is not always drawn at true size

Same trade as `earth-to-moon`, inherited verbatim: `lengthMeters = max(TRUE,
frameMeters × 0.16)`. True size while the frame is tight (pad, entry,
landing); a formation-camera convention through the cruise so the ship stays
visible next to bodies that are themselves drawn true-to-scale.

---

## 4. The camera

`CAM`, `LOOK_Y`, `PAN`, `AZIMUTH` — same conventions as `earth-to-moon` — plus
**`LOOK_X`**, new here, and the general helper both journeys now share:
`src/kit/camrig.js`'s `aimCamera(cam, { pos, azimuthDeg, lookAt, pan })`, where
`lookAt` is a full `[x, y, z]`, not a bare Y scalar.

### Why this journey needs it and the Moon journey's wall

`earth-to-moon` places both bodies ON the world Y axis, so a single scalar
height aims at "the thing ahead" or "the thing behind" — which is exactly why
its own beat 21 (Earthrise) turned out to be unshowable with `LOOK_Y` alone:
Earth sits diametrically opposite the Moon on that axis, and there is no
`LOOK_Y` value that aims at a nearby body ahead and a distant one behind in
the same shot (see the fix note in `earth-to-moon/layers.js`, `earthrise`
layer). Earth→Mars has the same structural problem twice over, more sharply:

- **The Sun is not on the direction-of-travel axis.** It has to be visible
  and shrinking (beat 12) while the ship still faces roughly along its
  transfer path; it is placed at an authored `LOOK_X`-relative offset, not
  along Y.
- **Earth as an evening star (beat 28) is a real off-axis subject.** From the
  Martian surface at dusk, Earth sits low in the west, near the Sun's glow —
  not "back the way you came" in this journey's axis sense, because the ship
  has long since arrived. It needs an authored screen position with its own
  `LOOK_X`/offset, the same device used to rescue `earth-to-moon`'s beat 21,
  applied here from the start instead of discovered as a defect.

`LOOK_X` defaults to 0 everywhere it is not explicitly authored, so every
beat that only ever needed a vertical aim (the ascent, the descent, most of
the cruise) is unaffected.

### Table (key anchors; full tables in `index.js`)

| u anchor | CAM | LOOK_Y | LOOK_X | PAN | AZIMUTH | why |
| --- | --- | --- | --- | --- | --- | --- |
| D=1 | [0, 0.95, 6.2] | 0.28 | 0 | 0.6 | -22 | three-quarter view of a taller stack |
| D=130 | [0, 0.5, 6.0] | 0.15 | 0 | 0.9 | -14 | levelling as ground drops |
| D=1.4e4 | [0, 0.25, 6.0] | 0.10 | 0 | 1.0 | -8 | high, thin sky |
| D=6.5e4 | [0, 0.30, 6.1] | 0.05 | 0 | 1.0 | -4 | staging needs width |
| D=2.0e5 | [0, 0.40, 6.2] | 0.35 | 0 | 0.9 | 0 | off the limb |
| D=1.0e7 | [0, 0.15, 6.3] | -0.9 | 0 | 1.0 | 6 | Earth low behind, ship ahead |
| D=1.0e9 | [0, 0.0, 6.4] | -1.1 | 0 | 1.0 | 8 | the empty middle; free parallax |
| D=3.0e10 | [0, 0.0, 6.4] | 0 | 2.6 | 0.9 | 10 | the Sun is OFF-AXIS: `LOOK_X` swings to it |
| D=1.5e11 | [0, 0.0, 6.4] | 0 | 0 | 1.0 | 10 | ring crossing, centred on the path |
| D=2.2e11 | [0, 0.0, 6.3] | 0 | 0 | 0.7 | 6 | ship centred, panels need width |
| D=5.30e11 | [0, 0.1, 6.2] | 4.6 | 0 | 1.0 | 2 | swinging onto Mars ahead |
| D=5.598e11 | [0, 0.2, 6.0] | 4.2 | -1.4 | 0.9 | 0 | Olympus Mons on the LIMB — off-axis |
| MARS_D-1.25e5 | [0, 0.3, 6.0] | -0.2 | 0 | 0.9 | 0 | entry, looking down-forward |
| MARS_D | [0, 1.3, 6.0] | -0.1 | 0 | 0.7 | 0 | standing off from the lander |
| +9 | [0, 1.2, 5.4] | -1.6 | 0 | 0.4 | 0 | over the rock, looking down |
| +55 | [0, 0.11, 6.0] | 0.30 | -2.1 | 0.9 | 0 | eye level; Earth is LOW and to one side — `LOOK_X` is the whole point of this beat |

Camera height reasoning is identical to `earth-to-moon`'s: units scale with
frame, eye level on Mars is `y ≈ 0.11` at a 16 m frame (1.7 m).

---

## 5. Archetype plan

Nothing new is required. Every layer reuses the existing eleven archetypes
plus `vehicle` and `trajectory`, exactly as inherited:

| layer | archetype |
| --- | --- |
| Earth, Mars, as bodies | `planet` (`offsetMeters` signed from the ship, ochre/ice uniforms for Mars) |
| pad ground, coastal/continental terrain, Martian terrain (4 grounds, far → close) | `terrain` ×4 + ×4, gated on `frameMeters` |
| sky at the pad, entry plasma glow, Martian dawn/dusk sky | `backdrop` |
| cloud deck, contrail, staging debris, entry plasma streamers, parachute-deploy shock, landing dust | `particleField` (`normal` blending wherever it must OCCLUDE) |
| Sun (shrinking), engine glare, retro flash, Earth as an evening-star point | `glowSphere` |
| stars, the two orbital-path rings | `particleField` shell / `trajectory` (a ring is `path(s) => [cos, 0, sin] × r`) |
| launch complex, blockhouse | `blocks` |
| astronaut, pad crew | `silhouette` |
| the transfer trajectory itself | `trajectory` — its `path` is the actual Hohmann arc this time, not a straight line, which is the harder case it was built for |
| the launch vehicle, cruise stage (with `panels`/`deploy` finally exercised), entry capsule, lander | `vehicle`, one craft with three `shed` events (stage sep, fairing/heat-shield, chute) |

---

## 6. Risk list

1. **Six beats of empty cruise reads as a bug, not as honesty.** → the four
   devices in §3: the curved trajectory with a moving marker, the Sun as a
   visible subject, two ring-crossings, and the panel deployment.
2. **Additive blending cannot draw the entry plasma's dark contrail, the
   retropropulsion dust, or a hole in the sky.** → the sheath's outer edge and
   all dust/debris are `normal`-blended, same fix as the Moon journey's plume
   collar and big-bang's ash/dust.
3. **A warm Martian sky turns the entry glow or the retro flame into a
   sunrise.** → the sky is driven toward black through peak heating and the
   dust plume is dark, not additive.
4. **An instantaneous event inside a long segment.** Staging, chute deploy,
   heat-shield separation, touchdown are each given their own segment with a
   three-phase envelope (approach → event → aftermath), same as `earth-to-
   moon`'s staging and big-bang's K–Pg beat.
5. **Frame ≤ terrain radius / 6**, camera height in units (eye level
   `y ≈ 0.1`), scatter must enclose the camera, ground layers gate on
   `rebase.frameMeters()` never on `u` — all four are the exact defects
   `CLAUDE.md` records against this project's own history and are checked by
   eye at every beat that touches ground.
6. **Copy/visual mismatch**, specifically: "a dimmer sun" must show a visibly
   smaller, cooler disc, not just dimmer bloom; "an evening star" must show a
   POINT, not a disc (Earth from Mars is ~10 arcsec, far under the "true
   angular size" convention used at the Moon's surface — drawing it at a
   token minimum size is the honest choice here, and is called out in code).
7. **The two new engine/archetype-adjacent pieces (`LOOK_X`, `camrig.js`)
   must not change `big-bang` or `earth-to-moon`'s rendering.** → verified by
   screenshot before/after (see verification log in the final report) — both
   journeys' camera math is refactored to call the same helper with
   arguments that reproduce their original output exactly.

---

## 7. Staged implementation plan

**S1 — the shared camera capability.** `src/kit/camrig.js`
(`aimCamera(cam, {pos, azimuthDeg, lookAt, pan})`). Refactor `earth-to-moon`'s
`camera()` to call it with `lookAt:[0, LOOK_Y(u), 0]` (unchanged math).
→ `vite build` passes; before/after screenshots of `big-bang` and
`earth-to-moon` beat 1 and beat 21 are visually identical (big-bang untouched
entirely; earth-to-moon changed ONLY at beat 21, deliberately, per its own
defect note).

**S2 — earth-to-mars axis, meta, registration.** `distance.js`, `axis-def.js`,
`pacing.js`, `meta.js` (`order: 3`, accent), `beats.js`, a stub `layers.js`,
`curve.js` (a straight copy of the shared curve helpers — kept per-journey per
the existing convention rather than promoted to the engine, since `curve.js`
is explicitly "not in the engine, which should stay ignorant of how any one
journey chooses to feel"), `index.js`.
→ `smoke.mjs` prints `SMOKE PASS` for every registered journey, this one
included, every beat ≥ its own floor.

**S3 — layers, leg by leg.** (a) pad + ascent, (b) parking orbit + TMI,
(c) the cruise (curved trajectory, Sun, two rings, panel deploy),
(d) Mars approach, (e) EDL, (f) surface.
→ after each: `vite build`, `shots.mjs earth-to-mars … --sheet`, looked at.

**S4 — camera and scale tuning** against the contact sheet, including the two
`LOOK_X` beats (the Sun, and Earth as an evening star). Iterate.

**S5 — full verification.** `smoke.mjs`, `vite build`, `shots.mjs --sheet`,
`scroll-check.mjs` for all three journeys, `pages-check.mjs dist /journeys/`.
