/**
 * The chat realtime wire contract (subprotocol, frame-kind maps, close codes,
 * channel-ref tuple + schema, grant scope/audience, and the client-agreed
 * limits) — the single owner consumed by the chat React client, the chat
 * Cloudflare Worker, and Cloud Functions.
 */
export * from './realtime-wire.js';

/**
 * Pure-Zod chat schemas package.
 *
 * Consumed directly as `@ttt-productions/chat-schemas` — by `chat-core` (the
 * pure parser/contracts package), by the consuming app's callable schema layer
 * which composes these wire shapes into request / response schemas, and by any
 * backend that needs the chat wire contracts. There is no `chat-core/schemas`
 * subpath: chat-core re-exports nothing under a `./schemas` path.
 *
 * Tier 0 — pure Zod, zero `@ttt-productions/*` deps. Safe for backend / schema
 * composition without pulling in any React or Firebase dependency graph.
 */

// Chat is TEXT-ONLY. There is deliberately no attachment shape here: a file is
// associated with a CONVERSATION (the Conversation Files list owned by
// `@ttt-productions/ttt-core`), never embedded in, sequenced with, or mutated
// through a chat message. A chat message schema that accepts an `attachment`
// field is a regression — see the contract test in `__tests__/schemas.test.ts`.
//
// There is likewise no REPLY-TO shape. No chat surface has an authoring
// affordance for replying to a specific message — chat-react's `MessageActions`
// renders only Report/Delete and the composer's `onSend` takes text alone — so a
// reply pointer could never be populated by a user action. `ReplyToSchema`,
// `ReplyTo`, and `MAX_CHAT_REPLY_PREVIEW_LENGTH` were removed rather than left as
// unreachable schema surface (DJ ruling 2026-07-29). A re-introduced reply export
// is a regression — see the same contract test.
