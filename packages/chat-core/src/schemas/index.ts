/**
 * chat-core's schema-only subpath.
 *
 * Thin re-export of `@ttt-productions/chat-schemas`. Kept here for backward
 * compatibility with consumers importing from `@ttt-productions/chat-core/schemas`
 * and to satisfy the F21 subpath contract — the actual canonical Zod source
 * lives in the tier-0 `chat-schemas` package, where it can be consumed by both
 * chat-core (UI) and the consuming app's callable layer without forcing the
 * chat UI dependency graph on backend / schema callers.
 *
 * No React. No upload-ui. No browser code. No styles.
 */

export {
  ChatAttachmentSchema,
  ReplyToSchema,
  type ChatAttachment,
  type ReplyTo,
} from '@ttt-productions/chat-schemas';
