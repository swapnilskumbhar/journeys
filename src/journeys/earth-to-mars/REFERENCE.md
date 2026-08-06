# earth-to-mars — hardware reference

Real-world reference for every piece of hardware this journey draws, gathered
2026-08-06. The purpose is the **name-the-object test**: cover the caption, show
a stranger the frame, and they should say "a rocket on a launch tower", "a
spacecraft cruising", "a capsule entering an atmosphere". Today they say "a
white tube", "a satellite", "a grey cylinder".

Nothing here asks for a specific real vehicle to be copied. This journey is a
composite — a heavy-lift stack and a Mars transfer vehicle that do not exist as
one flown article — so the reference is about **what makes each class of object
readable**, and the numbers are there to keep proportions honest.

---

## 1. The stack on the pad (beats 1–5)

### What is wrong now

`vehicle({ … })` in `layers.js` draws a single smooth tube: three coaxial
stages at r 0.050 / 0.050 / 0.072, a gold cone on top, one dish, two panels.

Three specific defects:

- **`fins` is declared and never implemented.** In `src/archetypes/vehicle.js`
  the string `fins` appears exactly once — line 137, the parameter. There is no
  fin-building code anywhere in the file. The comment above it correctly states
  that a launch vehicle without them "is a smooth tube, and the tube is most of
  why the stack read as a bollard rather than as a rocket." The diagnosis was
  written; the fix was not. Same trap as `voyager`'s booster.
- **There are no strap-on boosters, not even a parameter.** This is the single
  biggest silhouette defect. See below.
- **The payload is a gold cone.** `capsule: { r: 0.034, color: 0xc9a25e, cone: 1 }`
  renders as a party hat. A Mars stack's payload is inside a **fairing**, and a
  fairing is white/grey, blunter, and wider than the stage below it, not
  narrower.

### What actually makes a heavy launcher readable

**Almost no heavy-lift vehicle is one tube.** The silhouette-defining feature of
SLS, Delta IV Heavy, Falcon Heavy, Atlas V, Ariane 5 and Soyuz is that the
core is *flanked* — strap-on boosters running most of the first stage's length,
with their own nose cones, visibly separate from the core, tapering to their own
nozzles. A viewer identifies "big rocket" from that three-lobed base silhouette
long before any detail resolves.

SLS reference (the closest real analogue for a Mars-class stack):

| property | value |
| --- | --- |
| height, Block 1B crew | 111.6 m (366 ft) |
| core stage engines | **4 × RS-25**, clustered at the base |
| boosters | **2 × five-segment solid rocket boosters**, one either side |
| combined liftoff thrust | 8.8 million lbf |
| core stage colour | **orange** — sprayed foam insulation, not painted white |
| booster colour | white |

The orange core against white boosters is most of why an SLS is recognisable at
a glance. Our stack being uniformly white throws that away for free.

Concretely, what the pad stack needs:

- **2 strap-on boosters**, each ~0.75 of the core's first-stage length, radius
  ~0.55 of the core's, offset to either side, each with its own nose cone and
  its own nozzle, and each shedding at its own point on the axis (boosters
  separate long before first-stage cutoff — real SLS boosters go at ~2 min).
- **An engine cluster, not one nozzle.** Four bells at the core base, arranged
  in a square, each with a visible bell flare.
- **Fins or aft stabiliser fairings** at the base — implement the parameter that
  already exists.
- **A fairing, not a cone**: blunt ogive, white/grey, at least as wide as the
  stage beneath it, with a visible separation seam down its side.
- **Interstage rings** — the dark bands where stages meet. `bands: 6` currently
  paints even stripes along the whole body, which is not the same thing: real
  banding is concentrated at structural joins.

### The launch tower (beat 1, the black slab)

Currently:

```js
L('service-tower', 1, 900, () => blocks({ count: 1, heightMeters: [96, 104], … }))
```

**One box.** This is the exact defect `CLAUDE.md` records from `earth-to-moon`
("Boxes make a town; they cannot make a structure"), and it is why
`src/archetypes/tower.js` was written. That archetype already takes `bays`,
`braces: 'x'`, `deck`, `arms[]` and `cap` — it exists precisely for this and
this journey never adopted it. **Use `tower`. Delete the `blocks` call.**

