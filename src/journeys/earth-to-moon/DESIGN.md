> **REWORK LOG — supersedes parts of this document.**
>
> This brief was written for the ORIGINAL 28-beat build. The journey has since
> been reworked against `scripts/frame-check.mjs` and the `journey-craft` skill.
> Where the two disagree, the code and this log are correct.
>
> **Now: 25 beats, 56 vh.** Measured occupancy 0.448 / contrast 0.143 /
> adjacent 10.0, from 0.350 / 0.120 / 6.1 before the rework
> (`big-bang`, the reference, scores 0.525 / 0.149 / 13.9).
>
> **What changed, and why:**
>
> 1. **The travel axis is now HORIZONTAL on screen.** Earth still sits at -y and
>    the Moon at +y, but a new `ROLL` table (via `rollDeg` in `kit/camrig.js`)
>    turns the camera 0° → 90° → 0°: upright on the pad and through the
>    atmosphere, rolled flat across the coast so the journey reads left→right
>    like the ribbon, upright again for the lunar descent. Vertically-composed
>    travel was why the ship never crossed anything and why no frame could hold
>    both worlds. `PAN` rises to ~2.8 during the coast so the departed Earth
>    clears the copy panel, which shares the left edge with it.
> 2. **The coast scale law is a formula, not an anchor table.** The old table
>    held one frame value per beat while distance grew, cancelling out the
>    shrinking; Earth was the same ~20° disc at 25,000 km and 260,000 km. The
>    real law is sampled densely now and Earth runs 69° → 21° → 6.7° → 2.1°.
> 3. **Earth has its own sun.** `EARTH_SUN = [0.46, 0.68, 0.57]`. The shared
>    `SUN` was tuned for the orbital limb and left the whole coast looking at
>    the night hemisphere.
> 4. **Beats cut 28 → 25.** "Nothing to push against", "Small enough to cover"
>    and "Where the Moon takes over" scored 0.029/0.026/0.024 occupancy with
>    adjacent distances under 1 — three captions over one picture of a very
>    small disc — and are now one beat. "Falling around the world" sat three
>    kilometres above "Cut-off" on the same orbit in the same light (adjacent
>    0.5) and was folded into it.
> 5. **Starfield 2,200 → 9,000 points, plus a tilted Milky Way band** (14,000,
>    `flattenY` 0.085). Deep space was black; it is the background plane for
>    half this journey and it now also carries the flanks, which readers can
>    reach by left-dragging.
> 6. **Real lighting.** `stageOptions.sun` adds a directional light with a
>    PCF-soft shadow map; `vehicle` uses `MeshStandardMaterial`, so the stack
>    and the lander have roughness, metalness and self-shadowing.
> 7. **The launch complex is a `tower`, not `blocks`.** Legs, bay ties,
>    alternating cross-bracing, a deck, a crane head and three swing arms. The
>    pad frame widened 130 → 172 m so the 110 m stack and 106 m tower both fit.
> 8. **Clouds are a `cloudDeck`**, not 3,000 point sprites — layered noise
>    planes with a coverage threshold. **Not finished:** see Open below.
>
> **Round 2 — all of the above are now CLOSED:**
>
> - **Cloud deck now renders.** Root cause was transparent RENDER ORDER, not
>   opacity, colour or altitude: the deck and the terrain beneath it are both
>   transparent, and Three sorts transparent objects by camera distance — which
>   for two near-coplanar sheets seen almost edge-on is a coin toss the ground
>   kept winning. An explicit `renderOrder` fixes it. Sorting is not a way to
>   say "this is on top".
> - **Staging flash** moved from -0.20 to +0.06 frame-widths and `LOOK_Y` at
>   67 km raised to 0.42, so the separation happens against black sky instead of
>   at the same screen position as the ground.
> - **Earth no longer clips to white.** `ice` 0.5 → 0.28 (half the planet was
>   rendering as polar white and taking the continents with it) and `segments`
>   128 → 256, because during the orbital beats the limb is most of the frame
>   and 128 shows as facets.
> - **The ship is visible in the coast.** Its length ran at 0.16 of the frame,
>   but the coast frame is set by a body that is barely there, so 0.16 of it was
>   still a few pixels. Now 0.024 of the frame (~60 px at 1440) with the aim at
>   beat 15 eased from -4.8 to -2.1 so the marble and the spacecraft share a
>   frame.
> - **Fins** added to `vehicle` as a general parameter and fitted to the first
>   stage.
>
> **Measured after round 2:** occupancy 0.452, contrast 0.135, adjacent 8.9,
> **5/25 beats flagged** — down from 11/28 at the start of the rework.
>
> **Still open, honestly:**
>
> - Beat 4 ("Through the cloud deck") does not show the deck at its own
>   midpoint — the deck reads at beat 3, from below. The beat is sampled at
>   4.7 km, above a 2 km deck, and the look-down is not yet enough.
> - Beats 17–19 (lunar orbit) remain three similar grey limbs with a blue Earth
>   dot; they differ by lighting but not by composition.
> - The vehicle is detailed enough to read now but is still a cylinder stack
>   with fins — no engine skirt or interstage structure.

