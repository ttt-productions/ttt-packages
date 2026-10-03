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
  /**
   * The auto-response to a client {@link CLIENT_KINDS.HEARTBEAT}. It is answered by
   * the DO RUNTIME's hibernation auto-response pair — the Durable Object itself is
   * never woken — and the runtime records a per-socket auto-response timestamp that
   * the liveness sweep reads. Client-side the heartbeat is therefore
   * FIRE-AND-FORGET: the ack carries no payload, drives no client state, and the
   * next heartbeat tick is already scheduled, so a client handles it as an explicit
   * no-op (and, being the one frame that recurs forever at the heartbeat cadence,
   * must not be logged per-arrival). Declared here so no runtime restates the
   * literal and so it is never mistaken for an unknown frame type.
   */
  HEARTBEAT_ACK: 'heartbeat-ack',
  /**
   * The inbox runtime's answer to one `mark-read` frame, naming the same `requestId`
   * (payload {@link ChatMarkReadResultPayloadSchema}). Every mark-read whose `requestId`
   * parses gets exactly one result, so the client settles the action on its own
   * outcome rather than on a later snapshot or a timer.
   */
  MARK_READ_RESULT: 'mark-read-result',
} as const;

/** A server→client frame `type` value. */
export type ServerFrameKind = (typeof SERVER_KINDS)[keyof typeof SERVER_KINDS];

// ---- the send frame's bounds ----

/**
 * The longest message text a `send` may carry, in UTF-16 code units — the unit both a
 * zod `.max()` and a textarea `maxLength` count — so the composer, the Worker's send
 * check, and an app-side send schema accept exactly the same texts.
 */
export const CHAT_MESSAGE_TEXT_MAX_LENGTH = 4000;

/** The longest `clientMessageId` a send, and every frame correlated to it, may carry. */
export const CHAT_CLIENT_MESSAGE_ID_MAX_LENGTH = 200;

/**
 * A send's idempotency id. The Worker parses it before judging the text, so an
 * over-bound text is answered with a `too-long` rejection that names it.
 */
export const ChatClientMessageIdSchema = z.string().min(1).max(CHAT_CLIENT_MESSAGE_ID_MAX_LENGTH);

// ---- server-written messages ----

/**
 * The sender id of a message the server writes (an invite's agreement line, a system notice).
 * A member's own send is always attributed to its verified account, so a row carries this sender
 * only when the server wrote it — the one fact that makes a row a system message.
 */
export const CHAT_SYSTEM_SENDER_ID = 'system' as const;

/** The longest account id a message may reference. */
export const CHAT_ACCOUNT_ID_MAX_LENGTH = 128;

/** The most account ids one server-written message may reference. */
export const CHAT_MESSAGE_REFERENCED_UIDS_MAX = 4;

/**
 * The account ids a server-written message's text refers to (who agreed, who is being added).
 * They are stored beside the text, never inside it, so the room's account anonymization rewrites
 * them exactly as it rewrites a sender, and the app renders each one's current name.
 */
export const ChatReferencedUidsSchema = z
  .array(z.string().min(1).max(CHAT_ACCOUNT_ID_MAX_LENGTH))
  .max(CHAT_MESSAGE_REFERENCED_UIDS_MAX);

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
  'too-long',
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
 * - `too-long` — the text is longer than {@link CHAT_MESSAGE_TEXT_MAX_LENGTH}; the same
 *   text can never be accepted. Terminal.
 */
export const CHAT_SEND_REJECTION_RETRYABLE: Record<ChatSendRejectionCode, boolean> = {
  'membership-pending': true,
  'wordlist-unavailable': true,
  'flood': true,
  'slow-mode': true,
  'archived': false,
  'deleted': false,
  'blocked-word': false,
  'too-long': false,
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
    clientMessageId: ChatClientMessageIdSchema,
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

// ---- the neutral conversation reference ----

/** The longest conversation `kind`. */
export const CHAT_CONVERSATION_KIND_MAX_LENGTH = 32;

/** The longest conversation `id`. */
export const CHAT_CONVERSATION_ID_MAX_LENGTH = 4096;

/**
 * A conversation as the chat runtimes know it: an app-chosen `kind` and an id unique
 * within that kind. The chat packages and the Worker never interpret either — the
 * consuming app maps its own conversations onto this and decides who may take part
 * (ARCH-201); the grant carries that decision.
 *
 * `kind` is a short identifier (a lowercase letter, then letters and digits), so it can
 * never hold a separator. `id` is opaque: it may contain `/` or `:` when the app composes
 * it from several ids, and it holds no control characters.
 */
export type ChatConversationRef = { kind: string; id: string };

export const ChatConversationRefSchema: z.ZodType<ChatConversationRef> = z
  .object({
    kind: z
      .string()
      .max(CHAT_CONVERSATION_KIND_MAX_LENGTH)
      .regex(/^[a-z][A-Za-z0-9]*$/),
    id: z
      .string()
      .min(1)
      .max(CHAT_CONVERSATION_ID_MAX_LENGTH)
      .refine((id) => !hasControlCharacter(id), { message: 'id must not contain control characters' }),
  })
  .strict();

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * The socket grant's `scope` claim. A `channel` grant names one conversation; an
 * `inbox` grant names the uid whose inbox it opens. Cloud Functions signs it after the
 * app's authorization check, and the Worker parses it with {@link ChatGrantScopeSchema}
 * after verifying the signature, before it accepts the socket.
 */
export type ChatGrantScope =
  | { kind: 'channel'; channelRef: ChatConversationRef }
  | { kind: 'inbox'; uid: string };

/** Runtime validator for {@link ChatGrantScope}. */
export const ChatGrantScopeSchema: z.ZodType<ChatGrantScope> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('channel'), channelRef: ChatConversationRefSchema }).strict(),
  z.object({ kind: z.literal('inbox'), uid: z.string().min(1) }).strict(),
]);

