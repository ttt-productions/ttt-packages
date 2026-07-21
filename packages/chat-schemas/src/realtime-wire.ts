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
  /**
   * A CORRELATED send rejection: every valid `send` frame now receives either an
   * `ack` (accepted/duplicate) or a `send-rejected` naming the SAME
   * `clientMessageId`. Additive v1 frame kind — a client that predates it simply
   * ignores an unknown server frame type (forward-compat), so no version bump is
   * needed. The payload is {@link ChatSendRejectedPayloadSchema}. Distinct from the
   * generic `error` frame, which stays uncorrelated (no trustworthy id).
   */
  SEND_REJECTED: 'send-rejected',
} as const;

/** A server→client frame `type` value. */
export type ServerFrameKind = (typeof SERVER_KINDS)[keyof typeof SERVER_KINDS];

// ---- correlated send-rejection contract (SERVER_KINDS.SEND_REJECTED payload) ----

/**
 * The canonical, closed set of reasons a `send` frame can be rejected with a
 * correlated {@link SERVER_KINDS.SEND_REJECTED} frame. Ordered list so both the
 * validator (`z.enum`) and the retryability table below derive from ONE source.
 *
 * Generic protocol errors (`bad-envelope`, `bad-send`, `unknown-type`, …) are
 * deliberately NOT in this list: they stay uncorrelated `error` frames because no
 * trustworthy `clientMessageId` may have been parsed yet.
 */
export const CHAT_SEND_REJECTION_CODES = [
  'membership-pending',
  'archived',
  'deleted',
  'wordlist-unavailable',
  'blocked-word',
  'flood',
  'slow-mode',
] as const;

/** A correlated send-rejection reason code. */
export type ChatSendRejectionCode = (typeof CHAT_SEND_REJECTION_CODES)[number];

/**
 * Canonical retryability classification per code — the single source of truth for
 * whether re-sending the SAME message can ever succeed. The frame carries
 * `retryable` on the wire, but it MUST agree with this table (the schema below
 * enforces it), so a runtime cannot mis-declare a terminal code as retryable.
 *
 * - `membership-pending` — the DO member row has not synced; a resend after the
 *   bootstrap/projection lands succeeds. Retryable.
 * - `wordlist-unavailable` — fail-closed moderation dependency not yet loaded;
 *   retryable once it loads.
 * - `flood` / `slow-mode` — rate limited; retryable after `retryAfterMs`.
 * - `archived` / `deleted` — the channel is not writable; an unchanged resend
 *   cannot succeed. Terminal.
 * - `blocked-word` — the text itself is disallowed; re-sending it verbatim cannot
 *   succeed. Terminal.
 */
export const CHAT_SEND_REJECTION_RETRYABLE: Record<ChatSendRejectionCode, boolean> = {
  'membership-pending': true,
  'wordlist-unavailable': true,
  'flood': true,
  'slow-mode': true,
  'archived': false,
  'deleted': false,
  'blocked-word': false,
};

/**
 * The payload of a correlated {@link SERVER_KINDS.SEND_REJECTED} frame. The client
 * receives untrusted JSON, so this Zod schema is the parse boundary (the Worker
 * already validates inbound payloads with Zod; the contract owner keeps the code
 * list, type, and validator together).
 *
 * - `clientMessageId` — echoes the validated id of the rejected send (non-empty,
 *   bounded so a hostile/garbage frame can't correlate an unbounded string).
 * - `code` — one of {@link CHAT_SEND_REJECTION_CODES}.
 * - `retryable` — MUST equal {@link CHAT_SEND_REJECTION_RETRYABLE} for the code
 *   (refined below), so the client can trust it without re-deriving.
 * - `retryAfterMs` — optional server hint (flood/slow-mode preserve it); a positive
 *   integer, bounded. Absent means "use the client's default backoff".
 *
 * Unknown extra keys are stripped (default object mode), NOT rejected, so a future
 * additive field does not make an otherwise-valid rejection unparseable.
 */
export const ChatSendRejectedPayloadSchema = z
  .object({
    clientMessageId: z.string().min(1).max(200),
    code: z.enum(CHAT_SEND_REJECTION_CODES),
    retryable: z.boolean(),
    retryAfterMs: z.number().int().positive().max(600_000).optional(),
  })
  .refine((p) => p.retryable === CHAT_SEND_REJECTION_RETRYABLE[p.code], {
    message: 'retryable must match the canonical classification for the code',
    path: ['retryable'],
  });

/** The correlated send-rejection payload (see {@link ChatSendRejectedPayloadSchema}). */
export type ChatSendRejectedPayload = z.infer<typeof ChatSendRejectedPayloadSchema>;

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
