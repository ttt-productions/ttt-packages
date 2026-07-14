import { z } from 'zod';

/**
 * Chat realtime WIRE CONTRACT — the single canonical declaration of the chat
 * socket protocol shared by every runtime that speaks it:
 *   - the chat React client (the transport in `@ttt-productions/chat-react`),
 *   - the chat Cloudflare Worker / Durable Objects (connection + message wire),
 *   - Cloud Functions (the grant signer that mints the socket's auth token).
 *
 * These values were historically hand-duplicated across those runtimes with
 * "keep in lockstep" comments; they now live here once so there is one owner.
 * Each consuming runtime imports (never re-declares) these constants and types.
 *
 * The frame envelope on the socket is `{ v, type, payload }`:
 *   - `v` is {@link CHAT_WIRE_VERSION},
 *   - `type` is a value from {@link CLIENT_KINDS} (client→server) or
 *     {@link SERVER_KINDS} (server→client),
 *   - `payload` is the per-`type` body.
 *
 * Tier 0 — pure Zod/TS, zero `@ttt-productions/*` deps. Safe for the browser
 * client, the Worker runtime, and backend/schema composition alike.
 */

/** The pinned WebSocket subprotocol tag offered alongside the grant token. */
export const CHAT_SUBPROTOCOL = 'ttt.chat.v1' as const;

/** Wire envelope protocol version — every runtime emits and accepts `v: 1`. */
export const CHAT_WIRE_VERSION = 1 as const;

/** Client → server message `type`s (the discriminant on an outbound frame). */
export const CLIENT_KINDS = {
  SEND: 'send',
  READ_ACK: 'read-ack',
  HISTORY: 'history',
  TYPING: 'typing',
  PRESENCE_SUBSCRIBE: 'presence-subscribe',
  PRESENCE_UNSUBSCRIBE: 'presence-unsubscribe',
  HEARTBEAT: 'heartbeat',
  RESUME: 'resume',
  /** INBOX-socket-only: clear a channel's unread without opening it. The inbox
   *  runtime validates the ref against the caller's registry, advances the read
   *  cursor to tail on the channel runtime, then pushes a fresh authoritative
   *  snapshot. */
  MARK_READ: 'mark-read',
} as const;

/** A client→server frame `type` value. */
export type ClientFrameKind = (typeof CLIENT_KINDS)[keyof typeof CLIENT_KINDS];

/** Server → client message `type`s (the discriminant on an inbound frame). */
export const SERVER_KINDS = {
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

/** A server→client frame `type` value. */
export type ServerFrameKind = (typeof SERVER_KINDS)[keyof typeof SERVER_KINDS];

/**
 * WebSocket close codes. 4xxx are application codes; 1013 is the standard
 * "try again later".
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

/** A logical chat channel — a typed tuple, NEVER a path string. */
export type ChannelRefTuple =
  | { scope: 'channel'; workProjectId: string; guildChatChannelId: string }
  | { scope: 'invite'; guildInviteId: string };

/** Runtime validator for {@link ChannelRefTuple} (the two-variant union). */
export const ChannelRefTupleSchema: z.ZodType<ChannelRefTuple> = z.union([
  z.object({ scope: z.literal('channel'), workProjectId: z.string(), guildChatChannelId: z.string() }),
  z.object({ scope: z.literal('invite'), guildInviteId: z.string() }),
]);

/**
 * The socket grant's `scope` claim. A `channel` grant carries the channel ref
 * (guild channel OR invite); an `inbox` grant carries the uid. The grant is
 * signed by Cloud Functions after the real authorization check and verified by
 * the Worker before the socket is accepted.
 */
export type ChatGrantScope =
  | { kind: 'channel'; channelRef: ChannelRefTuple }
  | { kind: 'inbox'; uid: string };

/** The grant token `aud` claim — scopes the token to chat. */
export const CHAT_GRANT_AUDIENCE = 'ttt-chat' as const;

/** The replacement text shown for a hidden/deleted message (the ORIGINAL never renders). */
export const MODERATION_REDACTED_TEXT = '[message removed]' as const;

/** Client heartbeat cadence (ms) — the interval the client pings the socket. */
export const HEARTBEAT_MS = 20_000;

/** Typing coalescing minimum interval (ms) — the client throttles typing signals to this. */
export const TYPING_COALESCE_MS = 2_000;

/** History page cap — the max messages returned per history page. */
export const HISTORY_PAGE_MAX = 50;