/** The grant token `aud` claim — scopes the token to chat. */
export const CHAT_GRANT_AUDIENCE = 'ttt-chat' as const;

/**
 * The whole chat grant payload — the one definition of what Cloud Functions signs and what the
 * Worker accepts after verifying the signature (ARCH-005). The signer types its claims with it;
 * the verifier parses the verified payload with it, then checks `env` against its own
 * environment and `iat` / `exp` against its clock. `exp` is after `iat`.
 */
export const ChatGrantClaimsSchema = z
  .object({
    v: z.literal(1),
    typ: z.literal('grant'),
    aud: z.literal(CHAT_GRANT_AUDIENCE),
    env: z.string().min(1),
    uid: z.string().min(1),
    scope: ChatGrantScopeSchema,
    iat: z.number().int().nonnegative(),
    exp: z.number().int().positive(),
  })
  .strict()
  .refine((claims) => claims.exp > claims.iat, { message: 'exp must be after iat', path: ['exp'] });
export type ChatGrantClaims = z.infer<typeof ChatGrantClaimsSchema>;

/** The replacement text shown for a hidden/deleted message (the ORIGINAL never renders). */
export const MODERATION_REDACTED_TEXT = '[message removed]' as const;

/** Client heartbeat cadence (ms) — the interval the client pings the socket. */
export const HEARTBEAT_MS = 20_000;

/** Typing coalescing minimum interval (ms) — the client throttles typing signals to this. */
export const TYPING_COALESCE_MS = 2_000;

/** History page cap — the max messages returned per history page. */
export const HISTORY_PAGE_MAX = 50;

// ---- inbox mark-read (CLIENT_KINDS.MARK_READ answered by SERVER_KINDS.MARK_READ_RESULT) ----

/** The longest inbox `channelRef` — the registry's own opaque key for one entry. */
export const CHAT_INBOX_CHANNEL_REF_MAX_LENGTH = 200;

/** The longest client-minted id that correlates a command with its result frame. */
export const CHAT_REQUEST_ID_MAX_LENGTH = 200;

/** A client-minted id that correlates one command with its result frame. */
export const ChatRequestIdSchema = z.string().min(1).max(CHAT_REQUEST_ID_MAX_LENGTH);

/** The `mark-read` payload: the registry key of the entry to clear, and the id its result names. */
export const ChatMarkReadPayloadSchema = z.object({
  channelRef: z.string().min(1).max(CHAT_INBOX_CHANNEL_REF_MAX_LENGTH),
  requestId: ChatRequestIdSchema,
});
export type ChatMarkReadPayload = z.infer<typeof ChatMarkReadPayloadSchema>;

/**
 * Why a mark-read did not clear: `bad-mark-read` — the entry is not an active entry of
 * this inbox; `mark-read-failed` — the conversation's read cursor could not be advanced.
 */
export const CHAT_MARK_READ_FAILURE_CODES = ['bad-mark-read', 'mark-read-failed'] as const;
export type ChatMarkReadFailureCode = (typeof CHAT_MARK_READ_FAILURE_CODES)[number];

/** The payload of a {@link SERVER_KINDS.MARK_READ_RESULT} frame. */
export const ChatMarkReadResultPayloadSchema = z.discriminatedUnion('ok', [
  z.object({ requestId: ChatRequestIdSchema, ok: z.literal(true) }),
  z.object({ requestId: ChatRequestIdSchema, ok: z.literal(false), code: z.enum(CHAT_MARK_READ_FAILURE_CODES) }),
]);
export type ChatMarkReadResultPayload = z.infer<typeof ChatMarkReadResultPayloadSchema>;
