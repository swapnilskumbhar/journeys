---
name: journey-fix
description: Diagnose and repair a journey that ships but looks wrong. Runs a cost-capped gpt-5.6-terra critique over the rendered frames and the source, hands the findings to the journey-builder agent, and proves the fix with the gate and a diffed re-critique. Use when a journey passes its gate but a subject reads badly - a model that looks like the wrong object, a beat that is flat, a colour that is off.
---

# Fixing a journey that passes and still looks wrong

`journey-new` builds a journey from nothing. This repairs one that already
exists, already passes `journey-gate`, and is still not good enough.

That is a real and distinct situation, because **the gate cannot see it**.
`frame-check` measures occupancy, contrast and adjacent distance: it will tell
you a frame is not empty, not black and not a duplicate of its neighbour. It
cannot tell you the spacecraft looks like a table lamp. Voyager's craft scored
0.42 occupancy and passed every numeric bar in the repo while rendering as a
white bowl, a gold ball and a spike.

So the loop is: **a model with eyes finds it, an agent with tools fixes it, the
gate proves nothing else broke.**

## The two steps

### 1. The critic — `scripts/critique.mjs`

```bash
node scripts/critique.mjs <id> --beats=3,5,7,14 --focus="..." --brief
```

One bounded `gpt-5.6-terra` call. It sees the rendered frames **and** the source
that drew them, and returns schema'd findings: diagnosis, evidence, a concrete
fix naming the file and the symbol, and an `archetypeGap` flag.

**This is not the blind reviewer, and the difference is the point.**

| | sees | answers |
| --- | --- | --- |
| `review.mjs` | frames only — no captions, no source | *does the picture show what the copy claims?* |
| `critique.mjs` | frames + headings + source | *how do I make it better?* |

Blindness is what makes `review.mjs` trustworthy — you cannot un-see a caption.
But "how do I fix this" is **unanswerable** blind, because the fix nearly always
lives in a line of source the frame cannot show you. Voyager's finding was not
"the dish looks wrong", it was "`tower` is being used as a magnetometer boom and
`capsule` as a payload, so the silhouette is a lamp by construction" — visible
only by reading the frame against `layers.js`. Keep both tools. Merging them
would quietly forfeit the blindness guarantee.

### 2. The fixer — the `journey-builder` agent

`--brief` writes `review-shots/<id>-fix-brief.txt`, a self-contained instruction.
Hand it to `journey-builder`, which already exists for exactly this and has the
tools and the gate. **Reuse it; do not spawn a new agent type.**

Add to the brief the two things it cannot get from JSON:

- **Point at specific frames and say what you saw.** The brief conveys the
  finding; it does not convey how bad it looks. Name the files.
- **State what must NOT change.** The critique's `strengths` array is there for
  this. A rework that fixes the ship and breaks the Jupiter approach is a
  net loss.

Continue the same agent with `SendMessage` across rounds. A cold agent per round
re-derives the engine from `CLAUDE.md` and under-builds exactly the way the
original batch did — this repo has already paid for that lesson.

### 3. Prove it

```bash
node scripts/journey-gate.mjs <id> --sweep      # --sweep whenever archetypes changed
node scripts/critique.mjs <id> --diff           # did the findings actually go?
```

`--diff` is the honest question after a fix round. In prose, "fixed" and "not
mentioned this time" are indistinguishable; against a stable schema they are
different facts. Also watch `introduced` — a rework that trades one high finding
for two mediums has not helped.

## Cost

Every lever is a flag, and the estimate is **checked before the request is sent**
rather than reported after it.

| lever | effect |
| --- | --- |
| `--beats=3,5,7` | the big one. Frames dominate at ~1,700 tokens each. Critiquing the four beats you are unhappy with costs an eighth of critiquing thirty-two and answers the same question. |
| `--src=a.js,b.js` | defaults to the journey's `layers.js`. Add the archetype you suspect; these files run past 2,000 lines. |
| `--effort=low\|medium\|high` | high roughly doubles output tokens. Worth it for an archetype-design question, wasted on "is this beat too dark". |
| `--max-usd=N` | refuses to send. Not a receipt. |

Measured: voyager's ship critique was **$0.137** — 5 frames, 2 source files,
high effort, one call, one finding. That finding specified a complete new
archetype API.

`--via=agent` prints the same brief for a Claude agent instead and spends
nothing. Worth it for a second opinion on a journey you are about to ship,
since an agent can follow up on its own suspicion and Terra cannot.

## Reading a critique

**`archetypeGap: true` is the finding that matters most.** It means no parameter
change can help, because the subject cannot be expressed by anything that
exists. This repo's history is mostly this defect: `tower` because boxes cannot
make a structure, `strata` because a shell meant to be seen through cannot
enclose a camera, `rocks` because a flat marked panel is not a lump. Every one
was diagnosed as bad tuning first and cost a wasted round.

The tell, when you are judging it yourself: **cover the caption and ask a
stranger to name the object.** "Some vertical bars" or "a table lamp" is an
archetype gap. No amount of lighting or scale fixes it.

**A short high-severity list beats a long one.** Focus the critic with `--focus`
and it stays on the complaint. Ask it to review everything and you get twenty
observations with the real defect somewhere inside.

## When to stop and ask

Same rule as `journey-new`: **three rounds, then stop and ask the user.** Past
three, the problem is almost always beat SELECTION or a design decision, which
is not the builder's call. Voyager's own history is the proof — its first build
had 32 beats, ten of which were a caption over the same picture, and no amount
of restaging fixed them. Cutting them did.
