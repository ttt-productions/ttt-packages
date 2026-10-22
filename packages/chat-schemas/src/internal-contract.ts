import { z } from 'zod';
import { digestSchema, operationIdSchema, roomTargetSchema } from './internal-atoms.js';
import {
  CHAT_GRANT_AUDIENCE,
  CHAT_MESSAGE_TEXT_MAX_LENGTH,
  ChatReferencedUidsSchema,
} from './realtime-wire.js';

export const CHAT_INTERNAL_BODY_MAX_BYTES = 262_144;

export const CHAT_INTERNAL_CALL_DIRECTIONS = ['to-room', 'to-server'] as const;
export type ChatInternalCallDirection = (typeof CHAT_INTERNAL_CALL_DIRECTIONS)[number];

export function chatInternalAudience(direction: ChatInternalCallDirection, env: string): string {
  if (env.length === 0) throw new RangeError('a chat internal audience needs an environment');
  return `${CHAT_GRANT_AUDIENCE}:${direction}:${env}`;
}

export const ChatServerMessagePayloadSchema = z
  .object({
    senderId: z.string().min(1),
    text: z.string().max(CHAT_MESSAGE_TEXT_MAX_LENGTH),
    referencedUids: ChatReferencedUidsSchema.optional(),
  })
  .strict();
export type ChatServerMessagePayload = z.infer<typeof ChatServerMessagePayloadSchema>;

export const CHAT_ROOM_KINDS = ['channel', 'inbox'] as const;
export type ChatRoomKind = (typeof CHAT_ROOM_KINDS)[number];

export const CHAT_OUTBOX_EVENT_ID_MAX_LENGTH = 200;

export const CHAT_DELIVERY_KIND_MAX_LENGTH = 64;

export const CHAT_PARKED_DELIVERY_ERROR_MAX_LENGTH = 500;

const outboxEventIdSchema = z.string().min(1).max(CHAT_OUTBOX_EVENT_ID_MAX_LENGTH);

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

export function chatParkedDeliveryReportOperationId(
  report: Pick<ChatParkedDeliveryReport, 'eventId'>,
): string {
  return report.eventId;
}

export const CHAT_PARKED_DELIVERY_REPORT_CONTENT_TYPE = 'application/octet-stream';

export const CHAT_PARKED_DELIVERY_REPORT_MAX_BODY_BYTES = 16_384;

export const ChatParkedDeliveryReplayRequestSchema = z
  .object({
    targetDo: roomTargetSchema,
    eventId: outboxEventIdSchema,
  })
  .strict();
export type ChatParkedDeliveryReplayRequest = z.infer<typeof ChatParkedDeliveryReplayRequestSchema>;

export const CHAT_PARKED_DELIVERY_REPLAY_OUTCOMES = ['requeued', 'not-parked'] as const;
export const ChatParkedDeliveryReplayResultSchema = z
  .object({ outcome: z.enum(CHAT_PARKED_DELIVERY_REPLAY_OUTCOMES) })
  .strict();
export type ChatParkedDeliveryReplayResult = z.infer<typeof ChatParkedDeliveryReplayResultSchema>;

export const CHAT_SYNC_APPLY_KINDS = ['channelAuth', 'accountAccess', 'config'] as const;
export type ChatSyncApplyKind = (typeof CHAT_SYNC_APPLY_KINDS)[number];

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

export const CHAT_OUTBOX_COMMAND_KINDS = ['userMsg', 'systemMsg'] as const;
export type ChatOutboxCommandKind = (typeof CHAT_OUTBOX_COMMAND_KINDS)[number];

export const ChatOutboxAppendRequestSchema = z
  .object({
    commandId: operationIdSchema,
    kind: z.enum(CHAT_OUTBOX_COMMAND_KINDS),
    threadRef: roomTargetSchema,
    payload: ChatServerMessagePayloadSchema,
  })
  .strict();
export type ChatOutboxAppendRequest = z.infer<typeof ChatOutboxAppendRequestSchema>;

export const ChatWordListSnapshotSchema = z
  .object({
    wordListVersion: z.number().int().nonnegative(),
    words: z.array(z.string()),
    hash: digestSchema,
  })
  .strict();
export type ChatWordListSnapshot = z.infer<typeof ChatWordListSnapshotSchema>;
