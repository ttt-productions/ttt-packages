import type { ChatMessageV1 } from '@ttt-productions/chat-core';
import { CHAT_SYSTEM_SENDER_ID, MODERATION_REDACTED_TEXT } from '@ttt-productions/chat-schemas';
import type { RevisionKind, WireMessageRow } from './wire.js';

export interface ModerationOverlay {
  kind: RevisionKind;
  messageRevision: number;
}

export function applyModerationOverlay(
  message: ChatMessageV1,
  overlay: ModerationOverlay | null,
): ChatMessageV1 {
  if (!overlay) return message;
  const redacted = overlay.kind === 'delete' || overlay.kind === 'moderate';
  return {
    ...message,
    ...(redacted ? { text: MODERATION_REDACTED_TEXT } : {}),
    meta: {
      ...message.meta,
      moderationKind: overlay.kind,
      messageRevision: overlay.messageRevision,
      moderated: overlay.kind !== 'restore',
    },
  };
}

export function overlayFromRow(row: WireMessageRow): ModerationOverlay | null {
  if (row.moderationKind == null) return null;
  return { kind: row.moderationKind, messageRevision: row.messageRevision ?? 0 };
}

export function seqToMessageId(seq: number): string {
  return String(seq);
}

export function wireRowToMessage(row: WireMessageRow, threadId: string): ChatMessageV1 {
  return {
    messageId: seqToMessageId(row.seq),
    threadId,
    createdAt: row.createdAt,
    senderId: row.senderUid,
    text: row.text,
    isSystemMessage: row.senderUid === CHAT_SYSTEM_SENDER_ID || undefined,
    ...(row.referencedUids && row.referencedUids.length > 0
      ? { referencedUids: [...row.referencedUids] }
      : {}),
    meta: {
      seq: row.seq,
      epoch: row.epoch,
    },
  };
}

export function optimisticMessage(args: {
  clientMessageId: string;
  threadId: string;
  senderId: string;
  text: string;
  createdAt: number;
}): ChatMessageV1 {
  return {
    messageId: `optimistic:${args.clientMessageId}`,
    threadId: args.threadId,
    createdAt: args.createdAt,
    senderId: args.senderId,
    text: args.text,
    meta: { clientMessageId: args.clientMessageId, optimistic: true },
  };
}
