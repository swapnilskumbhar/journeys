---
name: journey-film
description: Turn a finished journey into a narrated, scored, captioned video end-to-end. Runs director → voice → score → render → measured gate → blind review → fix rounds, and reports back once. Use when asked to "make a video of X", "film the journey", "export a journey to video", or to rescue a film that film-gate says is broken.
---

# Filming a journey, end to end

The request is one line: *"make a video of `voyager`"*. Everything between that
and a finished film happens here, and the user hears back once.

Read **`journey-craft`** before starting. This file is the *process*; that one
is the *craft*, and a film inherits every compositional decision the journey
made.

## What this is, and what it is not

The pictures come from the journey itself, rendered frame by frame. **Nothing
is generated as video.** `player.js` reads `window.__u` and ignores scroll,
`stage.js` reads a virtual clock, and the camera is handed no clock at all — so
frame N is a pure function of N and a re-render tomorrow is byte-identical.
That is rule 8, and it was written years before anything cashed it in.

`gpt-5.6-terra` is the **director**, not a video model. Its job is to look at
the frames and write to what is actually there.

## Why the process looks like this

Four journeys were once built by four agents, all of which built clean, printed
`SMOKE PASS`, and were signed off with "screenshots looked at". One was the same
white sticker on black in 30 of its 32 beats. A film multiplies that failure by
its runtime: a bad still is a moment, a bad shot is fifteen seconds the viewer
cannot skip.

So the same two ideas carry this process, and dropping either reverts it:

1. **Done is a number.** `scripts/film-gate.mjs` exits 0, or the film is not
   done.
2. **The reviewer must not know what it is looking at.** Otherwise it reads the
   caption and hallucinates the picture.

And one idea the film adds:

3. **A shot has a duration, and a still does not.** A frame can be perfectly
   composed and completely frozen for the fifteen seconds it is on screen. No
   still check in this repo can see that. `motion` can.

## Phase 0 — check the journey is filmable (you, one command)

```bash
node scripts/journey-gate.mjs <id> --quick
```

A film cannot be better than the journey it is made of. If this fails, stop:
either fix the journey or hand it to `journey-builder`. Do not film it. The
pipeline's own preflight enforces this, and routing around it wastes twenty
minutes to produce something you will throw away.

## Phase 1 — the dry run (you, ~2 minutes)

```bash
node scripts/film.mjs <id> --dry-run
```

Zero paid API calls: stub narration at a measured speaking rate, a silent
score, 6 fps at 320×180. Every code path downstream still runs. Do this
whenever anything under `scripts/film/` has changed, and skip it otherwise.

## Phase 2 — the real film (the `journey-film` agent)

Spawn `journey-film` with the journey id and any editorial steer the user gave
(tone, length, what to emphasise). It runs:

```bash
node scripts/film.mjs <id>
```

which writes `src/journeys/<id>/film.js` — the editorial layer, **data, not
code**, committed beside the journey and hand-editable from then on.

**Keep the agent's id.** Every later round goes back to it with `SendMessage`,
never a fresh spawn. A cold agent re-derives the pipeline from `CLAUDE.md` and
re-makes the first pass's mistakes; this project has measured that cost before.

## Phase 3 — the blind review

Once the gate passes:

```bash
node scripts/review.mjs <id> --film
```

That captures the frames if needed and runs the review in **one bounded
gpt-5.6-terra call** — the default backend. It samples the **master** (silent,
no captions) every four seconds into `review-shots/<id>-film-blind/`, writes
the key to a sibling file OUTSIDE that directory, and returns schema'd findings
to `review-shots/<id>-film-review.json`.

Terra is the default here for three reasons, and only the first is money:

- **It is bounded.** A subagent review is an unbounded transcript — images
  enter its context, it reasons across many turns, and the bill scales with how
  long it thinks. One schema'd call is one request and one ledger line.
- **Blindness becomes ENFORCED rather than requested.** With a subagent you are
  trusting it not to open the key file sitting next to the frames. Here the
  request contains numbered images and nothing else. This repo's own rule is
  that restricting what the reviewer CAN know is the mechanism and asking it to
  be objective is not.
