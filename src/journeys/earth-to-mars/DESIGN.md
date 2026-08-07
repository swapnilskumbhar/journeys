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
| 17 | A point of light | MARS_D-5.97e8 | log | 1.00 | 2.16 |
| 18 | A disc | MARS_D-5.46e7 | log | 1.00 | 2.16 |
| 19 | Ochre, and a white cap | MARS_D-1.016e7 | log | 1.05 | 2.27 |
| 20 | Olympus Mons, Valles Marineris | MARS_D-5.79e6 | log | 1.05 | 2.27 |
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

| # | heading | midpoint (what is on screen 45% in) | archetypes | px | hue |
| --- | --- | --- | --- | --- | --- |
| 1 | The pad | The stack on the pad, floodlit, service tower alongside, pad buildings and lamp clusters behind it | vehicle, blocks, terrain, backdrop, particleField | vehicle ~500 px tall | amber dusk |
| 2 | Ignition | Full vehicle, flame trench lit white, ground glare, plume wider than the stack | vehicle+plume, terrain, blocks, backdrop | plume ~380 px | white-hot amber |
| 3 | The tower clears | Vehicle above the tower, pad shrinking below, tipping onto its heading | vehicle, terrain, cloudDeck, backdrop | vehicle ~115 px | pale gold |
| 4 | Max Q | A small vehicle against a lit cloud deck, coast far below, the sky above already going dark | vehicle, cloudDeck, terrain, backdrop, particleField | vehicle ~70 px, deck fills lower half | steel blue over white |
| 5 | Staging | Spent first stage tumbling behind in a debris cone, retro flash, second stage lit ahead of it | vehicle (shed), particleField, glowSphere, terrain | flash ~160 px | white on near-black |
| 6 | The sky goes black | Stars above a still-blue, visibly curved horizon | planet, particleField, backdrop | limb ~150 deg of frame | black over cyan |
| 7 | Parking orbit | Coasting, Earth's lit limb filling the lower frame | planet, vehicle, particleField | Earth ~93 deg | ocean blue |
| 8 | One quiet orbit | The terminator crossing beneath, city lights strung along the dark coastlines | planet (night), vehicle, particleField | Earth ~93 deg | blue-black + sodium |
| 9 | Trans-Mars injection | The stage burning again and pulling off the limb, Earth already visibly smaller | vehicle+plume, planet, particleField | Earth ~80 deg, plume ~200 px | blue + engine amber |
| 10 | Earth shrinking behind | Earth a receding disc at frame left, the Sun anchored above it, the stack at frame right | planet, glowSphere, vehicle, backdrop, particleField | Earth ~98 px | cold blue |
| 11 | Nothing close to anything | A small craft, a faint trajectory line, the galactic band and stars - the honest picture of deep space | vehicle, trajectory, backdrop, particleField | Earth ~9 px, craft ~430 px | indigo |
| 12 | A dimmer sun | The Sun measurably smaller and cooler than at Earth, craft in the foreground, band swung across the frame | glowSphere, vehicle, backdrop, particleField | Sun glare ~330 px | violet-grey |
| 13 | Crossing Earth's orbit | The transfer arc crossing a faint blue ring - Earth's own orbit - both worlds gone to points | trajectory x2, vehicle, backdrop, particleField | ring ~10 units radius | dusty violet |
| 14 | The cruise stage unfolds | Solar panels swinging out to their full span, catching a sun already visibly dimmer | vehicle (panels/deploy), backdrop, particleField | panel span ~520 px | navy on rust |
| 15 | A course correction | A brief, precise burn - a thin flame off the cruise stage against a backdrop that does not change | vehicle+plume, trajectory, backdrop | flame ~90 px | rust + blue flame |
| 16 | Crossing Mars' orbit | The arc crossing a second faint ring, Mars' own path, with an ochre point sitting almost on the crossing | trajectory x2, glowSphere, vehicle, backdrop | Mars point ~20 px | ochre |
| 17 | A point of light | An ochre point, brighter than anything else ahead, no disc yet - held about halfway to the frame's right edge | glowSphere, planet, vehicle, backdrop | Mars ~15 px | ochre on rust |
| 18 | A disc | A small hard-edged ochre disc off to frame right, the cruise stage in the near foreground | planet, vehicle, backdrop, particleField | Mars ~133 px | rust |
| 19 | Ochre, and a white cap | Mars filling the right half - rust dust, a bright polar cap, a hard terminator | planet, vehicle, backdrop | Mars ~404 px | iron oxide |
| 20 | Olympus Mons, Valles Marineris | Mars cropped by the right edge, surface relief resolving across the disc | planet, vehicle, backdrop | Mars ~738 px | deep rust |
| 21 | Entry interface | The capsule in a thin plasma sheath, orange-white, streaming behind it over rust ground | glowSphere, particleField, terrain, backdrop | sheath ~260 px | orange-white |
| 22 | Peak heating | The sheath at its brightest and widest, briefly the only bright thing in frame | glowSphere, particleField, terrain, backdrop | sheath ~330 px | white-orange |
| 23 | Parachute | A single large canopy open above the lander, ground detail resolving beneath | blob, vehicle, terrain, backdrop | canopy ~320 px | bone on butterscotch |
| 24 | Heat shield away | The shield tumbling out to one side above the horizon, the lander's underside and legs revealed | blob, vehicle, terrain, backdrop | shield ~190 px | charred rust |
| 25 | Powered descent | Retro engines lit, dust starting to billow off the ground below | vehicle+plume, particleField, terrain | lander ~100 px | amber on rust |
| 26 | Touchdown | Engines off, dust settling fast in the thin air, four legs planted on rust ground | vehicle, particleField, terrain, backdrop | lander ~13% of width | rust |
| 27 | The first frame | Rust sky near the sun, a butterscotch band at the horizon, boulders in the foreground | rocks, terrain, backdrop | near boulder ~400 px | butterscotch |
| 28 | An evening star | A figure on ochre ground at dusk, Earth a small blue-white point low over the horizon | silhouette, glowSphere, rocks, terrain, backdrop | Earth ~10 px | dusk mauve |

