import { z } from 'zod';
import { digestSchema, operationIdSchema, roomTargetSchema } from './internal-atoms.js';
import {
  ChatOutboxAppendRequestSchema,
  ChatParkedDeliveryReplayRequestSchema,
  ChatSyncApplyRequestSchema,
  ChatWordListSnapshotSchema,
} from './internal-contract.js';
import { CHAT_ACCOUNT_ID_MAX_LENGTH } from './realtime-wire.js';

export const CHAT_INTERNAL_PATHS = {
  syncApply: '/internal/sync/apply',
  outboxAppend: '/internal/outbox/append',
  wordListPublish: '/internal/wordlist/publish',
  channelModerate: '/internal/channel/moderate',
  channelContext: '/internal/channel/context',
  anonymizableEpochs: '/internal/channel/anonymizable-epochs',
  anonymizeLive: '/internal/channel/anonymize-live',
  anonymizeScan: '/internal/channel/anonymize-scan',
  anonymizeRewrite: '/internal/channel/anonymize-rewrite',
  anonymizeSwap: '/internal/channel/anonymize-swap',
  anonymizeDelete: '/internal/channel/anonymize-delete',
  anonymizeCleanup: '/internal/channel/anonymize-cleanup',
  roomReplayParked: '/internal/room/replay-parked',
} as const;
export type ChatInternalPath = (typeof CHAT_INTERNAL_PATHS)[keyof typeof CHAT_INTERNAL_PATHS];

export const CHAT_ARCHIVE_KEY_MAX_LENGTH = 256;

const accountIdSchema = z.string().min(1).max(CHAT_ACCOUNT_ID_MAX_LENGTH);
const archiveKeySchema = z.string().min(1).max(CHAT_ARCHIVE_KEY_MAX_LENGTH);
const wholeSchema = z.number().int().nonnegative();

export const CHAT_MODERATION_ACTIONS = ['hide', 'delete'] as const;
export type ChatModerationAction = (typeof CHAT_MODERATION_ACTIONS)[number];

export const ChatChannelModerateRequestSchema = z.union([
  z
    .object({
      requestId: operationIdSchema,
      targetDo: roomTargetSchema,
      phase: z.literal('prepare'),
      action: z.enum(CHAT_MODERATION_ACTIONS),
      messageSeq: wholeSchema,
      expectedMessageRevision: wholeSchema,
    })
    .strict(),
  z
    .object({
      requestId: operationIdSchema,
      targetDo: roomTargetSchema,
      phase: z.literal('finalize'),
    })
    .strict(),
  z
    .object({ requestId: operationIdSchema, targetDo: roomTargetSchema, probe: z.literal(true) })
    .strict(),
]);
export type ChatChannelModerateRequest = z.infer<typeof ChatChannelModerateRequestSchema>;

export const ChatChannelContextRequestSchema = z
  .object({
    requestId: operationIdSchema,
    targetDo: roomTargetSchema,
    reportedSeq: wholeSchema,
    before: wholeSchema.optional(),
    after: wholeSchema.optional(),
  })
  .strict();
export type ChatChannelContextRequest = z.infer<typeof ChatChannelContextRequestSchema>;

export const ChatAnonymizableEpochsRequestSchema = z
  .object({ targetDo: roomTargetSchema, operationId: operationIdSchema })
  .strict();
export type ChatAnonymizableEpochsRequest = z.infer<typeof ChatAnonymizableEpochsRequestSchema>;

export const ChatAnonymizeLiveRequestSchema = z
  .object({
    targetDo: roomTargetSchema,
    operationId: operationIdSchema,
    anonymizedUid: accountIdSchema,
    tombstoneUid: accountIdSchema,
  })
  .strict();
export type ChatAnonymizeLiveRequest = z.infer<typeof ChatAnonymizeLiveRequestSchema>;

export const ChatAnonymizeScanRequestSchema = z
  .object({
    targetDo: roomTargetSchema,
    operationId: operationIdSchema,
    epoch: wholeSchema,
    anonymizedUid: accountIdSchema,
    existingGeneration: wholeSchema.nullable().optional(),
  })
  .strict();
export type ChatAnonymizeScanRequest = z.infer<typeof ChatAnonymizeScanRequestSchema>;

export const ChatAnonymizeRewriteRequestSchema = z
  .object({
    targetDo: roomTargetSchema,
    operationId: operationIdSchema,
    epoch: wholeSchema,
    replacementGeneration: wholeSchema,
    chunkOrdinal: wholeSchema,
    sourceChunkKey: archiveKeySchema,
    anonymizedUid: accountIdSchema,
    tombstoneUid: accountIdSchema,
    expectedSha256: digestSchema,
  })
  .strict();
export type ChatAnonymizeRewriteRequest = z.infer<typeof ChatAnonymizeRewriteRequestSchema>;

export const ChatAnonymizeSwapRequestSchema = z
  .object({
    targetDo: roomTargetSchema,
    operationId: operationIdSchema,
    epoch: wholeSchema,
    sourceManifestKey: archiveKeySchema,
    sourceManifestHash: digestSchema,
    sourceGeneration: wholeSchema,
    replacementGeneration: wholeSchema,
    replacements: z.array(
      z
        .object({
          ordinal: wholeSchema,
          replacementChunkKey: archiveKeySchema,
          replacementSha256: digestSchema,
        })
        .strict(),
    ),
  })
  .strict();
