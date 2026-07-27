// The archetype library.
//
// Rule 2 lives here: a journey composes these with parameters, it does not
// write its own Three.js. When a journey needs something none of these can do,
// the fix is a NEW archetype general enough for the next journey to reuse —
// never a bespoke module for one topic. Ten archetypes cover the Big Bang end
// to end; they should cover most of what follows.
export { particleField } from './particle-field.js';
export { glowSphere } from './glow-sphere.js';
export { filaments } from './filaments.js';
export { planet } from './planet.js';
export { terrain } from './terrain.js';
export { blocks } from './blocks.js';
export { backdrop } from './backdrop.js';
export { silhouette } from './silhouette.js';
export { water } from './water.js';
export { blob } from './blob.js';
export { pointsMaterial, rng, gaussian } from './points-material.js';