Each beat's own axis mark is in the segment table in section 1 and in
`beats.js`, which are the only two places a beat's position is written down.

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
centre sits at `y = +((MARS_D - d) + R_MARS)` for the whole journey — both
signed distances from the ship, both on the world Y axis, recomputed every
frame from the axis value, exactly as `earth-to-moon` does it for the Earth–
Moon pair. Free-flight framing reuses the inherited rule directly:

```
frame = 0.6 × (distance to the centre of the NEARER world)
```

frames that world at ~6.7 units, and its drawn diameter is then

```
px ≈ 7500 · R / sqrt(16 c² + 38.4 F²)   →   1370 · R / c   at F = 0.6 c
```

on a 900-tall frame at 55° vertical. This is the SAME law `earth-to-moon`
derived — a property of "origin at the spacecraft, camera six units out", not
of any particular pair of bodies.

**MARS' CENTRE IS `alt + R_MARS`, NOT `alt - R_MARS`.** The first build had the
sign wrong, which put the planet's centre a full radius short and made its
surface arrive 6,780 km early. `MARS_D` is the distance to the SURFACE — the
axis ends with the lander standing on it — so the centre is one radius further
on. Check whether an axis quantity is an altitude or a centre distance before
placing a body at it.

**The approach marks are chosen from this law, backwards.** Beats 17–20 promise
a point, a disc, a capped ochre world and resolved surface relief; under
`1370 · R / c` those are altitudes of 3.53e8, 3.46e7, 8.2e6 and 3.24e6 m, and
each beat's segment is sized so its own 45% MIDPOINT lands there. The previous
marks put those midpoints 30 million to 200 thousand kilometres out with the
frame pinned at 4.2e5 m, so all four rendered as identical black rectangles.

