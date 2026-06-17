// Chat realtime SYNC / projection / command Firestore schemas (chat-edge-rebuild P1).
// Frozen field lists come from IMPLEMENTATION_MATRIX.md "Chat sync / projection /
// commands (Firestore side)". All of these collections are Admin-SDK-only
// (`allow read, write: if false`). Per the TTT timestamp convention every time
// field is epoch-ms `number`; the SINGLE exception is the native-TTL `expireAt`,
// which is a real Firestore `Timestamp` (modeled as `unknown` so the drift-check
// does not false-flag a Timestamp object against `z.number()`).

import { z } from 'zod';

/** Native-TTL field — a real Firestore Timestamp (NOT epoch-ms). Absent until the terminal that sets TTL. */
const expireAtField = z.unknown().optional();

// ── chatChannelAuthProjections/{authPairKey} ────────────────────────────────
// Per-(user, channel) authorization FACT. Absent ⇒ removed/deny (fail-closed).
export const ChatChannelAuthProjectionSchema = z.object({
  channelRefScope: z.enum(['channel', 'invite']),
  workProjectId: z.string().nullable(),
  guildChatChannelId: z.string().nullable(),
  guildInviteId: z.string().nullable(),
  uid: z.string(),
  channelKey: z.string(),
  channelAuthState: z.enum(['authorized', 'removed']),
  channelAuthVersion: z.number(),
  inputFingerprint: z.string(),
  updatedAt: z.number(),
});
export type ChatChannelAuthProjection = z.infer<typeof ChatChannelAuthProjectionSchema>;

// ── chatScopeDegraded/{scopeKey} (+ causes/{causeId}) ───────────────────────
// Exists IFF unresolvedCauseCount > 0. Grant mints fail closed while it exists.
export const ChatScopeDegradedSchema = z.object({
  scopeKey: z.string(),
  scopeKind: z.enum(['channel', 'memberInWork']),
  // channel scope carries the channelRef tuple; memberInWork carries {uid, workProjectId}.
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

// ── chatSyncEvents/{eventId} ────────────────────────────────────────────────
export const ChatSyncEventSchema = z.object({
  eventId: z.string(),
  targetDo: z.string(),
  kind: z.enum(['channelAuth', 'accountAccess', 'config', 'attachmentFlip', 'serverMessage']),
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

// ── chatSyncFanoutJobs/{jobId} ──────────────────────────────────────────────
export const ChatSyncFanoutJobSchema = z.object({
  jobId: z.string(),
  selectorKind: z.enum(['channelMembers', 'workChannelsForUser', 'policyEditAffectedUsers']),
  selectorArgs: z.object({
    workProjectId: z.string().optional(),
    channelKey: z.string().optional(),
    uid: z.string().optional(),
  }),
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
});
export type ChatSyncFanoutJob = z.infer<typeof ChatSyncFanoutJobSchema>;

// ── chatMessageOutbox/{commandId} ───────────────────────────────────────────
export const ChatMessageOutboxSchema = z.object({
  commandId: z.string(),
  kind: z.enum(['userMsg', 'systemMsg', 'attachmentPlaceholder']),
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

// ── chatAdminActionCommands/{requestId} ─────────────────────────────────────
// `requestId` IS the doc id + DO dedup key. `delivering` is NOT a lease (it sets
// nextAttemptAt = now + DELIVERY_TIMEOUT). terminalFailureGeneration default 0.
export const ChatAdminActionCommandSchema = z.object({
  requestId: z.string(),
  actorUid: z.string(),
  actorMode: z.enum(['adminReview', 'adminOverride']),
  systemRole: z.enum(['admin', 'jrAdmin']),
  channelRef: z.record(z.string(), z.unknown()),
  messageSeq: z.number(),
  action: z.enum(['hide', 'delete']),
  caseId: z.string(),
  reason: z.string(),
  expectedMessageRevision: z.number(),
  // Ready-attachment media asset id(s) on the moderated message (block FIRST, then
  // DO tombstone — the attachment-redaction saga, round-10 blocker 9). Empty for a
  // text-only message; discovered at request time from the case-bound context read.
  attachmentAssetIds: z.array(z.string()).default([]),
  payloadHash: z.string(),
  state: z.enum(['queued', 'delivering', 'applied', 'failed', 'deadLetter']),
  attemptCount: z.number(),
  nextAttemptAt: z.number(),
  lastError: z.string().nullable(),
  result: z.record(z.string(), z.unknown()).nullable(),
  doRevisionId: z.string().nullable(),
  // True once the redaction saga has blocked the attachment asset(s) for this command.
  attachmentBlocked: z.boolean().default(false),
  terminalFailureGeneration: z.number(),
  createdAt: z.number(),
  appliedAt: z.number().nullable(),
  failedAt: z.number().nullable(),
  deadLetteredAt: z.number().nullable(),
  reconciled: z.boolean(),
  reconciledAt: z.number().nullable(),
  expireAt: expireAtField,
});
export type ChatAdminActionCommand = z.infer<typeof ChatAdminActionCommandSchema>;
