import { z } from 'zod';
import {
  CHAT_MODERATION_ACTIONS,
  CHAT_OUTBOX_COMMAND_KINDS,
  CHAT_SYNC_APPLY_KINDS,
  ChatParkedDeliveryReportSchema,
} from '@ttt-productions/chat-schemas';
import { systemRoleSchema } from '../schemas/atoms.js';
import { GUILD_CHAT_CONVERSATION_KINDS } from '../ids/guild-chat-conversation.js';

// Native TTL needs a real Firestore Timestamp, not epoch ms; `unknown` so the drift-check does not
// flag it against `z.number()`.
const expireAtField = z.unknown().optional();

export const ChatChannelAuthProjectionSchema = z.object({
  channelRefScope: z.enum(GUILD_CHAT_CONVERSATION_KINDS),
  workProjectId: z.string().nullable(),
  guildChatChannelId: z.string().nullable(),
  guildInviteId: z.string().nullable(),
  uid: z.string(),
  channelKey: z.string(),
  channelAuthState: z.enum(['authorized', 'removed']),
  channelAuthVersion: z.number(),
  inputFingerprint: z.string(),
  updatedAt: z.number(),
  lastReconciledAt: z.number().optional(),
});
export type ChatChannelAuthProjection = z.infer<typeof ChatChannelAuthProjectionSchema>;

export const ChatScopeDegradedSchema = z.object({
  scopeKey: z.string(),
  scopeKind: z.enum(['channel', 'memberInWork']),
  workProjectId: z.string().nullable(),
  guildChatChannelId: z.string().nullable(),
  guildInviteId: z.string().nullable(),
  uid: z.string().nullable(),
  unresolvedCauseCount: z.number(),
  updatedAt: z.number(),
});
export type ChatScopeDegraded = z.infer<typeof ChatScopeDegradedSchema>;

export const ChatScopeDegradedCauseSchema = z.object({
  causeId: z.string(),
  kind: z.enum(['syncEvent', 'fanoutJob']),
  ref: z.string(),
  deadLetteredAt: z.number(),
});
export type ChatScopeDegradedCause = z.infer<typeof ChatScopeDegradedCauseSchema>;

export const ChatSyncEventSchema = z.object({
  eventId: z.string(),
  targetDo: z.string(),
  kind: z.enum(CHAT_SYNC_APPLY_KINDS),
  version: z.number(),
  payload: z.record(z.string(), z.unknown()).nullable(),
  tombstone: z.boolean().optional(),
  payloadHash: z.string(),
  status: z.enum(['pending', 'delivered', 'deadLetter']),
  attemptCount: z.number(),
  nextAttemptAt: z.number(),
  lastError: z.string().nullable(),
  createdAt: z.number(),
  deliveredResult: z.record(z.string(), z.unknown()).nullable(),
  deliveredAt: z.number().nullable(),
  deadLetteredAt: z.number().nullable(),
  expireAt: expireAtField,
});
export type ChatSyncEvent = z.infer<typeof ChatSyncEventSchema>;

const ChatSyncFanoutJobBaseShape = {
  jobId: z.string(),
  causeVersion: z.number(),
  cursor: z.object({ pageIndex: z.number(), lastDocId: z.string().nullable() }),
  revision: z.number(),
  status: z.enum(['pending', 'complete', 'deadLetter']),
  attemptCount: z.number(),
  nextAttemptAt: z.number(),
  lastError: z.string().nullable(),
  createdAt: z.number(),
  completedAt: z.number().nullable(),
  deadLetteredAt: z.number().nullable(),
  expireAt: expireAtField,
};

const channelFanoutSelectorArgs = z
  .object({
    workProjectId: z.string().min(1),
    guildChatChannelId: z.string().min(1),
    channelKey: z.string().min(1),
  })
  .strict();

const inviteParticipantsSelectorArgs = z
  .object({
    guildInviteId: z.string().min(1),
    participantUids: z
      .array(z.string().min(1))
      .length(2)
      .refine((uids) => new Set(uids).size === uids.length, {
        message: 'Invite participant uids must be distinct.',
      }),
  })
  .strict();