# earth-to-moon — design brief

A crewed rocket launch from a Florida pad to a boot on the Moon, told as one
continuous fall through space. Apollo-class hardware and Apollo-class numbers,
but the subject is the **physical journey**, not the programme: what the world
looks like at each distance, and why the distances are the shape they are.

---

## 1. The axis

**Quantity: distance from Earth's surface, in metres, measured along the flight
path.** Monotonic by construction — the vehicle never comes back down until it
is on the Moon, and the two orbital phases spend their scroll in the *real*
altitude bands they occupied (a parking orbit is 185.5 × 190.6 km; a lunar
orbit descends 314 → 111 → 100 → 15 km). The axis never has to lie to stay
ordered.

Anchors:

| symbol | value | source |
| --- | --- | --- |
| `R_EARTH` | 6.371e6 m | mean radius |
| `R_MOON` | 1.7374e6 m | mean radius |
| `TOTAL` | 3.844e8 m | mean Earth–Moon centre distance |
| `MOON_D` | 3.76292e8 m | `TOTAL - R_EARTH - R_MOON` — surface to surface |

The axis runs `1 m → MOON_D + 95 m`. It continues **past** the lunar surface as
distance walked away from the ladder, which is how the last two beats (a
bootprint, and standing far enough out to look up) get to exist at all — every
one of them is at zero altitude and would otherwise collide on the axis end.

### The floor, and why it is not zero

Log space cannot reach zero, so a distance axis anchored at the pad has the same
problem `big-bang` has at t=0 and solves with `ago(1)`. **The floor is 1 m** —
the height the vehicle rises before the hold-down arms are clear. Below one
metre nothing has happened that the reader could see; ignition itself is placed
at 4 m, which is where the stack is actually moving.

### Segment table

The whole axis is cut **one segment per beat**, with the boundary at each beat's
own distance. `big-bang` converged on this after two separate pacing defects
(the life era, then the human era), and the reason it is right is mechanical: a
beat holds the scroll from its own mark to the next, so with per-beat segments
`vh(beat i) = weight_i / Σweight × length`. Pacing becomes a column of numbers
you can read, and re-weighting a beat cannot move any other beat's *distance*.

A pure log axis over 1 → 3.76e8 m is 8.6 decades; the whole ascent to orbit
(1 m → 185 km) is 5.3 of them, i.e. 62% of the scroll for eleven minutes of
flight, and the entire lunar arrival — every beat from "behind the Moon" to
"contact" — is 0.0001 decades and would be **one pixel**. A pure linear axis is
worse in the opposite direction: the pad, ignition, the tower and max-Q all land
inside the first 0.004% of the page. Neither works; the segments are the answer.

`space` is `log` where a segment crosses a decade or more and `linear` where it
is a narrow band (the two orbits, the descent, the walk). Weights are relative
and normalised.

