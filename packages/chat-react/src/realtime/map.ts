// Map the DO wire row (`WireMessageRow`) into the UI `ChatMessageV1` shape so the
// UI stays transport-agnostic — the MessageList renders the same shape whether
// the bytes came from Firestore or the DO socket.
//
// Identity invariant: the DO stores uid references only (`senderUid`), never a
// display name — names resolve at render time through the ChatNameResolver
// context, identical to the Firestore path.

import type { ChatMessageV1 } from '@ttt-productions/chat-core';
import { MODERATION_REDACTED_TEXT } from '@ttt-productions/chat-schemas';
import type { RevisionKind, WireMessageRow } from './wire.js';

// The redacted-text constant lives in the wire contract; re-export to keep this
// module's public surface stable.
export { MODERATION_REDACTED_TEXT };

/** The effective moderation overlay for a message: the max-`messageRevision` kind. */
export interface ModerationOverlay {
  kind: RevisionKind;
  messageRevision: number;
}

/**
 * Apply a moderation overlay to a mapped message so the ORIGINAL content never
 * renders for a hidden/deleted message. Pure — returns a new message; the input
 * is not mutated. The overlay state rides on `meta` (`meta` is opaque to
 * chat-core), so the renderer can branch on `meta.moderated` / `meta.moderationKind`.
 * - `delete` / `moderate` → blank/replace the text + mark moderated.
 * - `edit` → the row already carries the overlaid text (the DO rewrites `text`),
 *   so only the marker is stamped.
 * - `restore` → original content (the DO row is the original); no redaction.
 */
export function applyModerationOverlay(message: ChatMessageV1, overlay: ModerationOverlay | null): ChatMessageV1 {
  if (!overlay) return message;
  const redacted = overlay.kind === 'delete' || overlay.kind === 'moderate';
  return {
    ...message,
    ...(redacted ? { text: MODERATION_REDACTED_TEXT } : {}),
    meta: {
      ...message.meta,
      moderationKind: overlay.kind,
      messageRevision: overlay.messageRevision,
      // `restore` is the absence of active moderation — it reverts to the original.
      moderated: overlay.kind !== 'restore',
    },
  };
}

/** The overlay carried inline on a DO row (the getHistory/getDeltaSince merge), or null. */
export function overlayFromRow(row: WireMessageRow): ModerationOverlay | null {
  if (row.moderationKind == null) return null;
  return { kind: row.moderationKind, messageRevision: row.messageRevision ?? 0 };
}

/** The DO `seq` is the stable per-channel message id (monotonic, epoch-spanning). */
export function seqToMessageId(seq: number): string {
  return String(seq);
}

interface WireReplyTo {
  messageSeq: number;
  preview: string;
}

function parseJson<T>(raw: string | null): T | null {
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Convert a DO message row to the UI message. `threadId` is the caller's logical
 * thread id (the UI's thread key); the DO row carries no threadId of its own.
 * - `messageId` = the server seq (string) — stable + dedup key.
 * - `replyTo` JSON `{ messageSeq, preview }` → UI `{ messageId, senderId:'', messagePreview }`.
 *
 * A DO row carries TEXT only. Files are not part of the message timeline — they
 * live in the conversation's Conversation Files list, published through the
 * canonical media pipeline and read from Firestore, never mapped from a chat row.
 */
export function wireRowToMessage(row: WireMessageRow, threadId: string): ChatMessageV1 {
  const reply = parseJson<WireReplyTo>(row.replyTo);

  return {
    messageId: seqToMessageId(row.seq),
    threadId,
    createdAt: row.createdAt,
    senderId: row.senderUid,
    text: row.text,
    replyTo: reply
      ? { messageId: seqToMessageId(reply.messageSeq), senderId: '', messagePreview: reply.preview }
      : undefined,
    isSystemMessage: row.senderUid === 'system' || undefined,
    meta: {
      seq: row.seq,
      epoch: row.epoch,
    },
  };
}

/** The optimistic local echo a `send` produces before the server `ack` reconciles the seq. */
export function optimisticMessage(args: {
  clientMessageId: string;
  threadId: string;
  senderId: string;
  text: string;
  createdAt: number;
  replyTo?: { messageId: string; messagePreview?: string } | null;
}): ChatMessageV1 {
  return {
    messageId: `optimistic:${args.clientMessageId}`,
    threadId: args.threadId,
    createdAt: args.createdAt,
    senderId: args.senderId,
    text: args.text,
    replyTo: args.replyTo
      ? { messageId: args.replyTo.messageId, senderId: '', messagePreview: args.replyTo.messagePreview ?? '' }
      : undefined,
    meta: { clientMessageId: args.clientMessageId, optimistic: true },
  };
}
