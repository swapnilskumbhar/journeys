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

| journey | occupancy | contrast | adjacent | flagged | ship bar |
| --- | --- | --- | --- | --- | --- |
| `big-bang` — the one that works | **0.522** | **0.149** | **13.9** | 5/39 (13%) | **pass** |
| `earth-to-moon` (after rework) | 0.451 | 0.134 | 8.9 | 4/25 (16%) | fail — flagged |
| `earth-to-mars` | 0.372 | 0.134 | 8.3 | 13/28 (46%) | fail |
| `crust-to-core` | 0.066 | 0.044 | 11.0 | 19/27 (70%) | fail |
| `voyager` | 0.032 | 0.050 | 0.6 | 30/32 (94%) | fail — all four |

Aim for `big-bang`'s column. `--gate=ship` applies the journey-level bar —
**occupancy ≥ 0.25, contrast ≥ 0.06, adjacent ≥ 6.0, flagged ≤ 15%** — which is
what `scripts/journey-gate.mjs` enforces. Note that `earth-to-moon` misses it by
a single beat, and that is correct: its lunar-orbit stall is a real, known
defect.

The gate is a floor, not a target — a frame can clear every threshold and still
be dull. **Failing one is near-proof it is broken; passing all three is not
proof it is good.** Run it, then still look at the contact sheet.

`clip` is a fifth number, reported but rarely fired: the fraction of the picture
flattened to near-white, which is what a body lit past the tone mapper's ceiling
does — it loses every feature it had and exposes its own tessellation. Across
all 151 shipping beats the maximum is 0.018, so anything approaching the 0.06
gate is a regression, not a bright subject.

This is the same move the vh pacing gate made: a defect you can only describe in
adjectives ("too fast", "looks samey") stays unfixed until it is measured in the
unit the reader experiences.

## The density law

Before any composition advice, the finding that predicts journey quality better
than anything else here — **lines of `layers.js` per beat**:

| journey | layers/beat | occupancy |
| --- | --- | --- |
| `big-bang` | **56** | 0.522 |
| `earth-to-moon` | 36 | 0.451 |
| `earth-to-mars` | 20 | 0.372 |
| `voyager` | 13 | 0.032 |
| `crust-to-core` | 12 | 0.066 |

The four journeys built by agents were not failures of taste. **They under-built
the world by four to five times and then declared victory.** `voyager` declares
32 beats on top of 403 lines of layer code, which is about one archetype per
beat — that is the "one object floating in void" failure mode arrived at by
construction, before a single compositional decision was made.

So this is a *budget*, not just a diagnostic. A beat needs three planes (near,
mid, far). One archetype cannot be three planes. Expect **40–60 lines of layer
declaration per beat**; `scripts/design-lint.mjs` fails under 25, which is not a
quality target but the line under which a journey has demonstrably not been
built at all.

If you find yourself with a thin `layers.js` and a long beat list, the answer is
**fewer beats, each properly built** — never more captions over the same world.

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
- **A deep-space probe that read as a TABLE LAMP** — a smooth white bowl, a gold
  ball, a tapered base and one spike. It was `vehicle`, an axial launch-stack
  generator, with `capsule` standing in for the payload and `tower` for the
  magnetometer boom. Everything in that list stacks on one line, so the lamp was
  produced by construction. It scored 0.42 occupancy and passed every numeric
  bar in the repo. What fixed it was `instrumentedProbe`: a real paraboloid with
  a thick rim, a feed horn on a strut tripod, and booms leaving the bus in three
  different directions. **The struts and the asymmetry are the read** — they
  break the silhouette into something a stranger can name.

When an archetype cannot make the object nameable, that is a gap in the
archetype library (rule 2), not something to fix with a per-journey hack.

## The protagonist has to be on screen

If the journey is *about* something that travels — a spacecraft, a vehicle, a
diver — that thing belongs in every beat, not only in the beats that stage it.

`voyager` shipped with a spacecraft in **5 of its 22 beats**. Every appearance
was its own windowed layer, so the craft blinked in and out and the gaps between
windows were most of the journey. Worse, the five appearances were at five
different sizes in four different corners, so even where it was present there
was nothing for a reader to track from one beat to the next. The result reads as
a slideshow of scenery that happens to be in the right order.

One continuous presence — same corner, same size, every beat — fixes both. Three
things stop it reading as a sticker pasted on the frame:

- **A true distance in front of the lens**, so it parallaxes against everything
  it passes rather than sitting flat on top.
- **The same light vector as every other object**, so it dims and warms with the
  journey instead of staying lit from nowhere.
- **An attitude that is a slow function of `u`**, so it turns across the piece
  and is never twice at the same angle. Pure function of `u` — rule 8 intact.

It measurably RAISES occupancy, because a turning object reveals more of itself.

**A fixed world offset will not hold a fixed screen position** if the camera's
bearing changes across the journey. Derive the position from the same basis the
camera is aimed with — one formula, not two that have to agree.

**A mute is a promise that something better is taking over.** When a beat stages
the subject deliberately, the persistent layer should stand down — but check
what it is standing down FOR. Two of `voyager`'s "hero" shots drew the craft at
25 and 40 px while suppressing a 140 px escort. That is trading a legible
subject for an invisible one.

## Things that move together must be derived together

Two objects that have just come apart are **one event**. Staging them as two
independent placements — each posed well, each in its own spot — reads as two
stickers, because nothing says they were ever attached or that they share a
velocity.

Give them one centroid, one shared direction, and one gap that **starts at zero**
and grows. Coincident at the start is what "still attached" means. And let the
discarded half tumble: a spent stage holding a rigid attitude reads as a second
working craft flying in formation.

