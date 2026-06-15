import { describe, it, expect } from 'vitest';
import {
  ChatChannelAuthProjectionSchema,
  ChatScopeDegradedSchema,
  ChatScopeDegradedCauseSchema,
  ChatSyncEventSchema,
  ChatSyncFanoutJobSchema,
  ChatMessageOutboxSchema,
  ChatAdminActionCommandSchema,
} from '../src/doc-schemas/chat-sync';
import {
  NotificationDeliverySchema,
  NotificationFanoutJobSchema,
} from '../src/doc-schemas/notification-ledger';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';
import { COLLECTIONS, NESTED_SUBCOLLECTIONS } from '../src/paths/collections';
import { PATH_BUILDERS } from '../src/paths/path-builders';

describe('chat-sync doc schemas parse representative docs', () => {
  it('ChatChannelAuthProjection (fail-closed fact)', () => {
    expect(ChatChannelAuthProjectionSchema.safeParse({
      channelRefScope: 'channel', workProjectId: 'wp1', guildChatChannelId: 'ch1', guildInviteId: null,
      uid: 'u1', channelKey: 'ck', channelAuthState: 'authorized', channelAuthVersion: 3, inputFingerprint: 'fp', updatedAt: 1,
    }).success).toBe(true);
  });

  it('ChatScopeDegraded + cause', () => {
    expect(ChatScopeDegradedSchema.safeParse({
      scopeKey: 'sk', scopeKind: 'channel', workProjectId: 'wp1', guildChatChannelId: 'ch1', guildInviteId: null, uid: null, unresolvedCauseCount: 1, updatedAt: 1,
    }).success).toBe(true);
    expect(ChatScopeDegradedCauseSchema.safeParse({ causeId: 'c', kind: 'syncEvent', ref: 'e1', deadLetteredAt: 1 }).success).toBe(true);
  });

  it('ChatSyncEvent', () => {
    expect(ChatSyncEventSchema.safeParse({
      eventId: 'e1', targetDo: 'do', kind: 'channelAuth', version: 1, payload: { a: 1 }, payloadHash: 'h',
      status: 'pending', attemptCount: 0, nextAttemptAt: 1, lastError: null, createdAt: 1, deliveredResult: null, deliveredAt: null, deadLetteredAt: null,
    }).success).toBe(true);
  });

  it('ChatSyncFanoutJob', () => {
    expect(ChatSyncFanoutJobSchema.safeParse({
      jobId: 'j', selectorKind: 'workChannelsForUser', selectorArgs: { uid: 'u1', workProjectId: 'wp1' }, causeVersion: 4,
      cursor: { pageIndex: 0, lastDocId: null }, revision: 0, status: 'pending', attemptCount: 0, nextAttemptAt: 1, lastError: null,
      createdAt: 1, completedAt: null, deadLetteredAt: null,
    }).success).toBe(true);
  });

  it('ChatMessageOutbox', () => {
    expect(ChatMessageOutboxSchema.safeParse({
      commandId: 'pm1', kind: 'attachmentPlaceholder', threadRef: 'tr', payload: {}, payloadVersion: 1,
      status: 'pending', attemptCount: 0, nextAttemptAt: 1, lastError: null, createdAt: 1, appliedAt: null, deadLetteredAt: null,
    }).success).toBe(true);
  });

  it('ChatAdminActionCommand', () => {
    expect(ChatAdminActionCommandSchema.safeParse({
      requestId: 'r1', actorUid: 'a', actorMode: 'adminOverride', systemRole: 'admin', channelRef: { scope: 'channel' }, messageSeq: 5,
      action: 'hide', caseId: 'case1', reason: 'r', expectedMessageRevision: 2, payloadHash: 'h', state: 'queued', attemptCount: 0,
      nextAttemptAt: 1, lastError: null, result: null, doRevisionId: null, terminalFailureGeneration: 0, createdAt: 1,
      appliedAt: null, failedAt: null, deadLetteredAt: null, reconciled: false, reconciledAt: null,
    }).success).toBe(true);
  });
});

describe('notification ledger schemas parse representative docs', () => {
  it('NotificationDelivery', () => {
    expect(NotificationDeliverySchema.safeParse({
      deliveryId: 'd1', state: 'queued', notificationType: 'guild_invite', eventId: 'gi1', recipientUid: 'u1', aggregationKey: 'gi1',
      strategy: 'increment', payload: { actorId: 'a', metadata: {}, occurrenceAt: 1 }, payloadVersion: 1, materializationClass: 'directQueued',
      createdAt: 1, attemptCount: 0, nextAttemptAt: 1, lastError: null, materializedAt: null, deadLetteredAt: null,
    }).success).toBe(true);
  });

  it('NotificationFanoutJob', () => {
    expect(NotificationFanoutJobSchema.safeParse({
      jobId: 'rg1:content_report', schemaVersion: 1, notificationType: 'followed_content_published', eventId: 't1', priority: 2,
      payload: {}, phases: [{ selector: {}, cursor: null, done: false }], phaseIndex: 0, revision: 0, status: 'pending', attemptCount: 0,
      nextAttemptAt: 1, lastError: null, createdAt: 1, updatedAt: 1, completedAt: null, deadLetteredAt: null,
    }).success).toBe(true);
  });
});

describe('registry + paths wiring', () => {
  it('every new collection is bound in COLLECTION_SCHEMAS', () => {
    for (const path of [
      'notificationDeliveries/{deliveryId}',
      'notificationFanoutJobs/{jobId}',
      'chatChannelAuthProjections/{authPairKey}',
      'chatScopeDegraded/{scopeKey}',
      'chatScopeDegraded/{scopeKey}/causes/{causeId}',
      'chatSyncEvents/{eventId}',
      'chatSyncFanoutJobs/{jobId}',
      'chatMessageOutbox/{commandId}',
      'chatAdminActionCommands/{requestId}',
    ] as const) {
      expect(path in COLLECTION_SCHEMAS).toBe(true);
    }
  });

  it('path builders produce the registered top-level paths', () => {
    expect(PATH_BUILDERS.notificationDelivery('d1')).toEqual([COLLECTIONS.NOTIFICATION_DELIVERIES, 'd1']);
    expect(PATH_BUILDERS.chatSyncEvent('e1')).toEqual([COLLECTIONS.CHAT_SYNC_EVENTS, 'e1']);
    expect(PATH_BUILDERS.chatScopeDegradedCause('sk', 'c1')).toEqual([
      COLLECTIONS.CHAT_SCOPE_DEGRADED, 'sk', NESTED_SUBCOLLECTIONS.CHAT_SCOPE_DEGRADED_CAUSES, 'c1',
    ]);
    expect(PATH_BUILDERS.chatAdminActionCommand('r1')).toEqual([COLLECTIONS.CHAT_ADMIN_ACTION_COMMANDS, 'r1']);
  });
});