export const ChatSyncFanoutJobSchema = z.discriminatedUnion('selectorKind', [
  z
    .object({
      ...ChatSyncFanoutJobBaseShape,
      selectorKind: z.literal('channelMembers'),
      selectorArgs: channelFanoutSelectorArgs,
    })
    .strict(),
  z
    .object({
      ...ChatSyncFanoutJobBaseShape,
      selectorKind: z.literal('policyEditAffectedUsers'),
      selectorArgs: channelFanoutSelectorArgs,
    })
    .strict(),
  z
    .object({
      ...ChatSyncFanoutJobBaseShape,
      selectorKind: z.literal('workChannelsForUser'),
      selectorArgs: z
        .object({
          uid: z.string().min(1),
          workProjectId: z.string().min(1),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...ChatSyncFanoutJobBaseShape,
      selectorKind: z.literal('inviteParticipants'),
      selectorArgs: inviteParticipantsSelectorArgs,
    })
    .strict(),
]);
export type ChatSyncFanoutJob = z.infer<typeof ChatSyncFanoutJobSchema>;

export const ChatMessageOutboxSchema = z.object({
  commandId: z.string(),
  kind: z.enum(CHAT_OUTBOX_COMMAND_KINDS),
  threadRef: z.string(),
  payload: z.record(z.string(), z.unknown()),
  payloadVersion: z.number(),
  status: z.enum(['pending', 'applied', 'deadLetter']),
  attemptCount: z.number(),
  nextAttemptAt: z.number(),
  lastError: z.string().nullable(),
  createdAt: z.number(),
  appliedAt: z.number().nullable(),
  deadLetteredAt: z.number().nullable(),
  expireAt: expireAtField,
});
export type ChatMessageOutbox = z.infer<typeof ChatMessageOutboxSchema>;

export const ChatAdminActionCommandSchema = z.object({
  requestId: z.string(),
  actorUid: z.string(),
  actorMode: z.enum(['adminReview', 'adminOverride']),
  systemRole: systemRoleSchema,
  channelRef: z.record(z.string(), z.unknown()),
  messageSeq: z.number(),
  action: z.enum(CHAT_MODERATION_ACTIONS),
  caseId: z.string(),
  reason: z.string(),
  expectedMessageRevision: z.number(),
  payloadHash: z.string(),
  state: z.enum(['queued', 'delivering', 'safetyRepair', 'applied', 'failed', 'deadLetter']),
  attemptCount: z.number(),
  nextAttemptAt: z.number(),
  lastError: z.string().nullable(),
  result: z.record(z.string(), z.unknown()).nullable(),
  doRevisionId: z.string().nullable(),
  terminalFailureGeneration: z.number(),
  createdAt: z.number(),
  appliedAt: z.number().nullable(),
  failedAt: z.number().nullable(),
  deadLetteredAt: z.number().nullable(),
  reconciled: z.boolean(),
  reconciledAt: z.number().nullable(),
  safetyRepair: z.boolean(),
  safetyRepairGeneration: z.number(),
  reconcileAttemptCount: z.number(),
  expireAt: expireAtField,
});
export type ChatAdminActionCommand = z.infer<typeof ChatAdminActionCommandSchema>;

export const ChatHistoryAnonymizationJobSchema = z.object({
  jobId: z.string(),
  channelDoId: z.string(),
  epoch: z.number(),
  anonymizedUid: z.string(),
  sourceManifestKey: z.string().nullable(),
  sourceManifestHash: z.string().nullable(),
  sourceGeneration: z.number().nullable(),
  replacementGeneration: z.number().nullable(),
  newManifestKey: z.string().nullable(),
  scanCursor: z.number(),
  rewriteCursor: z.number(),
  deleteCursor: z.number(),
  swappedAt: z.number().nullable(),
  state: z.enum(['scanning', 'rewriting', 'swapping', 'deleting', 'done', 'failed']),
  legalHoldPaused: z.boolean(),
  attemptCount: z.number(),
  nextAttemptAt: z.number(),
  lastError: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  expireAt: expireAtField,
});
export type ChatHistoryAnonymizationJob = z.infer<typeof ChatHistoryAnonymizationJobSchema>;

export const ChatHistoryAnonymizationAffectedChunkSchema = z.object({
  chunkOrdinal: z.number(),
  sourceChunkKey: z.string(),
  sourceSha256: z.string(),
  replacementChunkKey: z.string().nullable(),
  replacementSha256: z.string().nullable(),
  rewriteState: z.enum(['pending', 'done']),
  deleteState: z.enum(['pending', 'done']),
});
export type ChatHistoryAnonymizationAffectedChunk = z.infer<
  typeof ChatHistoryAnonymizationAffectedChunkSchema
>;

export const CHAT_PARKED_DELIVERY_STATUSES = ['deadLetter', 'pending', 'delivered'] as const;
export const ChatParkedDeliverySchema = ChatParkedDeliveryReportSchema.extend({
  status: z.enum(CHAT_PARKED_DELIVERY_STATUSES),
  attemptCount: z.number().int().nonnegative(),
  nextAttemptAt: z.number(),
  lastError: z.string().nullable(),
  createdAt: z.number(),
  deadLetteredAt: z.number().nullable(),
  deliveredAt: z.number().nullable(),
  expireAt: expireAtField,
});
export type ChatParkedDelivery = z.infer<typeof ChatParkedDeliverySchema>;