Real reference — the SLS Mobile Launcher:

- a square lattice tower ~120 m tall, open steel framework, mostly holes;
- **umbilical arms** at several levels reaching from the tower to the vehicle,
  carrying power, coolant, fuel and gases — these swing away at launch;
- a **crew access arm** at the 270-foot level: a 67 ft × 10 ft × 18 ft truss
  with an enclosed "white room" box at its far end where it meets the hatch;
- a **lightning mast** on top;
- the vehicle stands *beside* the tower, not far from it — the arms visibly
  bridge the gap.

The arms are what stop a lattice reading as scaffolding. Three or four at
different heights, one of them ending in a box, and the silhouette is nameable.

---

## 2. The cruise stage (beats 7–20)

### What is wrong now

The blind reviewer, which never saw the copy, described these beats as
"glowing cylinders, panels, spheres" — never a spacecraft. The cruise object is
the same axial tube as the launch stack with the lower stages shed.

### Real reference — Mars cruise stages that have flown

The Mars 2020 / MER cruise stage is the correct reference for the *class*:

| property | value |
| --- | --- |
| shape | **a flat disc**, not a tube |
| diameter | 2.65 m (8.7 ft) |
| height with aeroshell | 1.6 m |
| structure | aluminium, outer ring of ribs |
| solar array | body-mounted on the disc face, in **five sections**, 2.65 m across |
| power | 600 W near Earth → **300 W at Mars** |
| stabilisation | spin-stabilised at 2 rpm |
| launch mass | 1,063 kg |

The important shape fact: **a real interplanetary cruise stage is a wide flat
disc with the aeroshell slung underneath**, not a long thin rocket. The solar
cells are on the disc itself. That is a completely different silhouette from
what we draw, and it is *more* legible at small size, not less — a disc reads at
fewer pixels than a tube does.

For a larger crewed-class transfer vehicle (NASA DRA 5.0), the readable features
are: a long truss spine, propellant tanks in a cluster, a habitat module of
much larger diameter than the spine, big deployed solar arrays or radiators on
booms, and engines at the far end from the habitat. Again: **not one tube** —
distinct modules of different diameters connected by a visible spine.

The 600 W → 300 W fact is worth drawing rather than captioning. This journey's
stated reason to exist is the shrinking, dimming Sun; the array visibly being
lit less hard is the same story told on the hardware.

---

## 3. Entry, descent, landing (beats 21–26)

These beats already score 0.52–0.84 occupancy and the blind reviewer named the
lander correctly. **Do not restage them.** Reference is recorded only so the
shapes stay honest if they are touched:

| component | value |
| --- | --- |
| aeroshell diameter | 4.5 m (~15 ft) |
| heat shield | shallow ~70° cone, **PICA tiles**, the wide blunt face |
| backshell | **bell-shaped / truncated cone**, contains the parachute |
| backshell material | aluminium honeycomb, graphite-epoxy, SLA-561V |
| descent stage | sky crane, lowers the rover on a bridle |

The blind review's one note here: the jettisoned heat shield reads as "a pale
bubble" because it is a `blob`. A heat shield is a **shallow rigid dish** — a
wide blunt cone, tumbling, catching light on its convex face. If `blob` cannot
do that, say so as an archetype gap rather than tuning it.

---

## 4. Priority

1. **Boosters + engine cluster + fairing** on the pad stack — biggest silhouette
   win, affects beats 1–5.
2. **`tower` instead of `blocks({count:1})`** — the black slab, beat 1.
3. **Implement `fins`, or delete the parameter.** A declared parameter that
   draws nothing is worse than an absent one; it makes a call site look correct.
4. **A real cruise-stage silhouette** — disc-and-aeroshell or spine-and-modules,
   not a tube with the bottom shed.
5. Orange core / white boosters colour split.

## Sources

- NASA, SLS fact sheets and Block 1B reference — nasa.gov
- NASA, Mobile Launcher umbilicals and crew access arm fact sheets — nasa.gov,
  lpi.usra.edu
- NASA/JPL, Mars 2020 launch press kit; MER cruise configuration —
  jpl.nasa.gov, science.nasa.gov
- NASA SP-2009-566, Human Exploration of Mars Design Reference Architecture 5.0
- Lockheed Martin, aeroshell overview
