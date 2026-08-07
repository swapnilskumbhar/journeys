// The procedural toolkit, ported wholesale from howitworks' src/framework.
// These modules are subject-agnostic (bevelled geometry, canvas-generated
// surface maps, CSS2D callouts, pose math) and carry no dependency on either
// project's player or stage — which is exactly why they travel.
//
// They are shared by COPY, not by package, until a second consumer proves the
// interface is stable. When it does, lift this directory into its own package
// and depend on it from both repos rather than letting the copies drift.
export * as geometry from './geometry.js';
export * as textures from './textures.js';
export * as parts from './parts.js';
export * from './labels.js';
export * from './label-layout.js';
export * from './motion.js';
export * from './callouts.js';
export * from './highlight.js';
export * from './ground-frame.js';
