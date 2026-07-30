---
name: journey-craft
description: Compose and review journeys so the FRAMES work, not just the code. Use when building a new journey, adding or restaging beats, tuning a scale law / camera / layer envelopes, or reviewing whether a journey is good enough to ship. Covers the composition rules, the five measured failure modes, and the frame-check gate that catches "it built clean and looks like nothing".
---

# Journey craft

`CLAUDE.md` tells you how the engine works and what not to break. This tells you
how to make a journey that is worth scrolling. They are different problems: a
batch of four journeys once shipped with a passing build, `SMOKE PASS`, clean
`scroll-check`, reviewed screenshots — and 20 of 32 `voyager` beats were the same
white sticker on black.

## The one rule

**Cover the copy panel with your thumb. If you cannot tell what the beat is
about, the beat does not exist.**

The panel is a caption on a picture. Every failure below is a version of the
picture quietly delegating its job to the caption, which is invisible to every
automated check and easy to miss by eye because you read the caption first.

## Measure it before you judge it

```bash
node scripts/frame-check.mjs [id …] --port=5175
```

Shoots every beat mid-beat, **masks out the copy panel, ribbon and header**, and
measures what is left. Three numbers per beat:

- **occupancy** — fraction of the picture that differs from its own background.
  How much of the frame is subject rather than void.
- **contrast** — luminance spread. A flat wash of one colour scores near zero.
- **adjacent** — perceptual distance (0–100) from the previous beat. Consecutive
  beats below the gate are the same picture twice, whatever the copy says.

Calibration, measured on the five journeys in this repo:

| journey | occupancy | contrast | adjacent | flagged |
| --- | --- | --- | --- | --- |
| `big-bang` — the one that works | **0.525** | **0.149** | **13.9** | 5/39 (13%) |
| `earth-to-mars` | 0.372 | 0.134 | 8.3 | 13/28 (46%) |
| `earth-to-moon` | 0.350 | 0.120 | 6.1 | 10/28 (36%) |
| `crust-to-core` | 0.066 | 0.043 | 11.0 | 20/27 (74%) |
| `voyager` | 0.026 | 0.050 | 0.5 | 32/32 (100%) |

Aim for `big-bang`'s column. Under ~0.25 occupancy or ~6 mean adjacent, the
journey is in trouble no matter how good the writing is.

The gate is a floor, not a target — a frame can clear every threshold and still
be dull. **Failing one is near-proof it is broken; passing all three is not
proof it is good.** Run it, then still look at the contact sheet.

This is the same move the vh pacing gate made: a defect you can only describe in
adjectives ("too fast", "looks samey") stays unfixed until it is measured in the
unit the reader experiences.

## The five failure modes

### 1. The sticker

**`voyager`: the same white probe, same size, same screen position, in all 32
frames.** Mean adjacent distance 0.5 out of 100. The craft was drawn at a
near-constant apparent size for the whole journey, so nothing in the picture
ever said *travel* — a HUD decal, not a world object.

A vehicle, probe or avatar must **change apparent size, angle and lighting**
across a run of beats, or it must leave the frame and let the world carry it.
If the subject cannot legibly change, the frame's job belongs to something else.

### 2. The empty frame

**`voyager` cruise beats: occupancy 0.004–0.02.** Interplanetary space really is
empty, and "honest" is not a defence — the reader gets a black rectangle.

Emptiness is a *composition* problem with composition answers: a foreground
element to park the eye, a continuously-changing element (a Sun that genuinely
shrinks and dims), a trajectory with the flown part bright and the rest faint so
position-in-plan is always readable, parallax against a starfield. Pick these in
the design brief, not at review.

### 3. The wall

**`crust-to-core`: full-frame procedural fog, contrast 0.043.** The inverse of
the empty frame and exactly as bad. Inside opaque material there is no horizon,
no sky, no silhouette — everything defaults to one uniform noise field.

A material needs **structure at more than one scale**: bands, veins, fractures,
inclusions, a boundary crossing the frame, something with an edge. If the
subject is "rock", the frame still needs geometry in it, not just a shader.

### 4. The stall