| # | beat | from → to (m) | space | weight | vh |
| --- | --- | --- | --- | --- | --- |
| 1 | The pad | 1 → 4 | log | 1.00 | 1.93 |
| 2 | Ignition | 4 → 110 | log | 1.25 | 2.41 |
| 3 | The tower clears | 110 → 2.0e3 | log | 1.00 | 1.93 |
| 4 | Through the cloud deck | 2.0e3 → 1.37e4 | log | 0.90 | 1.74 |
| 5 | Max Q | 1.37e4 → 3.5e4 | log | 1.10 | 2.12 |
| 6 | The sky goes out | 3.5e4 → 6.7e4 | log | 0.90 | 1.74 |
| 7 | Staging | 6.7e4 → 9.5e4 | log | 1.25 | 2.41 |
| 8 | The escape tower goes | 9.5e4 → 1.40e5 | log | 0.85 | 1.64 |
| 9 | The second stage | 1.40e5 → 1.855e5 | log | 0.95 | 1.83 |
| 10 | Cut-off | 1.855e5 → 1.88e5 | linear | 1.10 | 2.12 |
| 11 | Falling around the world | 1.88e5 → 1.905e5 | linear | 0.95 | 1.83 |
| 12 | Sixteen sunrises | 1.905e5 → 1.95e5 | linear | 0.95 | 1.83 |
| 13 | Translunar injection | 1.95e5 → 6.0e6 | log | 1.20 | 2.31 |
| 14 | Turnaround | 6.0e6 → 2.5e7 | log | 1.00 | 1.93 |
| 15 | The whole Earth | 2.5e7 → 8.0e7 | log | 1.05 | 2.02 |
| 16 | Nothing to push against | 8.0e7 → 2.6e8 | log | 0.85 | 1.64 |
| 17 | Small enough to cover | 2.6e8 → 3.397e8 | log | 0.90 | 1.74 |
| 18 | Where the Moon takes over | 3.397e8 → 3.70e8 | log | 1.05 | 2.02 |
| 19 | The Moon becomes a place | 3.70e8 → 3.75978e8 | log | 1.10 | 2.12 |
| 20 | Behind the Moon | 3.75978e8 → 3.76181e8 | linear | 1.05 | 2.02 |
| 21 | Earthrise | 3.76181e8 → 3.76192e8 | linear | 1.15 | 2.22 |
| 22 | The terminator | 3.76192e8 → 3.76277e8 | linear | 0.95 | 1.83 |
| 23 | Powered descent | 3.76277e8 → 3.762897e8 | linear | 1.10 | 2.12 |
| 24 | Pitchover | 3.762897e8 → 3.7629185e8 | linear | 1.00 | 1.93 |
| 25 | Sixty seconds | 3.7629185e8 → 3.76292e8 | linear | 1.10 | 2.12 |
| 26 | Contact | MOON_D → +9 | linear | 1.20 | 2.31 |
| 27 | One boot | +9 → +55 | linear | 1.00 | 1.93 |
| 28 | The Earth does not rise here | +55 → +95 | linear | 1.15 | 2.22 |

Σweight = 29.05, `length = 56` viewport-heights. **Tightest beat 1.64 vh**,
widest 2.41. Every beat in this journey stages a scene — there is no era of
abstract fields to coast through — so the pacing floor is **1.5 vh everywhere**,
not the two-tier arrangement `big-bang` needs.

Reasoning behind the non-uniform weights: ignition, staging, TLI and contact are
*events* and get ~25% more; the three long coast beats (16, 17, and 8) are the
ones where nothing changes but the size of a disc and get ~15% less. Nothing
drops below the floor.

### Readout

`distance.js` owns the format, the same way `time.js` does for `big-bang`, and
it switches mode where the story does:

- `< 1 km` → `12 m up`
- `< 1000 km` → `13.7 km up`
- past that, `1,850 km from Earth`
- past the halfway point → `38,000 km to the Moon` (counting **down**, because
  from there on that is the number the crew cared about)
- inside 400 km of the Moon → `110 km above the Moon`
- at or past the surface → `on the Moon` / `12 m from the ladder`

---

## 2. The beats

