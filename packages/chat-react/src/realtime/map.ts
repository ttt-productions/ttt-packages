// Map the DO wire row (`WireMessageRow`) into the UI `ChatMessageV1` shape so the
// UI stays transport-agnostic — the MessageList renders the same shape whether
// the bytes came from Firestore or the DO socket.
//
// Identity invariant: the DO stores uid references only (`senderUid`), never a
// display name — names resolve at render time through the ChatNameResolver
// context, identical to the Firestore path.

import type { ChatMessageV1 } from '@ttt-productions/chat-core';
import type { WireMessageRow } from './wire.js';

/** The DO `seq` is the stable per-channel message id (monotonic, epoch-spanning). */
export function seqToMessageId(seq: number): string {
  return String(seq);
}

interface WireReplyTo {
  messageSeq: number;
  preview: string;
}

interface WireAttachmentMeta {
  senderOnly?: boolean;
  mediaAssetId?: string;
  failureReason?: string;
  [k: string]: unknown;
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
 * - The DO row carries only the attachment LIFECYCLE (`attachmentState` +
 *   `attachmentMeta.mediaAssetId`), not the full `ChatAttachment` (id/name/size/
 *   storagePath). The full attachment-saga projection is the next chain's work
 *   (P5/P6); until then the placeholder lifecycle rides in `meta.attachment*` so
 *   the renderer can show the pending/ready/failed bubble without a stored URL —
 *   the render-time URL comes from `mediaAssetId` via the attachment-URL resolver
 *   context (identity/media invariant: no URLs are ever stored).
 */
export function wireRowToMessage(row: WireMessageRow, threadId: string): ChatMessageV1 {
  const reply = parseJson<WireReplyTo>(row.replyTo);
  const meta = parseJson<WireAttachmentMeta>(row.attachmentMeta);

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
      ...(row.attachmentState ? { attachmentState: row.attachmentState } : {}),
      ...(meta ? { attachmentMeta: meta } : {}),
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