The same applies to a **path and the thing travelling along it**. If the line is
drawn from its own formula in world space while the subject is placed by some
other rule, the two have no reason to meet and they will not — the trajectory
crosses empty frame while the craft flies beside it. Make one of them derive
from the other.

## Leaving somewhere means it gets smaller

A beat called "Leaving X" has to show X shrinking. Three separate mechanisms
each broke this in `voyager`, and any of them is enough on its own:

- **The layer's MOUNT RANGE.** `L('earth', 1.0, 1.02)` unmounted the planet at
  three million kilometres regardless of opacity. When something vanishes and
  its opacity envelope looks right, check the range first.
- **A frame-width visibility gate**, where the frame law moves sharply. A
  `frames(lo, hi)` gate is only open in the slice of the axis where the frame
  sits between them — and a table running 5.2e12 → 1.5e7 → 1.0e11 crosses that
  slice twice, so the subject pops in and pops out.
- **Holding the frame across the beat.** Holding is right when the subject is at
  the origin. For a body receding *behind* you, the frame must WIDEN faster than
  you recede, or it barely changes size.

And check whether the axis quantity is an **altitude** or a **centre distance**
before you place a body at it. `voyager` printed "km from Earth" and placed
Earth's centre at that number — off by one planetary radius, which put the
camera inside the planet for the opening beats. A sphere with front-face culling
seen from inside draws nothing at all, which looked exactly like a missing
layer.

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

## The blind review

The one rule at the top of this file is unenforceable by good intentions. You
cannot un-see a heading: read "Io's volcanoes", look at a black frame with a
dot in it, and your brain supplies the volcano. Four journeys shipped broken
with that rule already written down, reviewed by someone who had genuinely
looked at every screenshot.

So the captions come off:

```bash
node scripts/shots.mjs <id> --blind --sheet
```

Hides the copy panel, ribbon, hero and back-link, and — just as important —
names the files `beat-01.png`, not `09-io-s-volcanoes.png`. The index→heading
key is written *outside* the frames directory, so the whole directory can be
handed to a reviewer with nothing in it that says what the frames are meant to
be. The contact-sheet captions drop the axis readout too, since "9.58 AU" tells
a reviewer exactly what they are looking at.

**A blind review is only worth anything if the reviewer has not read the
brief.** The reviewer names what it sees; the orchestrator diffs that against
the midpoint sentences. Where they disagree, the frame is wrong — not the
reviewer.

```bash
node scripts/review.mjs <id> [--film] [--via=terra|agent] [--diff]
```

Default is one bounded `gpt-5.6-terra` call. Prefer it over the
`journey-blind-reviewer` subagent for two reasons beyond cost: the bill is
knowable in advance, and **blindness stops being a request and becomes a
guarantee** — with a subagent you are trusting it not to open the key file
sitting beside the frames, whereas an API request simply does not contain one.
Restricting what the reviewer CAN know is the mechanism; asking it to be
objective is not. `--via=agent` prints the brief for the subagent when you want
a second opinion from a different model.

### The blind review answers one question. There is a second one.

| | sees | answers |
| --- | --- | --- |
| `review.mjs` | frames only | *does the picture show what the copy claims?* |
| `critique.mjs` | frames **+ headings + source** | *how do I make it better?* |

Keep both. Blindness is what makes the first trustworthy — but "how do I fix
this" is **unanswerable** blind, because the fix nearly always lives in a line
of source no frame can show you. `voyager`'s real finding was not "the dish
looks wrong"; it was "`tower` is being used as a magnetometer boom and `capsule`
as a payload, so the silhouette is a lamp by construction" — visible only by
reading the frame against `layers.js`. A single merged tool that sometimes sees
the source would quietly forfeit the blindness guarantee for nothing.

## Workflow

1. **Design brief first** (`src/journeys/<id>/DESIGN.md`), before any code —
   axis segments with justified weights, plus a **beat sheet table** with one
   row per beat and these columns:

   | # | heading | midpoint | archetypes | px | hue |
   | --- | --- | --- | --- | --- | --- |

   `midpoint` is **what is on screen 45% into the beat**, which is where every
   review samples; a layer that has arrived-and-left by then is a black frame
   with a caption. `px` is the intended on-screen size of the subject at 1440
   wide — "visible" is not a bar. If you cannot write the midpoint sentence, the
   beat is not designed yet. Skipping this step produced the worst journey in
   the table above.

   `node scripts/design-lint.mjs <id>` checks the sheet is complete, that its
   headings still match `beats.js` in order, and that the density budget holds.
2. **Build**, then `vite build` — the dev server hides duplicate-identifier
   errors as a blank page with no console output.
3. `node scripts/journey-gate.mjs <id> --quick` — build, smoke and
   `frame-check --look=32 --gate=ship` in one command. Loop here: it is the
   cheap cycle, roughly two minutes, and it names the beat and the metric for
   every failure. Fix every EMPTY / FLAT / SAME / FLANK-EMPTY / CLIPPED.
4. **The blind review**, above. Iterate; expect several rounds.
5. `node scripts/journey-gate.mjs <id>` — the full gate, adding scroll-check and
   pages-check. Add `--sweep` if you touched anything in `src/archetypes` or
   `src/engine`, because that is a change to all five journeys at once: a PBR
   material change made for one journey silently cost `voyager` a third of its
   occupancy, and it was found days later by accident.

**A journey is complete when `journey-gate.mjs` exits 0 and the blind review
agrees with the brief — at no other time, and on no other evidence, including
your own reading of the screenshots.** If a defect exists that the gate cannot
see, the fix is a new check in the gate, not a judgement call at the end of a
long context.

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
