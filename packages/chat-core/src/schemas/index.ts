import { z } from 'zod';

// Generic chat attachment shape — represents a media attachment on a
// chat message after upload + moderation succeed. Used in
// SendChatMessage* wire schemas and in ChatMessage docs.
//
// This is a schema-only subpath: no React, no upload-ui, no browser
// code, no styles. Safe for backend / schema composition without
// pulling chat-core's UI dependency graph.

export const ReplyToSchema = z
  .object({
    messageId: z.string().min(1),
    senderId: z.string().min(1),
    messagePreview: z.string(),
  })
  .strict();

export type ReplyTo = z.infer<typeof ReplyToSchema>;

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
