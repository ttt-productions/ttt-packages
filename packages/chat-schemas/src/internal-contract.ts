// The chat internal-endpoint contract: the signed calls between Cloud Functions and the chat Worker
// (sync apply, outbox append, word-list publish, moderation, context reads, history anonymization,
// and a room's parked-delivery report and its replay).
import { z } from 'zod';
import {
  CHAT_CONVERSATION_ID_MAX_LENGTH,
  CHAT_CONVERSATION_KIND_MAX_LENGTH,
  CHAT_GRANT_AUDIENCE,
  CHAT_MESSAGE_TEXT_MAX_LENGTH,
  ChatReferencedUidsSchema,
} from './realtime-wire.js';

/**
 * The largest body, in bytes, a chat internal endpoint accepts. The chat Worker reads every
 * internal request through edge-protocol-core's bounded reader with this budget before it verifies
 * the signature (ARCH-005), and the Functions signer refuses to send a larger body, so both sides
 * hold one number.
 */
export const CHAT_INTERNAL_BODY_MAX_BYTES = 262_144;

// ---- who a signed internal call is for ----

/**
 * The two directions of a signed chat internal call: `to-room` — the server's calls to the chat
 * Worker's rooms; `to-server` — a room's report to the server.
 */
export const CHAT_INTERNAL_CALL_DIRECTIONS = ['to-room', 'to-server'] as const;
export type ChatInternalCallDirection = (typeof CHAT_INTERNAL_CALL_DIRECTIONS)[number];

/**
 * The audience a signed chat internal call is signed and verified with, one per direction and
 * environment. Both directions share one secret, so a distinct audience is what keeps a signature
 * made for one direction from verifying in the other. Throws a `RangeError` for an empty `env`.
 */
export function chatInternalAudience(direction: ChatInternalCallDirection, env: string): string {
  if (env.length === 0) throw new RangeError('a chat internal audience needs an environment');
  return `${CHAT_GRANT_AUDIENCE}:${direction}:${env}`;
}

// ---- a server-written message ----

/**
 * The message part of a server-originated outbox command (the Cloud Functions → room append): the
 * sender (`CHAT_SYSTEM_SENDER_ID` for a system line, or the member a server-sent message is from),
 * the text, and the account ids the text refers to. The room stores `referencedUids` on the row
 * beside `senderUid`, returns it with the row, and rewrites it on an account's anonymization.
 */
export const ChatServerMessagePayloadSchema = z
  .object({
    senderId: z.string().min(1),
    text: z.string().max(CHAT_MESSAGE_TEXT_MAX_LENGTH),
    referencedUids: ChatReferencedUidsSchema.optional(),
  })
  .strict();
export type ChatServerMessagePayload = z.infer<typeof ChatServerMessagePayloadSchema>;

// ---- a room's parked deliveries ----
//
// A chat room (a channel or inbox Durable Object) keeps its own delivery outbox. A delivery that
// exhausts its retries, or that its receiver answers with a version conflict, is parked in the
// room. Rooms cannot be listed, so the room reports each parked delivery to the server through a
// signed call; the server records it where operators review parked work, and an operator's replay
// asks the room to put the delivery back on its outbox.

/** The kinds of chat room that keep a delivery outbox. */
export const CHAT_ROOM_KINDS = ['channel', 'inbox'] as const;
export type ChatRoomKind = (typeof CHAT_ROOM_KINDS)[number];

/**
 * Room for what a room's address puts around a conversation's kind and id (its product,
 * environment, room kind, and separators); `buildChatRoomAddress` refuses a namespace that does not
 * fit it.
 */
export const CHAT_ROOM_TARGET_PREFIX_MAX_LENGTH = 64;

/**
 * The longest room target string — the Worker's own internal-call address of a room. Derived from
 * the conversation reference's own bounds, so every valid conversation's room can be reported.
 */
export const CHAT_ROOM_TARGET_MAX_LENGTH =
  CHAT_ROOM_TARGET_PREFIX_MAX_LENGTH + CHAT_CONVERSATION_KIND_MAX_LENGTH + CHAT_CONVERSATION_ID_MAX_LENGTH;

/** The longest parked outbox row id. */
export const CHAT_OUTBOX_EVENT_ID_MAX_LENGTH = 200;

/** The longest delivery kind name. */
export const CHAT_DELIVERY_KIND_MAX_LENGTH = 64;

/** The longest error text a room reports for a parked delivery. */
export const CHAT_PARKED_DELIVERY_ERROR_MAX_LENGTH = 500;

const roomTargetSchema = z.string().min(1).max(CHAT_ROOM_TARGET_MAX_LENGTH);
const outboxEventIdSchema = z.string().min(1).max(CHAT_OUTBOX_EVENT_ID_MAX_LENGTH);

/**
 * The body a room sends when it parks a delivery. `targetDo` is the address the Worker's internal
 * routing accepts for that room, so the server can reach the same room again for a replay;
 * `eventId` is the parked outbox row; `parkedAt` (epoch ms) is when the room parked it, which with
 * the room and row names one parking of one row.
 */
export const ChatParkedDeliveryReportSchema = z
  .object({
    targetDo: roomTargetSchema,
    roomKind: z.enum(CHAT_ROOM_KINDS),
    eventId: outboxEventIdSchema,
    deliveryKind: z.string().min(1).max(CHAT_DELIVERY_KIND_MAX_LENGTH),
    roomAttemptCount: z.number().int().nonnegative(),
    roomLastError: z.string().max(CHAT_PARKED_DELIVERY_ERROR_MAX_LENGTH).nullable(),
    parkedAt: z.number().int().nonnegative(),
  })
  .strict();