28 beats. `D` is distance from Earth's surface. "Midpoint" is what the review
screenshot will contain — `shots.mjs` samples 45% into each beat, so this is the
column that actually gets judged.

| # | heading | D (m) | on screen at the beat's MIDPOINT |
| --- | --- | --- | --- |
| 1 | The pad | 1 | The stack on the pad at dawn, service tower alongside, floodlights, sea haze on the horizon |
| 2 | Ignition | 4 | Full-length vehicle, the flame trench flooded with white light, a plume broader than the rocket, ground glare |
| 3 | The tower clears | 110 | Vehicle above the tower top, the pad shrinking below, plume long and bright |
| 4 | Through the cloud deck | 2.0e3 | Cloud tops from just above them, the coastline going blue-grey underneath |
| 5 | Max Q | 1.37e4 | Rocket small against a deep blue sky, thin condensation collar, the sea 14 km down |
| 6 | The sky goes out | 3.5e4 | The band above the horizon black with stars, the horizon itself still blue and now visibly curved |
| 7 | Staging | 6.7e4 | Two objects: the spent first stage tumbling behind, the second stage's plume lit above it, a ring of debris between |
| 8 | The escape tower goes | 9.5e4 | The tower flying away on its own small motor; Earth's limb now a full arc |
| 9 | The second stage | 1.40e5 | The vehicle against Earth's blue limb, a wide flat curve, atmosphere as a thin bright rind |
| 10 | Cut-off | 1.855e5 | Plume gone. The ship coasting, Earth filling the lower two-thirds of the frame |
| 11 | Falling around the world | 1.88e5 | Same altitude, dark side of Earth below, city lights on the night hemisphere |
| 12 | Sixteen sunrises | 1.905e5 | The terminator crossing beneath, the atmosphere's rind lit orange at the edge |
| 13 | Translunar injection | 1.95e5 | The third stage burning again, the ship pulling off the limb; Earth already smaller |
| 14 | Turnaround | 6.0e6 | The ship separated, turned end for end, docking with the lander; Earth a fat disc below |
| 15 | The whole Earth | 2.5e7 | Earth as a complete ball, terminator across it, the Moon a small bright disc above |
| 16 | Nothing to push against | 8.0e7 | Both bodies small, the ship between them, nothing else in frame — the honest picture of a coast |
| 17 | Small enough to cover | 2.6e8 | Earth a marble low in frame, the Moon now the larger object |
| 18 | Where the Moon takes over | 3.397e8 | The Moon clearly nearer, Earth a bright point; the ship slowest here |
| 19 | The Moon becomes a place | 3.70e8 | The Moon fills a third of the frame — craters, maria, a hard terminator, no atmosphere rind |
| 20 | Behind the Moon | 3.75978e8 | The far side filling the frame, unlit limb against stars, no Earth anywhere |
| 21 | Earthrise | 3.76181e8 | Lunar surface across the bottom, Earth small and bright climbing out of it |
| 22 | The terminator | 3.76192e8 | Low sun over the Sea of Tranquility, crater shadows kilometres long |
| 23 | Powered descent | 3.76277e8 | The lander with its descent engine lit, surface sliding past 15 km below |
| 24 | Pitchover | 3.762897e8 | The lander upright, the landing site ahead and below, boulders resolving |
| 25 | Sixty seconds | 3.7629185e8 | Very low, dust beginning to stream outward in flat sheets, shadow of the lander on the ground |
| 26 | Contact | MOON_D | Engine off, the dust sheet gone the instant the engine stops, four footpads on grey ground |
| 27 | One boot | +9 m | One bootprint at a 1.4 m frame — ridged sole, sharp edges, no wind to erase it |
| 28 | The Earth does not rise here | +55 m | A figure on grey ground, black sky, Earth hanging motionless at 2° across |

Copy is factual and quiet: no "conquest", no "man's greatest", no exclamation.
Every number in the copy is checkable — 7.6 million pounds of thrust, 2,700
tonnes on the pad, 10.8 km/s at TLI, 0.9 km/s at the crossover, 1/6 g.

