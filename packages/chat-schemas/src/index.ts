import { z } from 'zod';

/**
 * Pure-Zod chat schemas package.
 *
 * Consumed by `@ttt-productions/chat-core/schemas` (which re-exports for
 * backward compatibility) and by the consuming app's callable schema layer,
 * which composes these wire shapes into request / response schemas.
 *
 * Tier 0 — pure Zod, zero `@ttt-productions/*` deps. Safe for backend / schema
 * composition without pulling chat-core's UI dependency graph.
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
 * Chat attachment shape — represents a media attachment on a chat message
 * after upload + moderation succeed. Used in SendChatMessage* wire schemas
 * (composed in the consuming app's callable layer) and in ChatMessage docs
 * (consumed by chat-core UI).
 *
 * `storagePath: z.string().min(1)` — empty `storagePath` is always a bug
 * (it's the Firebase Storage path after upload); rejecting at the schema
 * layer is correct.
 */
export const ChatAttachmentSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    type: z.enum(['image', 'video', 'audio', 'text']),
    size: z.number(),
    url: z.string(),
    storagePath: z.string().min(1),
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