export type ChatParkedDeliveryReport = z.infer<typeof ChatParkedDeliveryReportSchema>;

/**
 * The operation id a report's signature binds: its own `eventId`. The receiver refuses a report whose
 * body names another, so a signature covers one parked row.
 */
export function chatParkedDeliveryReportOperationId(report: Pick<ChatParkedDeliveryReport, 'eventId'>): string {
  return report.eventId;
}

/**
 * The body type a report is sent as. The receiving platform buffers a body of this type as raw bytes
 * and parses none of it, so nothing reads the report before its signature is verified (ARCH-005).
 * The bytes are the JSON of the report.
 */
export const CHAT_PARKED_DELIVERY_REPORT_CONTENT_TYPE = 'application/octet-stream';

/**
 * The largest parked-delivery report body, in bytes. The receiving endpoint reads the body through
 * edge-protocol-core's bounded reader with this budget before it verifies the signature (ARCH-005).
 */
export const CHAT_PARKED_DELIVERY_REPORT_MAX_BODY_BYTES = 16_384;

/** The server's request to a room to put one parked delivery back on its outbox. */
export const ChatParkedDeliveryReplayRequestSchema = z
  .object({
    targetDo: roomTargetSchema,
    eventId: outboxEventIdSchema,
  })
  .strict();
export type ChatParkedDeliveryReplayRequest = z.infer<typeof ChatParkedDeliveryReplayRequestSchema>;

/**
 * The room's answer to a replay: `requeued` — the delivery is pending again with a fresh retry
 * budget; `not-parked` — the room holds no parked delivery by that id (already replayed, delivered,
 * or gone), so a repeated replay is a no-op.
 */
export const CHAT_PARKED_DELIVERY_REPLAY_OUTCOMES = ['requeued', 'not-parked'] as const;
export const ChatParkedDeliveryReplayResultSchema = z
  .object({ outcome: z.enum(CHAT_PARKED_DELIVERY_REPLAY_OUTCOMES) })
  .strict();
export type ChatParkedDeliveryReplayResult = z.infer<typeof ChatParkedDeliveryReplayResultSchema>;

// ---- the server's internal call bodies to a room ----
//
// Each body is parsed after its signature is verified (ARCH-005); the server builds the same shape.

/** The longest operation id a body names: a sync event id or an outbox command id. */
export const CHAT_INTERNAL_OPERATION_ID_MAX_LENGTH = 200;

/** The longest digest a body carries: a payload hash or a word-list hash. */
export const CHAT_DIGEST_MAX_LENGTH = 128;

const operationIdSchema = z.string().min(1).max(CHAT_INTERNAL_OPERATION_ID_MAX_LENGTH);
const digestSchema = z.string().min(1).max(CHAT_DIGEST_MAX_LENGTH);

/**
 * The authoritative facts the server syncs to a room: a member's authorization for a conversation,
 * an account's access, and a conversation's configuration.
 */
export const CHAT_SYNC_APPLY_KINDS = ['channelAuth', 'accountAccess', 'config'] as const;
export type ChatSyncApplyKind = (typeof CHAT_SYNC_APPLY_KINDS)[number];

/**
 * One versioned sync event, applied to the room `targetDo` names. `eventId` is the signed operation
 * id; the room decides apply / idempotent / conflict / stale from `version` and `payloadHash`.
 * `payload` is the kind's fact as a JSON object.
 */
export const ChatSyncApplyRequestSchema = z
  .object({
    eventId: operationIdSchema,
    targetDo: roomTargetSchema,
    kind: z.enum(CHAT_SYNC_APPLY_KINDS),
    version: z.number().int().nonnegative(),
    payload: z.record(z.string(), z.unknown()),
    tombstone: z.boolean(),
    payloadHash: digestSchema,
  })
  .strict();
export type ChatSyncApplyRequest = z.infer<typeof ChatSyncApplyRequestSchema>;

/** Who a server-originated message is from: a member's message the server sends, or a system line. */
export const CHAT_OUTBOX_COMMAND_KINDS = ['userMsg', 'systemMsg'] as const;
export type ChatOutboxCommandKind = (typeof CHAT_OUTBOX_COMMAND_KINDS)[number];

/**
 * One server-originated message, appended by the room `threadRef` names. `commandId` is the signed
 * operation id and the room's idempotency key, so a repeated append writes one row.
 */
export const ChatOutboxAppendRequestSchema = z
  .object({
    commandId: operationIdSchema,
    kind: z.enum(CHAT_OUTBOX_COMMAND_KINDS),
    threadRef: roomTargetSchema,
    payload: ChatServerMessagePayloadSchema,
  })
  .strict();
export type ChatOutboxAppendRequest = z.infer<typeof ChatOutboxAppendRequestSchema>;

/**
 * The global word-list snapshot, as the server publishes it and as the Worker stores it. `hash` is
 * edge-protocol-core's `hashStringSet` of `words`; the Worker and every room recompute it and refuse
 * a snapshot whose hash does not match.
 */
export const ChatWordListSnapshotSchema = z
  .object({
    wordListVersion: z.number().int().nonnegative(),
    words: z.array(z.string()),
    hash: digestSchema,
  })
  .strict();
export type ChatWordListSnapshot = z.infer<typeof ChatWordListSnapshotSchema>;