---

## 3. The scale law

`scaleAt(u) = plog(SCALE, u) / 4`; `SCALE` holds the **frame width in metres**
(same convention as `big-bang`). `frameMeters = 4 × metersPerUnit`, the camera
sits ~6 units out, and the visible width is ≈ 2.6 × frameMeters at 16:9.

### The geometry the law is derived from

The **origin is the spacecraft**. Earth's centre sits at `y = -(R_EARTH + D)`
and the Moon's centre at `y = +(TOTAL - R_EARTH - D)` — both on the world Y
axis, both derived from the axis value every frame, no world-space constant
anywhere. Consequences worth writing down:

- The reader leaves the thing at the bottom of the frame and arrives at the
  thing at the top. That is the whole journey in one compositional rule.
- **Azimuth is free.** Both bodies lie *on* the rotation axis, so swinging the
  camera about Y does not move either of them. `big-bang` had to hold azimuth at
  0 from the protoplanetary disc onward because its compositions were authored
  in world space; here a bearing swing costs nothing and buys parallax on the
  starfield and on the ship's own attitude.
- Both bodies render at their **true angular size** whenever their distance in
  world units is large compared with the camera's 6-unit standoff. That covers
  everything from cut-off to lunar orbit.

The law is therefore, for the whole free-flight phase:

```
frame = 0.571 × min(R_EARTH + D, TOTAL - R_EARTH - D)
```

— i.e. *frame the nearer body at ~7 units*. It peaks at the geometric midpoint
(D = 1.858e8 m, frame 1.097e8 m) and is continuous across it, which is why the
mid-coast beats look like what they are: two small worlds and a ship.

### The table, with the pixel size of the subject

1440 px wide; visible width = 2.6 × frame.

| D (m) | frame (m) | subject, and how big it is |
| --- | --- | --- |
| 1 | 130 | 110 m vehicle = 52% of frame height, ~470 px tall |
| 4 | 150 | held: the plume needs room below the stack |
| 110 | 420 | vehicle ~110 px, service tower alongside |
| 2.0e3 | 7.0e3 | cloud deck 2 km below sits ~1 unit down; ship at 0.16 frames |
| 1.37e4 | 5.0e4 | ground 1.1 units below — the ratio frame ≈ 3.6 × D holds the horizon steady |
| 3.5e4 | 1.4e5 | Earth's radius = 182 units — off band; the *continent* terrain carries it |
| 6.7e4 | 2.6e5 | Earth enters the band at frame ≥ 1.7e5 (6.371e6/mPU ≤ 150). Limb subtends ~161° — a vast curved floor |
| 9.5e4 | 5.0e5 | limb ~155°, terrain fully faded |
| 1.40e5 | 1.6e6 | limb ~131° |
| 1.855e5 | 3.74e6 | Earth centre 7.0 units down, radius 6.8 → **95°** (true from 185 km: 137°; the 6-unit standoff is the whole difference and is documented, not accidental) |
| 6.0e6 | 7.06e6 | Earth 62° → drawn ~48°; the Moon is 404 units off and enters the band here as a 0.5° disc — **its true size from Earth**, which is the point of beat 15 |
| 2.5e7 | 1.79e7 | Earth ~23° — "fits in the window" |
| 8.0e7 | 4.93e7 | Earth 8.9° |
| 1.858e5 … 1.858e8 | 1.097e8 | the peak. Earth 2.9°, Moon 0.79° |
| 2.6e8 | 6.74e7 | Moon 1.7°, Earth 2.6° — they cross about here |
| 3.397e8 | 2.18e7 | Moon 4.5°, Earth 2.1° |
| 3.70e8 | 4.58e6 | Moon ~25° — "becomes a place", craters resolve |
| 3.75978e8 | 1.17e6 | Moon limb 80°, radius 5.95 units |
| 3.76181e8 | 1.06e6 | Earth radius 24 units at 1,445 units → **1.9°, true**. Earthrise is drawn honestly |
| 3.76277e8 | 6.0e4 | hand-off to lunar terrain; 15 km of altitude below |
| 3.762897e8 | 9.0e3 | 2.3 km up, the site ahead |
| 3.7629185e8 | 90 | lander 12.6 m — the frame-fraction floor is converging on its true 7 m |
| MOON_D | 45 | lander at true 7 m = 17% of visible width, ~250 px |
| +9 | 1.4 | a 0.3 m boot = 8% of visible width, ~120 px |
| +55 | 55 | a 1.8 m figure = 45 px; Earth drawn at its true **2°** angular size |

