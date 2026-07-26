import { makeAxis, clamp01 } from './axis.js';
import { FRAME_UNITS } from './rebase.js';

// A journey is data. That is the whole architectural bet: at 100+ journeys,
// hand-written Three.js per topic does not scale, so content declares WHAT
// happens along the axis and the engine + the archetype library decide how it
// is drawn. When a journey needs new rendering code, the right fix is almost
// always a new reusable archetype, not a bespoke module for that journey.
//
//   defineJourney({
//     id, title, summary, accent,
//     axis:    { kind: 'log', from: 0, to: 27, unit: 'm' },
//     length:  14,              // scroll length, in viewport heights
//     scaleAt: (u, axis) => …,  // metres per world unit (defaulted below)
//     camera:  (u, cam, ctx) => …,
//     beats:   [ { at | u, heading, body, hint? } ],
//     layers:  [ { id, from, to, build } ],
//   })

export function defineJourney(def) {
  const axis = makeAxis(def.axis);

  // Beats may be placed by real-world quantity (`at: 1.5e11` metres) or by
  // normalized position (`u: 0.42`). Real quantities are strongly preferred —
  // they stay correct if the axis range is later widened.
  const beats = (def.beats ?? [])
    .map((b, i) => {
      const u = b.u ?? (b.at !== undefined ? axis.toURaw(b.at) : null);
      if (u === null) throw new Error(`beat ${i} (${b.heading}) has neither \`at\` nor \`u\``);
      if (u < -1e-6 || u > 1 + 1e-6) {
        console.warn(`[${def.id}] beat "${b.heading}" sits at u=${u.toFixed(3)}, outside the axis range`);
      }
      return { ...b, u: clamp01(u), index: i };
    })
    .sort((a, b) => a.u - b.u);

  const layers = (def.layers ?? []).map((l, i) => ({
    ...l,
    id: l.id ?? `layer-${i}`,
    from: l.from ?? 0,
    to: l.to ?? 1,
  }));

  // Default scale law: whatever quantity the axis reads at u is framed to fill
  // a few world units. On a log axis this makes travel feel like a constant
  // rate of zoom, which is exactly the powers-of-ten sensation these journeys
  // are for. Override for journeys whose axis is time, not size.
  const scaleAt = def.scaleAt ?? ((u) => axis.toValue(u) / FRAME_UNITS);

  return { ...def, axis, beats, layers, scaleAt, length: def.length ?? Math.max(8, beats.length * 1.5) };
}

// --- registry ------------------------------------------------------------
// Same shape as howitworks: meta.js is eager (the index grid needs every card
// on first paint), index.js is lazy (one chunk per journey). Never static-import
// a journey from shared code — that collapses the split and every visitor pays
// to download every journey.

const metaModules = import.meta.glob('../journeys/*/meta.js', { eager: true });
const indexModules = import.meta.glob('../journeys/*/index.js');

const idOf = (path) => path.split('/').at(-2);

export const journeyMetas = Object.entries(metaModules)
  .map(([path, mod]) => ({ id: idOf(path), ...(mod.default ?? mod) }))
  .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

export async function loadJourney(id) {
  const entry = Object.entries(indexModules).find(([path]) => idOf(path) === id);
  if (!entry) return null;
  const mod = await entry[1]();
  return mod.default ?? null;
}
