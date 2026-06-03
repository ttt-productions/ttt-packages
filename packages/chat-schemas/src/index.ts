import { z } from 'zod';

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
export const ReplyToSchema = z
  .object({
    messageId: z.string().min(1),
    senderId: z.string().min(1),
    messagePreview: z.string(),
  })
  .strict();

export type ReplyTo = z.infer<typeof ReplyToSchema>;

/**
 * Chat attachment shape on a chat message. With the in-flight placeholder flow,
 * an attachment progresses `pending` -> `ready` | `failed`:
 *  - `pending` — placeholder written on send; bytes uploaded, processing/moderation
 *    in flight. No `url` yet. Visible only to the sender (rule-enforced).
 *  - `ready` (or absent, for legacy/text) — processed + moderation-passed; `url` set.
 *  - `failed` — processing/moderation rejected; no `url`, `failureReason` set; sender-only.
 * Used in SendChatMessage* wire schemas (app callable layer) and ChatMessage docs.
 *
 * `storagePath: z.string().min(1)` — empty `storagePath` is always a bug (it's the
 * Firebase Storage staging/final path); rejecting at the schema layer is correct.
 * `url` is optional because a pending/failed attachment has none yet.
 */
export const ChatAttachmentSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    type: z.enum(['image', 'video', 'audio', 'text']),
    size: z.number(),
    url: z.string().optional(),
    storagePath: z.string().min(1),
    status: z.enum(['pending', 'ready', 'failed']).optional(),
    failureReason: z.string().max(500).optional(),
  })
  .strict();

export type ChatAttachment = z.infer<typeof ChatAttachmentSchema>;

/**
 * Age threshold after which a stale chat-attachment row becomes eligible for
 * cleanup (1 hour). Lives in chat-schemas (Tier 0, server-safe) so Cloud
 * Functions can import it without pulling chat-core's UI/upload dep graph.
 *
 * Consumer apps that need a different retention policy can override at the
 * call site rather than re-exporting.
 */
export const CHAT_ATTACHMENT_STALE_AGE_MS = 60 * 60 * 1000;
