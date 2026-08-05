---
name: journey-new
description: Build a complete new journey end-to-end from a one-line request, or rework an existing one that fails the gate. Runs design brief → builder agent → measured gate → blind review → fix rounds, and reports back once. Use when asked to "add a journey about X", "build a journey on Y", or to rescue a journey that frame-check says is broken.
---

# Adding a journey, end to end

The request is one line: *"add a journey about X"*. Everything between that and
a finished journey happens here, and the user hears back once.

Read the **`journey-craft`** skill before starting. This file is the *process*;
that one is the *craft*, and this process does not work without it.

## Why the process looks like this

Four journeys were once built by four agents in a batch. All four built clean,
printed `SMOKE PASS`, passed `scroll-check`, and were reported complete with
"screenshots looked at". One of them was the same white sticker on black in 30
of its 32 beats. They were rejected on sight and most of the work was thrown
away.

Nothing in that batch was dishonest. The agents ran everything they had been
given, and **nothing they had been given could see the defect**. So the process
below is built around two ideas, and if you drop either one it reverts to that
batch:

1. **Done is a number, not an opinion** — `scripts/journey-gate.mjs` exits 0, or
   the journey is not done.
2. **The reviewer must not know what it is looking at** — otherwise it reads the
   caption and hallucinates the picture.

## Phase 0 — settle the journey (you, ~5 minutes)

Pick, without asking the user unless something is genuinely ambiguous:

- **the id** — kebab-case, e.g. `crust-to-core`;
- **the axis** — the single monotonic quantity: time, distance, or scale. If
  the subject has no single monotonic axis, it is not a journey, it is a
  `howitworks` mechanism. Say so and stop;
- **the endpoints**, as real quantities in real units;
- **roughly how many beats** — 20–30. Resist more. A 20-beat journey where every
  frame earns its place beats a 32-beat one that is mostly cruise.

Check `src/journeys/*/meta.js` for the accent colours already in use and pick a
distinct one.

## Phase 1 — the design brief (you)

Write `src/journeys/<id>/DESIGN.md` **before any code**. Skipping this produced
the worst journey in the repo, so it is not delegated and not done afterwards.

It needs the axis segments with justified weights, and a **beat sheet table**:

| # | heading | midpoint | archetypes | px | hue |
| --- | --- | --- | --- | --- | --- |

- **midpoint** — what is on screen *45% into the beat*, which is where every
  review samples. If you cannot write this sentence, the beat is not designed.
- **px** — intended on-screen size of the subject at 1440 wide. "Visible" is not
  a bar; the copy promises a world, the frame owes a world.
- **hue** — so the palette arc is planned rather than discovered.

Then:

```bash
& "C:\Program Files\nodejs\node.exe" scripts/design-lint.mjs <id>
```

It will fail on the missing `beats.js` until the builder runs; that is fine.
What matters is that the sheet itself is complete.

**Sanity-check the beat list against the density law before handing it over.**
Budget 40–60 lines of layer code per beat. If the plan implies 32 beats and a
thin world, cut beats now — it is far cheaper here than after they are built.

## Phase 2 — build (the `journey-builder` agent)

Spawn `journey-builder` with: the journey id, the full design brief, the beat
count, and the ship bar. It reads the reference implementation and the archetype
library itself, and it loops on `journey-gate.mjs <id> --quick` until the
numbers pass.

**Keep the agent's id.** Every later round goes back to it with `SendMessage`,
never to a fresh spawn. A cold builder re-derives the engine from scratch and
under-builds — which is precisely how the original batch failed. Continuing the
same agent keeps its knowledge of the archetype APIs and its own brief.

## Phase 3 — the blind review (the `journey-blind-reviewer` agent)

Once the gate's numeric stages pass:

```bash
& "C:\Program Files\nodejs\node.exe" scripts/shots.mjs <id> --blind --sheet
```

This writes caption-free frames named `beat-01.png`… to
`review-shots/<id>-blind/`, and the index→heading key to
`review-shots/<id>-blind.key.json` — **outside** that directory, so the
directory can be handed over whole.

Spawn `journey-blind-reviewer` and give it **only the frames directory path**.
Do not include the topic, the headings, the brief, or anything you learned in
phase 1. If you mention the subject in the prompt, you have destroyed the only
check in the pipeline that cannot be fooled.

Then **diff its answers against your beat sheet's midpoint column.** Each of
these is a defect:

| what the reviewer said | what it means |
| --- | --- |
| `EMPTY` | the beat does not exist as a picture |
| `CANNOT TELL` | the copy is carrying the beat alone |
| a guess that contradicts the heading | the frame shows the wrong thing |
| a run of 3+ frames it could not tell apart | a stall — merge or restage them |
| "some vertical bars", "a white blob", a household object | name-the-object failure; likely an archetype gap |

The reviewer is right about what it saw. It may be wrong about what the thing
is — that *is* the defect.

## Phase 4 — fix rounds

Send the defect list back to the same builder via `SendMessage`. Be specific:
beat number, what the reviewer saw, what the brief said should be there.

**Cap it at three review rounds.** If the journey is still failing after three,
stop and report that, with the numbers. Do not keep grinding — past three rounds
the problem is almost always the *beat selection*, which is a phase-1 decision
and needs the user, not another round of tuning. `journey-craft` says it
plainly: if most beats fail on occupancy or contrast, re-cut the beat list.

## Phase 5 — land it

- Full gate, no `--quick`: `journey-gate.mjs <id>` — adds scroll-check and
  pages-check.
- Add `--sweep` **if any archetype or engine file changed**. A new journey that
  adds an archetype has changed all the others too.
- Check the journey appears on the index and its deep link resolves.
- Re-run `design-lint.mjs <id>` so the brief still matches what was built —
  briefs rot, and a brief that no longer describes the journey is worse than no
  brief because it is trusted.

## Reporting back

One report, at the end. It must contain:

- **the verdict** — gate passed, or gate failed and at which stage;
- **the numbers against the bar** — occupancy, contrast, adjacent, flagged %,
  each next to the threshold;
- **what the blind reviewer said**, especially anything it could not name;
- **the weak beats you know about**, even ones that cleared the gate — the gate
  is a floor, not a target;
- **any archetype gap** hit, and whether it was filled or worked around;
- **anything left undone**, and why.

Never report a journey complete on any evidence other than a green gate. If it
is not passing, say what is failing and what you would do next — that is a
useful report. A false "completed" is not, and it costs the user their trust in
every other line of it.