export type ChatAnonymizeSwapRequest = z.infer<typeof ChatAnonymizeSwapRequestSchema>;

export const ChatAnonymizeDeleteRequestSchema = z
  .object({
    targetDo: roomTargetSchema,
    operationId: operationIdSchema,
    epoch: wholeSchema,
    chunkKey: archiveKeySchema,
  })
  .strict();
export type ChatAnonymizeDeleteRequest = z.infer<typeof ChatAnonymizeDeleteRequestSchema>;

export const ChatAnonymizeCleanupRequestSchema = z
  .object({
    targetDo: roomTargetSchema,
    operationId: operationIdSchema,
    epoch: wholeSchema,
    replacementGeneration: wholeSchema,
  })
  .strict();
export type ChatAnonymizeCleanupRequest = z.infer<typeof ChatAnonymizeCleanupRequestSchema>;

interface ChatInternalCall<S extends z.ZodType> {
  readonly body: S;
  readonly operationId: (body: z.infer<S>) => string;
}

function internalCall<S extends z.ZodType>(
  body: S,
  operationId: (body: z.infer<S>) => string,
): ChatInternalCall<S> {
  return { body, operationId };
}

const byOperationId = (body: { operationId: string }): string => body.operationId;
const byRequestId = (body: { requestId: string }): string => body.requestId;

export const CHAT_INTERNAL_CALLS = {
  [CHAT_INTERNAL_PATHS.syncApply]: internalCall(ChatSyncApplyRequestSchema, (b) => b.eventId),
  [CHAT_INTERNAL_PATHS.outboxAppend]: internalCall(
    ChatOutboxAppendRequestSchema,
    (b) => b.commandId,
  ),
  [CHAT_INTERNAL_PATHS.wordListPublish]: internalCall(
    ChatWordListSnapshotSchema,
    (b) => `wordlist:${b.wordListVersion}`,
  ),
  [CHAT_INTERNAL_PATHS.channelModerate]: internalCall(
    ChatChannelModerateRequestSchema,
    byRequestId,
  ),
  [CHAT_INTERNAL_PATHS.channelContext]: internalCall(ChatChannelContextRequestSchema, byRequestId),
  [CHAT_INTERNAL_PATHS.anonymizableEpochs]: internalCall(
    ChatAnonymizableEpochsRequestSchema,
    byOperationId,
  ),
  [CHAT_INTERNAL_PATHS.anonymizeLive]: internalCall(ChatAnonymizeLiveRequestSchema, byOperationId),
  [CHAT_INTERNAL_PATHS.anonymizeScan]: internalCall(ChatAnonymizeScanRequestSchema, byOperationId),
  [CHAT_INTERNAL_PATHS.anonymizeRewrite]: internalCall(
    ChatAnonymizeRewriteRequestSchema,
    byOperationId,
  ),
  [CHAT_INTERNAL_PATHS.anonymizeSwap]: internalCall(ChatAnonymizeSwapRequestSchema, byOperationId),
  [CHAT_INTERNAL_PATHS.anonymizeDelete]: internalCall(
    ChatAnonymizeDeleteRequestSchema,
    byOperationId,
  ),
  [CHAT_INTERNAL_PATHS.anonymizeCleanup]: internalCall(
    ChatAnonymizeCleanupRequestSchema,
    byOperationId,
  ),
  [CHAT_INTERNAL_PATHS.roomReplayParked]: internalCall(
    ChatParkedDeliveryReplayRequestSchema,
    (b) => b.eventId,
  ),
} as const satisfies { readonly [P in ChatInternalPath]: ChatInternalCall<z.ZodType> };

export type ChatInternalBody<P extends ChatInternalPath> = z.infer<
  (typeof CHAT_INTERNAL_CALLS)[P]['body']
>;

export function isChatInternalPath(path: string): path is ChatInternalPath {
  return Object.prototype.hasOwnProperty.call(CHAT_INTERNAL_CALLS, path);
}

export function chatInternalOperationId<P extends ChatInternalPath>(
  path: P,
  body: ChatInternalBody<P>,
): string {
  const call = CHAT_INTERNAL_CALLS[path] as unknown as ChatInternalCall<z.ZodType>;
  return call.operationId(body);
}

export type ChatInternalCallRequest = {
  [P in ChatInternalPath]: { path: P; body: ChatInternalBody<P>; operationId: string };
}[ChatInternalPath];

export type ParsedChatInternalRequest =
  ({ ok: true } & ChatInternalCallRequest) | { ok: false; reason: 'unknown-path' | 'bad-body' };

export function parseChatInternalRequest(path: string, body: unknown): ParsedChatInternalRequest {
  if (!isChatInternalPath(path)) return { ok: false, reason: 'unknown-path' };
  const call = CHAT_INTERNAL_CALLS[path] as unknown as ChatInternalCall<z.ZodType>;
  const parsed = call.body.safeParse(body);
  if (!parsed.success) return { ok: false, reason: 'bad-body' };
  return {
    ok: true,
    path,
    body: parsed.data,
    operationId: call.operationId(parsed.data),
  } as ParsedChatInternalRequest;
}
