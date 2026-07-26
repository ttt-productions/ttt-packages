import { z } from 'zod';

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

/**
 * Pointer to the message being replied to. Schema-only — chat-core's UI layer
 * uses the inferred `ReplyTo` type to render reply previews on a chat message.
 *
 * `messageId` is `z.string().min(1)` (the wire shape).
 */

/**
 * Maximum length of the reply-to preview snippet carried on the wire. The one
 * bound for the concept — the chat-worker protocol derives its limit from this
 * constant rather than restating it.
 */
export const MAX_CHAT_REPLY_PREVIEW_LENGTH = 200;

export const ReplyToSchema = z
  .object({
    messageId: z.string().min(1),
    senderId: z.string().min(1),
    messagePreview: z.string().max(MAX_CHAT_REPLY_PREVIEW_LENGTH),
  })
  .strict();

export type ReplyTo = z.infer<typeof ReplyToSchema>;

// Chat is TEXT-ONLY. There is deliberately no attachment shape here: a file is
// associated with a CONVERSATION (the Conversation Files list owned by
// `@ttt-productions/ttt-core`), never embedded in, sequenced with, or mutated
// through a chat message. A chat message schema that accepts an `attachment`
// field is a regression — see the contract test in `__tests__/schemas.test.ts`.
