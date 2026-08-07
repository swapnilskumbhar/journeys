// THE GROUND FRAME.
//
// Several journeys here put the world ORIGIN on the vehicle: `earth-to-moon`,
// `earth-to-mars` and `voyager` all do, because that is what makes 27 orders of
// magnitude fit in float32 (see engine/rebase.js). The consequence is easy to
// state and was twice missed anyway: **anything that stays on the planet has to
// be pushed DOWN by the distance travelled, every frame.**
//
// `earth-to-mars` and `earth-to-moon` both shipped with the launch complex
// omitting that term, so a field of buildings rode the rocket upward — the
// buildings kept a constant apparent size and position beside a vehicle that
// was supposedly leaving them behind. The terrain, tower and pad lights around
// them all carried `-distanceAt(u)` and were correct; the buildings simply had
// no way to say it, because `blocks` had no `offsetMeters` at all.
//
// This exists so the convention is written down ONCE, as a name, rather than
// re-derived at each of a dozen call sites — which is how one of them got
// forgotten. It is deliberately not a default inside any archetype: a block
// field, a rock field or a light field is not always on a planet, and a default
// that assumed so would be a second number that has to agree with the journey's
// own.
//
//   import { groundRelativeOffsetMeters } from '../../kit/ground-frame.js';
//   const onGround = groundRelativeOffsetMeters(dAt);
//
//   blocks({ …, offsetMeters: onGround() })          // at the ground datum
//   particleField({ …, offsetMeters: onGround(10) }) // 10 m above it
//   tower({ …, offsetMeters: onGround(0, -28, 12) }) // and 28 m west, 12 m south
//
// `distanceAt` is the journey's own u → distance-travelled function. `up` is
// metres above the ground datum; `east`/`south` are the in-plane displacement,
// which is left alone by the vertical correction.
export function groundRelativeOffsetMeters(distanceAt) {
  return (up = 0, east = 0, south = 0) => ({ u }) => [east, up - distanceAt(u), south];
}
