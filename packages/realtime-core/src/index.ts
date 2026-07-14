// @ttt-productions/realtime-core — runtime-neutral GENERIC realtime primitives.
// Zero product specifics: the chat realtime layer (and any future realtime consumer)
// supplies its own domain types, secrets, collections, and storage runtime.

export * from './protocol.js';
export * from './envelopes.js';
export * from './reconnect.js';
export * from './apply.js';
export * from './allocators.js';
export * from './sqlite-shapes.js';
export * from './persistence.js';
