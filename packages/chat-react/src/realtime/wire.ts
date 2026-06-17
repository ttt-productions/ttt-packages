// Chat realtime WIRE PROTOCOL (Contract C) — the client side of the chat-worker
// Channel + Inbox Durable Object protocol. These shapes mirror the worker's
// `ttt-master-app/chat-worker/src` BYTE-FOR-BYTE so the DO and this client agree
// on the wire without sharing code (the worker stays ttt-core-free; this package
// stays generic — neither imports the other).
//
// Frame shape on the socket is `{ v, type, payload }` (NOT realtime-core's
// `{ v, kind, payload }`): the chat worker `send`/`broadcast` emit
// `JSON.stringify({ v: 1, type, payload })` and read `env.type` + `env.payload`.
// We keep that field name here to match; realtime-core's envelope schema is the
// generic transport primitive, the chat worker chose `type` for its DO frames.

/** The pinned WebSocket subprotocol tag offered alongside the grant token. */
export const CHAT_SUBPROTOCOL = 'ttt.chat.v1' as const;

/** Wire envelope protocol version (the worker emits and accepts `v: 1`). */
export const CHAT_WIRE_VERSION = 1 as const;

/** Client → DO message `type`s (chat-worker `CLIENT_KINDS`). */
export const CLIENT_FRAME = {
  SEND: 'send',
  READ_ACK: 'read-ack',
  HISTORY: 'history',
  TYPING: 'typing',
  PRESENCE_SUBSCRIBE: 'presence-subscribe',
  PRESENCE_UNSUBSCRIBE: 'presence-unsubscribe',
  HEARTBEAT: 'heartbeat',
  RESUME: 'resume',
} as const;

/** DO → client message `type`s (chat-worker `SERVER_KINDS`). */
export const SERVER_FRAME = {
  MESSAGE: 'message',
  ACK: 'ack',
  HISTORY_PAGE: 'history-page',
  PRESENCE: 'presence',
  TYPING: 'typing',
  UNREAD: 'unread',
  SNAPSHOT: 'snapshot',
  ERROR: 'error',
  REVISION: 'revision',
} as const;

/**
 * WebSocket close codes (Contract C). 4xxx are app codes; 1013 is the standard
 * "try again later". Mirrors chat-worker `CLOSE_CODES`.
 */
export const CHAT_CLOSE_CODES = {
  AUTH_EXPIRED: 4401,
  REVOKED: 4403,
  FLOOD: 4408,
  TOO_LARGE: 4413,
  SOCKET_CAP: 4429,
  OVERLOADED: 1013,
} as const;

export type ChatCloseCode = (typeof CHAT_CLOSE_CODES)[keyof typeof CHAT_CLOSE_CODES];

/** A logical chat channel — typed tuple (NEVER a path string). Mirrors the worker's ChannelRefTuple. */
export type ChannelRefTuple =
  | { scope: 'channel'; workProjectId: string; guildChatChannelId: string }
  | { scope: 'invite'; guildInviteId: string };

// ---- raw wire row shapes (what the DO serializes; opaque-but-typed here) ----

/**
 * A message row as the Channel DO stores + broadcasts it (chat-worker
 * `MessageRow`). `replyTo`/`attachmentMeta` arrive as JSON STRINGS (or null) —
 * the DO stores them stringified and does not re-parse before broadcast. The
 * adapter mapping in `map.ts` parses them into the UI `ChatMessageV1` shape.
 */
export interface WireMessageRow {
  seq: number;
  senderUid: string;
  clientMessageId: string;
  text: string;
  replyTo: string | null;
  attachmentState: string | null;
  attachmentMeta: string | null;
  createdAt: number;
  epoch: number;
}

/** The channel resume snapshot the DO returns for a `resume` frame. */
export interface WireChannelSnapshot {
  lastMessageSeq: number;
  readSeq: number;
}

/** A registry entry in the inbox snapshot (chat-worker `RegistryEntry`). */
export interface WireRegistryEntry {
  channelRef: string;
  kind: string;
  state: 'active' | 'tombstoned';
  registryVersion: number;
  /**
   * The typed channel-ref tuple — the OPENABLE identity for the Chats view (the
   * `channelRef` is an opaque DO-id dedup key). Null/absent on legacy or pre-tuple
   * rows; the consumer falls back to hiding the open action for those entries.
   */
  ref?: ChannelRefTuple | null;
}

/** The inbox snapshot payload pushed on connect / `resume` / live delta. */
export interface WireInboxSnapshot {
  registry: WireRegistryEntry[];
  hasUnread: boolean;
}

// ---- server → client frame payloads (discriminated on `type`) ----

export type ServerFrame =
  | { type: 'message'; payload: { message: WireMessageRow } }
  | { type: 'ack'; payload: { clientMessageId?: string; seq?: number; readSeq?: number } }
  | { type: 'history-page'; payload: { messages: WireMessageRow[] } }
  | { type: 'presence'; payload: { online: string[] } }
  | { type: 'typing'; payload: { uid: string; at: number } }
  | { type: 'snapshot'; payload: WireChannelSnapshot | WireInboxSnapshot }
  | { type: 'error'; payload: { code: string; retryAfterMs?: number } }
  | { type: 'revision'; payload: Record<string, unknown> };

/** Build an outbound `{ v, type, payload }` frame (the wire format the DO reads). */
export function buildFrame(type: string, payload: Record<string, unknown>): string {
  return JSON.stringify({ v: CHAT_WIRE_VERSION, type, payload });
}

/** Parse an inbound frame, tolerating malformed JSON. Returns null on garbage. */
export function parseFrame(raw: string): { v?: number; type?: string; payload?: Record<string, unknown> } | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as { v?: number; type?: string; payload?: Record<string, unknown> };
  } catch {
    return null;
  }
}

/** A snapshot with `registry` is an inbox snapshot; one with `lastMessageSeq` is a channel snapshot. */
export function isInboxSnapshot(p: WireChannelSnapshot | WireInboxSnapshot): p is WireInboxSnapshot {
  return Array.isArray((p as WireInboxSnapshot).registry);
}