**`earth-to-moon` beats 9–12: four identical grey limbs**, adjacent ~1.5. Four
different captions over one picture. Beats 23–27 repeat it on the surface.

Two consecutive similar frames is a hold. Three is a stall. When the axis passes
through a stretch where the world genuinely does not change, that stretch should
be **fewer beats**, not more captions.

### 5. The blowout

**`crust-to-core` beats 25–27: near-white saturated fill** under this stage's
0.42 bloom threshold converged on one indistinguishable pale wash. A glowing
subject is still a *material*: cap the palette short of white and keep grain
non-zero, or "glowing rock" becomes "light source with no texture".

## Travel must be perpendicular to the camera

**The single most effective way to make a journey boring is to point the camera
along the direction of travel.** Motion across the frame reads as motion.
Motion toward or away from the camera reads as an object very slowly changing
size, which is to say: as nothing.

`earth-to-moon` put Earth at −y and the Moon at +y with the camera on +z. Every
consequence followed from that one choice:

- the trajectory became a vertical stripe up the middle of the frame,
- the ship never crossed anything, so it read as a decal pinned to the centre,
- departure and destination were 180° apart, so no frame could hold both, so
  every beat had to pick one and the other simply vanished,
- and the copy panel (lower left) fought the subject for the same real estate.

**Lay the travel axis ACROSS the frame** — origin left, destination right,
matching the ribbon and rule 5's "vertical scroll in, horizontal journey out".
Then a coast beat can hold the departed world small at one edge, the destination
growing at the other, and the ship somewhere between them. That single frame
says *travelling* without any caption at all, and it is the frame the vertical
composition can never produce.

A three-quarter view beats a pure side view: fully side-on flattens depth, so
offset the camera 20–40° off the travel axis and keep some of it running into
the frame.

## Name-the-object test

Cover the caption and ask a stranger to name what they are looking at. If they
would say "some vertical bars" and the answer is "a launch tower", the geometry
is wrong — and no amount of lighting, scale or camera work will rescue it.
Real failures caught this way, all of which passed every numeric gate:

- **A launch complex that was vertical bars on a raised slab.** A tower is a
  deck, a lattice with cross-bracing, a crane arm, umbilicals swinging away.
- **Clouds as blobby white spheres** — a child's drawing of cloud. Cloud is a
  flattened, layered, soft-edged FIELD with structure at several scales, and it
  is one of the few things a point sprite cannot fake.
- **A staging flash that read as an explosion on the ground**, because it was
  drawn at the same screen position as the planet below it. An event needs to be
  separated from whatever it is passing in front of — against sky, against
  black, or offset — or the reader assigns it to the wrong object.

When an archetype cannot make the object nameable, that is a gap in the
archetype library (rule 2), not something to fix with a per-journey hack.

## A body that clips to white is a hole in the frame

A planet lit past the tone-mapper's ceiling loses every feature it had and also
exposes its own tessellation — a white polygon fan where a world should be.
`earth-to-moon`'s second-stage beats rendered Earth as a flat white shape with
visible facet edges. Check the bright side of any body at its brightest beat,
not just the terminator, and keep `segments` high enough that the silhouette is
a circle rather than a polygon.

## The frame is no longer the only thing you compose

Readers can **left-drag to turn the view**, ±40° yaw and ±22° pitch, returning
to the authored direction on release. That is a genuine change to the job:

- **Compose the flanks, not just the shot.** A beat that is one object floating
  in void survives review and falls apart the instant anyone turns. Run
  `frame-check --look=32`; it scores the worse of the two sides and flags
  `FLANK-EMPTY`. This immediately caught `big-bang`'s "Oceans" at 0.002 off-axis
  — turn 32° and the planet is simply gone.
- **The reward for getting it right is large.** Turning left during "Us" reveals
  the moon, which was always in the scene and never in the shot. A beat where
  the flanks hold content feels like a place; a beat where they do not feels
  like a diorama.
- **Do not widen the frame to fix a flank.** That costs the composition of the
  authored shot, which is the one every reader sees. Add world off to the sides
  instead — that is what the scatter and field archetypes are for.
