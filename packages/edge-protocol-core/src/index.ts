// @ttt-productions/edge-protocol-core — generic, runtime-neutral primitives for
// signed internal backend ↔ Worker/Durable-Object calls. WebCrypto + zod only,
// so the SAME code runs in Cloud Functions (Node 22) and Cloudflare Workers/DOs.
// Deliberately NOT chat- or media-shaped: it holds the SHARED mechanisms
// (internal HMAC signing, canonical payload hashing, the versioned-apply rule,
// the structured-error + protocol-version envelopes) that both the media serving
// authority and the chat realtime layer build on. Each consumer supplies its
// own secret + audience; this package never names a domain.

export * from './payload-hash.js';
export * from './internal-auth.js';
export * from './versioned-apply.js';
export * from './envelopes.js';