- **Findings become diffable.** "Did that go away, or did the reviewer just not
  mention it this time?" is unanswerable in prose and trivial against a stable
  schema. `--diff` answers it.

`--via=agent` prints the brief for `journey-blind-reviewer` instead and spends
nothing. Worth it for a second opinion from a different model on a film you are
about to publish, since an agent can follow up on its own suspicion. If you use
it, hand it **the directory path and nothing else** — not the script, not the
beat headings, not the key.

**Cost note.** The film review is the most expensive single call in this
pipeline after the score: frames dominate at ~1,700 tokens each, and a
four-second sample of a five-minute film is 72 of them — measured $0.50 on
voyager, against $0.19 for a 39-beat journey review. If you are iterating
rather than signing off, sample coarser.

Sampling every four seconds rather than once per shot is deliberate: a per-shot
sample shows only the instants the film was composed around, and would miss a
shot that goes dead in its second half — which is exactly the failure a film
has and a still does not.

Then compare, using the key: what did the reviewer name at second 47, and what
does the narration claim at second 47? A frame the reviewer cannot name, under
a line that names it confidently, is the defect.

## Phase 4 — fix rounds

Send findings back to the same agent. Almost everything is a `film.js` edit:

| Gate says | Usually means | Fix |
| --- | --- | --- |
| `STATIC` | the beat's picture does not change as u advances | `look: { from, to }` drift on that shot |
| `EMPTY` / `FLAT` | the beat itself is weak | cut the shot, or fix the journey |
| duck too small | score fighting the voice | lower `scoreGain`, or check the score is instrumental |
| words missing from captions | segment-mapping bug | a real pipeline bug — read `toVideoTime` |
| loudness off | mix problem | check `loudnorm` ran on the finished mix |

Re-run with `--from=render` for anything about the picture or camera,
`--from=assemble` for captions and mix. Both skip the expensive stages.

**`--from=render` will silently ignore an edited narration line.** Whether a
shot is wordless is decided by the absence of a timing entry — that is, by what
the VOICE actually said — so editing `film.js` and resuming from the render
keeps the old take. This cost a full nine-minute render that produced a
byte-identical timeline. Any narration change needs `--from=voice`. The solver
now throws rather than letting it pass quietly.

**Re-measure drift after any change to a persistent layer.** A near-foreground
object that turns with `u` adds parallax that was not there when the old drift
values were tuned. `voyager` went from six frozen shots to one that way — do not
copy the previous film's `look:` values forward.

### Read the narration as prose, not as a list of lines

The gate cannot hear a dangling reference. Two things to check by reading it
end to end:

- **Every pronoun and definite article needs an antecedent the audience has
  actually heard.** `voyager` shipped with the Golden Record as a WORDLESS shot
  — five seconds of silence on the most affecting object in the journey — and
  the very next line opened *"Beyond it, the record rides on…"*, referring to a
  record the film had never introduced.
- **A wordless shot belongs on a picture that needs no words**, not on the one
  carrying the most meaning. It is a real tool — it inserts true silence and
  cuts the single take around it — but the director will sometimes spend it on
  the wrong beat. Moving it to the strongest, most self-evident picture is
  usually the right trade.

Since a shot lasts exactly as long as its line takes to say, **a longer line is
literally a longer shot**. That is the only lever for giving a beat room, and it
is the right one.

**Three rounds, then stop and ask the user.** Past three the problem is
almost always beat SELECTION or the journey itself, and that is a design
decision that is not yours to make.

## Phase 5 — report once

Give the user:

- the path to `renders/<id>/final.mp4`, its runtime, and what it cost;
- the gate's numbers (occupancy, contrast, motion, loudness, duck);
- what the blind reviewer saw, and where it disagreed with the narration;
- anything you left broken, named specifically.

Never write "looks good" about a frame. Either the gate measured it or the
blind reviewer named it.