### Why the vehicle is not always drawn at true size

At a 5.0e4 m frame a 110 m rocket is 1.5 px. The lesson `big-bang` records as
*lights read at any scale; geometry does not* applies exactly, and inflating the
rocket is the fix that lesson forbids. So the vehicle takes

```
lengthMeters = max(TRUE_LENGTH, frameMeters × 0.16)
```

— true size while the frame is tight (pad, tower), then a **formation-camera
convention** above that: the ship is drawn at the size a chase camera flying
alongside would see it, and the world's scale is carried entirely by the axis
readout and by the bodies, which *are* true. The same expression converges back
onto truth during the descent (frame 45 m → 7.2 m ≈ the LM's real height), so the
landing is honest without a pop. This is the same trade `big-bang` documents as
"physically where the observer was ≠ legible".

---

## 4. The camera

`CAM` = `[x, y, z]` in world units, `LOOK_Y` the aim height, `PAN` the
post-aim slide that keeps the subject clear of the copy panel (lower left),
`AZIMUTH` degrees about Y. **The camera is handed no clock.**

Camera height is in UNITS and units scale with the frame — `y × frameMeters / 4`
is the height in metres. The two places that matters here:

- **On the pad** (frame 130 m): `y = 0.92` is 30 m up — a third of the way up
  the stack, looking slightly down at the pad deck. `y = 0.1` would be 3 m and
  the vehicle would leave the top of frame.
- **On the Moon** (frame 55 m): `y = 0.11` is 1.5 m — eye level for a person in
  a suit. `y = 0.45` would be 6 m, and a 1.8 m figure would sit below the
  horizon against dark ground instead of against black sky, which is where its
  contrast comes from.

| u anchor | CAM | LOOK_Y | PAN | AZIMUTH | why |
| --- | --- | --- | --- | --- | --- |
| D=1 | [0, 0.92, 6.2] | 0.25 | 0.6 | -22 | three-quarter view of the stack; the tower reads as a tower, not a stripe |
| D=110 | [0, 0.5, 6.0] | 0.15 | 0.9 | -14 | pulling level as the ground drops |
| D=1.37e4 | [0, 0.25, 6.0] | 0.1 | 1.0 | -8 | ship right of the panel, horizon low |
| D=6.7e4 | [0, 0.3, 6.1] | 0.05 | 1.0 | -4 | staging: two objects need the width |
| D=1.855e5 | [0, 0.4, 6.2] | 0.35 | 0.9 | 0 | tipped up off the limb so the ship is not on the planet |
| D=2.5e7 | [0, 0.2, 6.3] | 0.0 | 1.1 | 6 | both bodies in frame, centred |
| D=1.86e8 | [0, 0.0, 6.4] | 0.0 | 1.0 | 12 | mid-coast; the azimuth swing is free parallax on the stars |
| D=3.70e8 | [0, 0.15, 6.2] | 0.35 | 1.0 | 4 | aiming up at the Moon, which is above |
| D=3.76181e8 | [0, 0.25, 6.0] | 0.30 | 0.8 | 0 | Earthrise: the horizon low, sky above it |
| D=3.76277e8 | [0, 0.6, 6.0] | -0.25 | 0.9 | 0 | descent: aimed *down* at the ground going past |
| MOON_D | [0, 1.33, 6.0] | -0.1 | 0.7 | 0 | 15 m up, looking at the lander on its pads |
| +9 | [0, 1.2, 5.4] | -0.45 | 0.4 | 0 | over the boot, looking down — a print seen edge-on is a smudge |
| +55 | [0, 0.11, 6.0] | 0.30 | 0.9 | 0 | eye level, sky above the horizon: Earth is the subject |

---

## 5. Archetype plan

Existing archetypes carry most of it:

| layer | archetype |
| --- | --- |
| Earth as a body, all phases | `planet` (seaLevel / green / ice / night uniforms, `offsetMeters` = `-(R_EARTH+D)`) |
| the Moon as a body | `planet` (grey `rock`, no atmosphere, `offsetMeters` = `+(TOTAL-R_EARTH-D)`) |
| pad ground, coastal landscape, continent, lunar regolith | `terrain` ×4, gated on `frameMeters` |
| sky at the pad and through the atmosphere | `backdrop`, driven from blue to black |
| cloud deck, contrail, ice shed, staging debris, landing dust | `particleField` (`normal` blending for anything that must OBSCURE) |
| engine glare, first-stage retro flash, sun | `glowSphere` |
| stars | `particleField` shell, gated on frame |
| launch complex, blockhouse | `blocks` |
| the astronaut, the flag, the pad crew | `silhouette` (`figure`) |
| the bootprint | `panel` — a flat surface carrying procedural marks. Needs one new `kind: 'bootprint'` drawing routine; that is a routine, not a new archetype |

Two things nothing here can express, and both are wanted by the three journeys
queued behind this one (Earth→Mars, Voyager→Pluto, crust→core).

### New archetype 1 — `vehicle`

A procedural craft. Everything is authored as **fractions of the total length**,
so one number (`lengthMeters`) scales the whole machine, and nothing in it knows
what a Saturn V is.

```js
vehicle({
  lengthMeters,          // number | ({u, local, rebase}) => metres — total stack length
  stages: [              // bottom → top, spans are fractions of lengthMeters
    { span, r, topR, color, nozzles, nozzleR, shed: ({u,local}) => 0..1 },
  ],
  capsule: { span, r, color, cone },     // conical/domed nose
  tower:   { span, r, color, shed },     // escape tower, or a probe's boom
  panels:  { count, span, width, at, tilt, color, deploy: () => 0..1 },  // solar wings, radiators
  dish:    { r, at, tilt, color },       // Voyager-class high-gain antenna
  legs:    { count, span, spread, deploy },  // lander gear
  bands: 5,                              // painted roll-pattern stripes
  plume:   { span, r, core, edge, gain, throttle: ({u,local}) => 0..1 },
  attitude: ({u, local, t}) => [pitch, yaw, roll],   // radians
  lightDir, offsetMeters, opacity, respectBand,
})
```

`shed` on any stage/tower/leg group returns 0→1 and *translates that group
backwards along the stack axis while fading it*, which is what makes staging,
tower jettison and LM ascent one mechanism instead of three. `plume.throttle`
drives length, radius and brightness together; the plume is a cone with an
additive core and a normal-blended dark shock collar, because **additive alone
cannot draw the dark part of an exhaust** and a plume that is only additive
disappears against a bright daytime sky.

Covers here: Saturn V (3 stages + capsule + tower), the CSM/LM stack (2 stages +
dish), the LM descent (1 stage + legs + plume). Covers next: a Mars transfer
stack (stages + panels), a Voyager-class probe (`stages: []`, `dish`, `panels`
used as the RTG boom).

### New archetype 2 — `trajectory`

A path through space with a travelling marker and a distinction between the part
already flown and the part still to fly.

```js
trajectory({
  path: (s) => [x, y, z],   // s in 0..1 → METRES in the journey's frame
  points: [[x,y,z], …],     // …or an explicit polyline, same units
  samples: 260,
  progress: ({u, local}) => 0..1,   // how much has been flown
  marker: { radiusMeters, color, halo },   // the travelling body, or null
  color, colorAhead, aheadOpacity, ticks, tickEveryMeters,
  opacity, offsetMeters, respectBand,
})
```

The flown part is drawn bright, the part ahead faint — which is what turns a
line into a *plan*. `ticks` places marks at fixed real intervals, so a coast can
be read as a rate. Used here for the translunar coast and the descent arc.
Reusable verbatim for a Hohmann transfer (Earth→Mars) and a gravity-assist
swingby (Voyager), which is why the path is a parametric function in metres and
not a preset shape.

Both live in `src/archetypes/`, are exported from `src/archetypes/index.js`, and
contain no reference to the Moon, to Apollo, or to this journey.

`terrain` also gains `offsetMeters`, matching `particleField`, `silhouette`,
`blocks`, `blob` and `glowSphere`. It is needed because the ground during ascent
sits `D` metres *below* the origin (the origin is the ship), and its absence was
an inconsistency in the archetype set rather than a design decision.

---

## 6. Risk list

Each is a specific way this looks bad, and the specific check.

1. **The plume vanishes against a blue sky.** Additive cannot darken. → the
   plume carries a normal-blended dark collar and the sky is driven dark early;
   check beats 3–5 by eye.
2. **The landing dust reads as a glow.** Regolith kicked by an engine is *lit
   grey material*, not light. → `blending: 'normal'`, and it must be visible as
   a sheet crossing the frame at beat 25, not a haze.
3. **A beat whose subject has left by its midpoint.** Staging, tower jettison,
   contact are instantaneous inside their segments. → each gets its own segment
   and a three-phase envelope (approach → event → aftermath), and the review
   shot at 45% must contain the event.
4. **Two orbits collapse to a pixel.** → dedicated linear segments; `smoke.mjs`
   gates every beat at 1.5 vh.
5. **Black frames at the two hand-offs** (ascent terrain → Earth-the-planet, and
   Moon-the-planet → lunar terrain). → every ground layer gates on
   `rebase.frameMeters()`, never on u, with the ranges deliberately overlapping.
6. **The mid-coast beats are empty.** Two small discs and nothing else is
   *honest* and may still read as a bug. → the starfield stays, the `trajectory`
   layer draws the path, and the ship is at a readable 0.16 frames.
7. **The Moon reads as a grey ball with no features.** `planet`'s fbm was tuned
   for continents. → drive `seaLevel` very low so the whole sphere is "land",
   raise the detail contrast via `rock`, and check the terminator at beat 19.
8. **An oversized rocket next to a true-size Earth is a lie the reader can
   see.** → the frame-fraction is held at one constant 0.16 for the whole free
   flight so it never *changes* mid-shot, and it converges to truth at the
   landing.
9. **Copy/visual mismatch.** "The sky goes out" over a blue sky; "Earthrise"
   with no Earth. → contact sheet, read every caption against its tile.

---

## 7. Staged implementation plan

Each stage ends with a command that must pass before the next begins.

**S1 — archetypes.** `vehicle.js`, `trajectory.js`, `offsetMeters` on
`terrain.js`, `bootprint` kind on `panel.js`, all exported.
→ `vite build` must succeed.

**S2 — axis, meta, registration.** `distance.js`, `axis-def.js`, `pacing.js`,
`meta.js` (`order: 2`, accent `#7fd8ff` — cyan, unmistakably not `big-bang`'s
`#ff9a5c`), `beats.js`, a stub `layers.js`, `curve.js`, `index.js`.
→ `smoke.mjs` prints `SMOKE PASS` with every `earth-to-moon` beat ≥ 1.5 vh.

**S3 — generalise `smoke.mjs`** to iterate registered journeys rather than
hard-coding `big-bang`, with per-journey floors declared in each `pacing.js`.
→ `smoke.mjs` still passes for `big-bang` with identical numbers.

**S4 — layers, era by era.** (a) pad + ascent, (b) orbit + TLI, (c) coast,
(d) lunar arrival + orbit, (e) descent + surface.
→ after each: `vite build`, then `shots.mjs earth-to-moon … --sheet`, and the
sheet is **looked at**.

**S5 — camera and scale tuning** against the contact sheet. Iterate.

**S6 — full verification.** `smoke.mjs`, `vite build`,
`shots.mjs … --sheet`, `scroll-check.mjs`, `pages-check.mjs dist /journeys/`.