**Mars is held ~20° off the boresight, not centred.** `MARS_AIM` weights the aim
at about half of Mars' own offset, which under the 90° cruise roll puts the
planet just over halfway to the frame's RIGHT edge — so it grows ACROSS the
frame from the direction of travel rather than swelling into the middle of it,
and the aim stays shallow enough to keep the galactic band in the picture.

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
| 1 | 140 | 130 m vehicle ~55% of frame height |
| 4 | 160 | held: plume needs room below the stack |
| 130 | 460 | vehicle ~115 px, tower alongside |
| 1.4e4 | 5.2e4 | lit cloud deck fills the lower frame, vehicle ~70 px |
| 6.5e4 | 2.6e5 | Earth's limb enters the band |
| 9.5e4 | 5.0e5 | limb ~150 deg, terrain fully faded |
| 2.0e5 | 3.8e6 | Earth radius 6.7 units at 6.7 units off |
| 2.2e5 | 3.95e6 | 0.6 x (R_EARTH + d) takes over here, continuous |
| 1.0e7 | 9.82e6 | Earth 533 px - the departure begins |
| 7.9e7 | 5.6e7 | Earth 98 px (beat 10's own midpoint) |
| 1.0e9 | 6.04e8 | Earth 9 px, handing to the `earth-point` glow |
| 3.0e10 | 1.1e10 | the Sun, sized and dimmed by real flux, is the subject |
| 1.5e11 | 4.6e10 | Earth's orbital ring ~10 units radius, crossed |
| 2.2e11 | 6.2e10 | panels deployed to their full span |
| 3.6e11 | 7.6e10 | course-correction flame, small and precise |
| 5.0e11 | 4.0e10 | Mars' ring crossing; Mars still a placed point |
| MARS_D-5.97e8 | 3.60e8 | 0.6 x marsCentre takes over; Mars 15 px at midpoint |
| MARS_D-5.46e7 | 3.50e7 | Mars 133 px at midpoint - a hard-edged disc |
| MARS_D-1.016e7 | 8.10e6 | Mars 404 px at midpoint - cap and terminator resolve |
| MARS_D-5.79e6 | 5.50e6 | Mars 738 px at midpoint, cropped by the right edge |
| MARS_D-6.0e5 | 1.00e6 | the planet mesh hands over to the terrain stack |
| MARS_D-1.25e5 | 3.0e5 | entry interface, thin plasma sheath forming |
| MARS_D-6.0e4 | 6.0e4 | peak heating, sheath at its widest |
| MARS_D-1.1e4 | 9.0e3 | canopy open, ground detail resolving |
| MARS_D-1.4e3 | 7.0e2 | dust plume beginning |
| MARS_D | 45 | lander at true ~6 m ~13% of visible width |
| +9 | 1.4 | a boot/rock scene, ~150 px foreground detail |
| +55 | 16 | figure at eye level, Earth a POINT of light |

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

### Where the tables live, and why they moved

Every camera table, the frame law and both planets' positions are now in
`plan.js`, imported by BOTH `index.js` and `layers.js`. That is not tidiness.
The single most expensive defect this journey recorded was a subject placed at
one authored world direction while the camera was aimed at a second,
independently-authored direction that was supposed to coincide with it: the Sun
at `[f*0.85, 0, -f*2.08]` against a `LOOK_X` held at 2.6, the spacecraft at
exactly `[0,0,0]`, Mars at a true offset five hundred frame-widths off the
boresight. Eleven consecutive beats measured 0.004-0.15 occupancy because of it.

So:

- `LOOK_Y` is **not authored**. It is `EARTH_AIM(u) * earthUnits(u) +
  MARS_AIM(u) * marsUnits(u)`, and `earthUnits`/`marsUnits` read the same frame
  table the layers read. The aim cannot drift from the bodies.
- Anything with no renderable true position - the Sun always, Earth and Mars
  while they are distant points - is placed by `screenAnchoredMeters`, which
  rebuilds the exact basis `aimCamera` constructs (position, azimuth, look,
  **roll** and pan) and returns a world position for a camera-space
  `{right, up, ahead}`. One formula, not two that have to agree.
- `pointPositionMeters` slides a body continuously between its true offset and
  that anchor, crossing over as the true position comes inside the frame, so a
  placed point never becomes a second copy of the disc it hands over to.

`screenAnchoredMeters` is `voyager/plan.js`'s helper with a roll term added, and
it is kept LOCAL to this journey rather than promoted into `src/kit/`. Promoting
it would make `voyager` depend on a module edited for Mars - a shared-code
change obliging `--sweep`, to solve one journey's placement problem.

### ROLL: the travel axis runs ACROSS the frame

The world axis is +y because during the ascent and the descent "down" is not
arbitrary. So the CAMERA turns instead: `ROLL` goes to 90 degrees once the stack
is clear of Earth and back to 0 as Mars becomes the ground. Earth is then at
frame LEFT, Mars at frame RIGHT, and the trajectory runs the same direction the
ribbon does.

It also **breathes** - about 12 degrees either side on each cruise beat's own
midpoint, alongside alternating 1.8 units of camera height and 30 degrees of
azimuth. That is authored against a measurement: `adjacent` compares 16 x 10
cell AVERAGES, so in a frame that is mostly black it barely notices small bright
objects moving. Beats 11-20 sat at 1.3-2.9 against a 6.0 bar even after the
hero, the Sun and both planets were fixed and the frames were genuinely no
longer empty. Rolling the camera rotates every pixel about the view axis; the
screen-anchored hero and Sun do not move, because they are derived from the
rolled basis.

### The deep sky

A full-frame `backdrop` shell through the whole interplanetary stretch, running
a palette arc - cold blue leaving Earth, violet-grey through the middle, rust as
Mars' orbit comes up - with a bright band at the world y = 0 plane that the
camera-height swings sweep across the frame. Both halves are honest: the
galactic plane is genuinely bright to a camera with no atmosphere in front of
it, and the zodiacal light is a real broad glow along the ecliptic. It is
deliberately kept dark; the first pass at it was a rust wash bright enough to
read as being inside a nebula.

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