- **`window.__look = {yaw, pitch}`** turns the view in deterministic mode, which
  is how you check a flank in a script or author a turn in an export.

## Composing a beat that reads

- **The subject must be visible at all.** Obvious, and still the most common
  defect: `earth-to-moon`'s mid-coast beat drew the ship at roughly two pixels
  and then aimed the camera at the planet instead, so the beat about the
  spacecraft contained no visible spacecraft. If a beat names a thing, that
  thing has to be findable in the frame without knowing where to look.
- **Three planes.** Near, mid, far. Almost every `big-bang` frame has a
  foreground silhouette or terrain edge, a mid-ground subject, and a sky or
  field behind it. Almost every failing frame has exactly one plane.
- **A scale reference.** Something whose size the reader already knows. Without
  one, a 2 px dot and a 200,000 km world are the same picture.
- **The subject fills its share of the frame.** State the intended pixel size in
  the design brief (`at a 3.0e7 m frame the Moon is ~110 px at 1440 wide`) and
  check it. "Visible" is not the bar; the copy promises a world, the frame owes
  a world.
- **A palette arc.** `big-bang` runs orange plasma → deep red → blue dark ages →
  white web → blue ocean → green land → amber savanna → night city. Adjacent
  eras differ in hue, not just in content.
- **Right of centre.** The panel owns the lower left; `PAN` pushes single
  subjects clear of it. Field beats stay centred.

## Workflow

1. **Design brief first** (`src/journeys/<id>/DESIGN.md`), before any code —
   axis segments with justified weights, and for every beat: heading, real
   quantity, and **what is on screen at the beat's MIDPOINT**. Beats are
   reviewed mid-beat; a layer that has arrived-and-left by then is a black
   frame with a caption. If you cannot write the midpoint sentence, the beat is
   not designed yet. Skipping this step is what produced the worst journey in
   the table above.
2. **Build**, then `vite build` — the dev server hides duplicate-identifier
   errors as a blank page with no console output.
3. `node scripts/smoke.mjs` — axis, seams, and the vh pacing floor.
4. `node scripts/frame-check.mjs <id> --look=32` — fix every EMPTY / FLAT /
   SAME / FLANK-EMPTY before looking at anything.
5. `node scripts/shots.mjs <id> <out> <port> --sheet`, then **read the contact
   sheet with the Read tool and look at it.** Ask specifically: could I tell
   these beats apart with the captions covered? Iterate; expect several rounds.
6. `node scripts/scroll-check.mjs <id>` and `node scripts/pages-check.mjs dist /journeys/`.

## Traps that have cost real time

- **A subject off the camera's boresight is invisible, not off-centre.** Cost
  two journeys the Sun and an entire approach sequence. A layer that must appear
  on the aim point should be positioned by the *same formula the camera aims
  with* — one number, not two that are meant to agree.
- **Anchor tables drift by the midpoint.** A per-beat table of camera/scale
  anchors is correct exactly at each mark and wrong 45% in, which is where
  review samples. Use a per-frame formula of `u`.
- **A close approach needs its own tight axis segment** sized to a few times the
  subject's radius, plus a *separately weighted* departure segment — the
  departure's weight is the whole control over where the midpoint lands. This is
  the K–Pg fireball pattern, and it is the general fix for "the copy promises a
  world and the frame shows a dot".
- **Additive blending cannot draw a hole**, and additive debris beside a bright
  glow is invisible. Dark, normal-blended material is what reads.
- **Lights read at any scale; geometry does not.** Sell a settlement with a warm
  point-field, never by inflating building sizes.
- **Camera height is in UNITS and units scale with the frame** — eye level is
  `y ≈ 0.1`, not 0.45. And keep `frame ≤ terrain radius / 6`.

## When a journey cannot be saved by tuning

If most beats fail on occupancy or contrast, the problem is the **subject
selection and the archetype plan**, not the numbers. Re-cut the beat list around
the moments that have something to look at, and cut the ones that do not — a
20-beat journey where every frame earns its place beats a 32-beat one that is
mostly cruise. Fewer, denser beats is almost always the fix.
