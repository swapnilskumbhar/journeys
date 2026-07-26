// Named callout-set registry — the pattern every explainer with per-step
// label groups (exterior/internal/macro…) re-implemented identically before
// consolidation. Usage in model.js:
//
//   const labels = calloutSets(['exterior', 'internal', 'synchro']);
//   labels.add('exterior', knob, 'Shift lever', [0, 0.06, 0], 30, 60);
//   ...
//   return { ..., setLabels: labels.setLabels };
//
// setLabels(mode) shows exactly the named set and hides all others;
// setLabels(false) hides everything. Callouts may be parented to MOVING
// parts — the dot rides the part.
import { callout } from './labels.js';

export function calloutSets(names) {
  const sets = Object.fromEntries(names.map((n) => [n, []]));

  function add(set, parent, text, offset, dir, len) {
    if (!sets[set]) throw new Error(`calloutSets: unknown set "${set}"`);
    const c = callout(text, { dir, len });
    c.position.set(...offset);
    parent.add(c);
    c.visible = false;
    sets[set].push(c);
    return c;
  }

  function setLabels(mode) {
    for (const [k, arr] of Object.entries(sets)) {
      for (const c of arr) c.visible = k === mode;
    }
  }

  return { add, setLabels, sets };
}
