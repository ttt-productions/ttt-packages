import { CHAT_WIRE_VERSION } from '@ttt-productions/chat-schemas';
import type {
  ChatConversationRef,
  ChatMarkReadResultPayload,
  ChatMessageRevisionKind,
  ChatSendRejectedPayload,
} from '@ttt-productions/chat-schemas';

export type RevisionKind = ChatMessageRevisionKind;

export interface WireMessageRow {
  seq: number;
  senderUid: string;
  clientMessageId: string;
  text: string;
  createdAt: number;
  epoch: number;
  referencedUids?: string[];
  moderationKind?: RevisionKind | null;
  messageRevision?: number;
}

export interface WireChannelSnapshot {
  lastMessageSeq: number;
  readSeq?: number;
  resync?: boolean;
  delta?: WireMessageRow[];
}

export interface WireRegistryEntry {
  channelRef: string;
  kind: string;
  state: 'active' | 'tombstoned';
  registryVersion: number;
  ref?: ChatConversationRef | null;
  unread?: boolean;
  archived?: boolean;
}

export interface WireInboxSnapshot {
  registry: WireRegistryEntry[];
  hasUnread: boolean;
}

// Chat frames carry `type`, not realtime-core's `kind`: the deployed Worker emits and reads `type`.
export type ServerFrame =
  | { type: 'message'; payload: { message: WireMessageRow } }
  | { type: 'ack'; payload: { clientMessageId?: string; seq?: number; readSeq?: number } }
  | { type: 'history-page'; payload: { messages: WireMessageRow[] } }
  | { type: 'presence'; payload: { online: string[] } }
  | { type: 'typing'; payload: { uid: string; at: number } }
  | { type: 'snapshot'; payload: WireChannelSnapshot | WireInboxSnapshot }
  | { type: 'unread'; payload: WireInboxSnapshot | { hasUnread: boolean } }
  | { type: 'error'; payload: { code: string; retryAfterMs?: number } }
  | { type: 'mark-read-result'; payload: ChatMarkReadResultPayload }
  | { type: 'send-rejected'; payload: ChatSendRejectedPayload }
  | {
      type: 'revision';
      payload: { messageSeq: number; kind: RevisionKind; messageRevision: number };
    };

export function buildFrame(type: string, payload: Record<string, unknown>): string {
  return JSON.stringify({ v: CHAT_WIRE_VERSION, type, payload });
}

export function parseFrame(
  raw: string,
): { v?: number; type?: string; payload?: Record<string, unknown> } | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as { v?: number; type?: string; payload?: Record<string, unknown> };
  } catch {
    return null;
  }
}

// A snapshot frame arrives unchecked; it is a channel snapshot only when it names its last seq.
export function readChannelSnapshot(
  payload: Record<string, unknown>,
): WireChannelSnapshot | 'inbox' | null {
  if (Array.isArray(payload.registry)) return 'inbox';
  if (typeof payload.lastMessageSeq !== 'number') return null;
  return {
    lastMessageSeq: payload.lastMessageSeq,
    readSeq: typeof payload.readSeq === 'number' ? payload.readSeq : undefined,
    resync: typeof payload.resync === 'boolean' ? payload.resync : undefined,
    delta: Array.isArray(payload.delta) ? (payload.delta as WireMessageRow[]) : undefined,
  };
}

export function isInboxSnapshot(
  p: WireChannelSnapshot | WireInboxSnapshot,
): p is WireInboxSnapshot {
  return Array.isArray((p as WireInboxSnapshot).registry);
}
