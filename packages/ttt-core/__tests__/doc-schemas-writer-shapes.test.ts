// The registry must describe what the server writers ACTUALLY store.
//
// The defect these exist for: `functions/src` writers merged fields onto registered documents that
// no ttt-core schema declared — 28 on `activeReportGroups` alone — so a real document failed its own
// schema and nothing noticed, because Zod only runs where code calls it. Each case below is the shape
// a named writer stores, reduced to the fields that were undeclared. Every one of them was INVALID
// before its schema was completed.
//
// Each block also proves the completion did not loosen the schema: a field no writer stores is
// still rejected (strict shapes) or still absent from the declared keys (non-strict shapes).

import { describe, it, expect } from 'vitest';
import {
  ReportGroupV1Schema,
  ReportGroupModerationStateSchema,
  ReportGroupResolutionOutcomeSchema,
} from '../src/doc-schemas/safety/report';
import {
  ContentViolationSchema,
  ModerationEdgeSyncOpSchema,
  ModerationEdgeSyncStateSchema,
} from '../src/doc-schemas/moderation';
import {
  ThresholdItemSchema,
  PublishedChapterSchema,
  PublishedTuneTrackSchema,
  PublishedTelevisionEpisodeSchema,
  PublishedHallItemSchema,
} from '../src/doc-schemas/content';
import {
  SafetyEvidenceJobItemDocV1Schema,
  SafetyEvidenceJobItemV1Schema,
  SafetyEvidenceExternalFactKindSchema,
} from '../src/doc-schemas/safety/evidence';
import { ChildSafetyOwningAliasV1Schema } from '../src/doc-schemas/safety/case-aliases';
import { TakeItDownRequestRootV1Schema, TakeItDownRequestActionV1Schema } from '../src/doc-schemas/ncii/requests';
import { SafetyEvidenceDispositionV1Schema } from '../src/doc-schemas/safety/evidence';
import { NciiCaseClosureEventV1Schema } from '../src/doc-schemas/ncii/cases';
import { AccountActionCommandV1Schema } from '../src/doc-schemas/safety/sagas';
import { ProtectedReportRootV1Schema } from '../src/doc-schemas/safety/report';
import { AdminTaskDocSchema } from '../src/doc-schemas/report-docs';
import { ModerationCascadeChangedDocSchema } from '../src/doc-schemas/moderation';
import { NotificationFanoutJobSchema } from '../src/doc-schemas/notification-ledger';
import {
  NotificationDocSchema,
  NotificationHistoryDocSchema,
  StoredNotificationCardSchema,
} from '../src/doc-schemas/notifications';
import { COLLECTION_DOC_ID_FIELDS } from '../src/doc-schemas/registry';
import { PATH_BUILDERS } from '../src/paths/path-builders';
import { ChatChannelAuthProjectionSchema } from '../src/doc-schemas/chat-sync';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';

// A real member of the external-fact kind set, taken from its own schema rather than restated.
const EXTERNAL_FACT_KIND = SafetyEvidenceExternalFactKindSchema.options[0];

const group = {
  schemaVersion: 1,
  groupKey: 'square-streetz-post:p1:r1',
  itemType: 'square-streetz-post',
  totalReports: 2,
  highestReasonScore: 2,
  lastReportAt: 1,
  latestReason: 'Spam',
  status: 'pending',
} as const;

describe('activeReportGroups — the whole stored document', () => {
  it('accepts the intake trigger\'s group + moderation locator', () => {
    expect(ReportGroupV1Schema.safeParse({ ...group, reportedItemId: 'p1', parentItemId: null, reportedUserId: 'u1' }).success).toBe(true);
    // reportedUserId is OMITTED, never emptied, when the sender could not be resolved.
    expect(ReportGroupV1Schema.safeParse({ ...group, reportedItemId: 'p1', parentItemId: 'chan-1' }).success).toBe(true);
    expect(ReportGroupV1Schema.safeParse({ ...group, reportedItemId: 'p1', reportedUserId: '' }).success).toBe(false);
  });

  it('accepts a content action with its open edge-sync obligation (owner-keyed and asset-level)', () => {
    const acted = { ...group, moderationState: 'admin_hidden', contentHidden: true, moderatedAt: 5, edgeSyncState: 'processing', edgeSyncProcessingAt: 5, edgeSyncOp: 'block' };
    expect(ReportGroupV1Schema.safeParse({ ...acted, edgeSyncOwnerType: 'craftSkill', edgeSyncOwnerId: 'cs-1', edgeSyncAssetIds: ['a1'] }).success).toBe(true);
    expect(ReportGroupV1Schema.safeParse({ ...acted, edgeSyncAssetIds: ['a1', 'a2'] }).success).toBe(true);
  });

  it('accepts a failed obligation and a settled one (state null, params removed)', () => {
    expect(ReportGroupV1Schema.safeParse({ ...group, edgeSyncState: 'failed', edgeSyncOp: 'blockClear', edgeSyncAssetIds: [], edgeSyncError: 'gateway 503', edgeSyncFailedAt: 9 }).success).toBe(true);
    expect(ReportGroupV1Schema.safeParse({ ...group, moderationState: 'resolved_restored', contentHidden: false, moderatedAt: 5, edgeSyncState: null }).success).toBe(true);
  });

  it('accepts the recorded resolution, the chat tombstone lane, escalation, and the hold marker', () => {
    expect(ReportGroupV1Schema.safeParse({ ...group, status: 'processing', resolutionOutcome: 'founded', resolvedBy: 'admin-1', resolvedAt: 7, resolutionUserFacingReasonCode: 'spam', resolutionUserFacingReasonDetail: 'x', resolutionAdminNote: 'y' }).success).toBe(true);
    expect(ReportGroupV1Schema.safeParse({ ...group, status: 'resolved', tombstoneAppliedAt: 8 }).success).toBe(true);
    expect(ReportGroupV1Schema.safeParse({ ...group, status: 'failed', lastError: 'dead-lettered', failedAt: 8, failedCommandDocId: 'cmd-1' }).success).toBe(true);
    // adminReplayDeadLetter's Restart NULLS the failure fields rather than deleting them.
    expect(ReportGroupV1Schema.safeParse({ ...group, status: 'processing', lastError: null, failedAt: null }).success).toBe(true);
    expect(ReportGroupV1Schema.safeParse({ ...group, status: 'resolved', supersededByCaseId: 'case-1', supersededAt: 9 }).success).toBe(true);
    expect(ReportGroupV1Schema.safeParse({ ...group, supersededPartialAt: 9 }).success).toBe(true);
    expect(ReportGroupV1Schema.safeParse({ ...group, pendingHoldRelease: true }).success).toBe(true);
  });

  it('is still strict, and the value sets are closed', () => {
    expect(ReportGroupV1Schema.safeParse({ ...group, somethingNobodyWrites: 1 }).success).toBe(false);
    expect(ReportGroupV1Schema.safeParse({ ...group, moderationState: 'hidden' }).success).toBe(false);
    expect(ReportGroupV1Schema.safeParse({ ...group, edgeSyncOwnerType: 'notAnOwnerType' }).success).toBe(false);
    expect(ReportGroupModerationStateSchema.options).toEqual(['admin_hidden', 'resolved_restored', 'resolved_removed']);
    expect(ModerationEdgeSyncOpSchema.options).toEqual(['block', 'blockClear']);
    expect(ModerationEdgeSyncStateSchema.options).toEqual(['processing', 'failed']);
    expect(ReportGroupResolutionOutcomeSchema.options).toEqual(['founded', 'unfounded']);
  });
});

describe('contentViolations.pendingFile — the row AS CLAIMED', () => {
  const violation = { id: 'v1', userId: 'u1', fileType: 'squareStreetz', violationType: 'media', reason: 'flagged', timestamp: 1, appealStatus: 'none' } as const;

  it('accepts the claimed (processing) snapshot logContentViolation stores', () => {
    expect(ContentViolationSchema.safeParse({ ...violation, pendingFile: { id: 'pm-1', userId: 'u1', status: 'processing', processingAttemptCount: 1, processingStartedAt: 2 } }).success).toBe(true);
  });

  it('rejects a status the snapshot can never carry', () => {
    expect(ContentViolationSchema.safeParse({ ...violation, pendingFile: { status: 'pending' } }).success).toBe(false);
    expect(ContentViolationSchema.safeParse({ ...violation, pendingFile: { status: 'rejected' } }).success).toBe(false);
  });
});

describe('thresholdItems — submission attestations and reviewer confirmations', () => {
  const attestations = { attestConsistentFormat: true, attestNoCredits: true, attestNoBegging: true, attestHumanMadeOriginal: true, attestedAt: 3 } as const;
  const item = { thresholdItemId: 't1', hallItemId: 'h1', workProjectId: 'w1', workProjectType: 'Tales', itemId: 'c1', itemsKey: 'chapters', order: 1, hallWingType: 'entertainment', submittedAt: 1, reviewStatus: 'pending', hasRealPeople: false, ...attestations };

  it('declares every field the submit and approve writers store', () => {
    const keys = Object.keys(ThresholdItemSchema.shape);
    for (const k of ['attestConsistentFormat', 'attestNoCredits', 'attestNoBegging', 'attestHumanMadeOriginal', 'attestedAt', 'confirmedNoBegging', 'confirmedNoCredits', 'confirmedConsistentFormat', 'confirmedRealPeopleAttestation']) {
      expect(keys).toContain(k);
    }
  });

  it('REQUIRES all four attestations and attestedAt — a submission without them is not valid', () => {
    expect(ThresholdItemSchema.safeParse(item).success).toBe(true);
    for (const k of Object.keys(attestations)) {
      const { [k]: _omitted, ...missingOne } = item as Record<string, unknown>;
      expect(ThresholdItemSchema.safeParse(missingOne).success).toBe(false);
    }
  });

  it('stores an attestation or a confirmation only as the literal true', () => {
    expect(ThresholdItemSchema.safeParse({ ...item, reviewStatus: 'approved', confirmedNoBegging: true, confirmedNoCredits: true, confirmedConsistentFormat: true, confirmedRealPeopleAttestation: true }).success).toBe(true);
    expect(ThresholdItemSchema.safeParse({ ...item, attestNoBegging: false }).success).toBe(false);
    expect(ThresholdItemSchema.safeParse({ ...item, confirmedNoCredits: false }).success).toBe(false);
  });
});

describe('safetyEvidenceJobItems — object rows and the per-job control row', () => {
  const objectRow = { role: 'source', bucket: 'b', key: 'k', sizeBytes: 1, sha256: 'abc', verifyResult: 'pending' } as const;

  it('binds the registry to the union, not the object row alone', () => {
    expect(COLLECTION_SCHEMAS['safetyEvidenceJobs/{jobId}/safetyEvidenceJobItems/{itemId}']).toBe(SafetyEvidenceJobItemDocV1Schema);
  });

  it('accepts an object row, a capture control row, and a verify control row', () => {
    expect(SafetyEvidenceJobItemDocV1Schema.safeParse(objectRow).success).toBe(true);
    expect(SafetyEvidenceJobItemDocV1Schema.safeParse({
      role: 'control',
      sourceDiscriminator: 'case-baseline:case-1',
      request: { kind: 'externalFact', externalFact: { factKind: EXTERNAL_FACT_KIND, narrativeRef: 'narr-1' } },
      provenanceRefs: ['prov-1'],
    }).success).toBe(true);
    expect(SafetyEvidenceJobItemDocV1Schema.safeParse({ role: 'control', sourceDiscriminator: 's', captureJobId: 'job-1', requestKind: 'media' }).success).toBe(true);
  });

  it('keeps a control row out of the object-row schema and rejects an unknown request kind', () => {
    expect(SafetyEvidenceJobItemV1Schema.safeParse({ role: 'control', sourceDiscriminator: 's', captureJobId: 'j', requestKind: 'media' }).success).toBe(false);
    expect(SafetyEvidenceJobItemDocV1Schema.safeParse({ role: 'control', sourceDiscriminator: 's', captureJobId: 'j', requestKind: 'video' }).success).toBe(false);
    expect(SafetyEvidenceJobItemDocV1Schema.safeParse({ ...objectRow, captureJobId: 'j' }).success).toBe(false);
  });
});

describe('single-field completions', () => {
  it('childSafetyOwningAliases — a repointed alias carries its generation and repoint time', () => {
    const alias = { schemaVersion: 1, caseId: 'case-1', aliasType: 'rootIngest', canonicalValueHash: 'h', createdAt: 1 };
    expect(ChildSafetyOwningAliasV1Schema.safeParse(alias).success).toBe(true);
    expect(ChildSafetyOwningAliasV1Schema.safeParse({ ...alias, generation: 2, updatedAt: 5 }).success).toBe(true);
    expect(ChildSafetyOwningAliasV1Schema.safeParse({ ...alias, extra: 1 }).success).toBe(false);
  });

  it('takeItDownRequests — the retention marker is null until the sweep completes it', () => {
    const shape = TakeItDownRequestRootV1Schema.shape.retentionCompletedAt;
    expect(shape.safeParse(null).success).toBe(true);
    expect(shape.safeParse(123).success).toBe(true);
    expect(shape.safeParse(undefined).success).toBe(true);
    expect(shape.safeParse('done').success).toBe(false);
  });

  it('takeItDownRequests — removal completion is explicitly nullable while the backstop is pending', () => {
    const shape = TakeItDownRequestRootV1Schema.shape.removalCompletionOutcome;
    expect(shape.safeParse(null).success).toBe(true);
    expect(shape.safeParse(undefined).success).toBe(true);
    expect(shape.safeParse('completed').success).toBe(true);
    expect(shape.safeParse('not-a-real-outcome').success).toBe(false);
  });

  it('declares the remaining fields the writers store', () => {
    expect(Object.keys(ChatChannelAuthProjectionSchema.shape)).toContain('lastReconciledAt');
    const has = (template: keyof typeof COLLECTION_SCHEMAS, key: string) =>
      Object.keys((COLLECTION_SCHEMAS[template] as unknown as { shape: Record<string, unknown> }).shape).includes(key);
    expect(has('userProfiles/{userId}', 'statusUpdatedAt')).toBe(true);
    expect(has('userProfiles/{userId}', 'statusUpdatedBy')).toBe(true);
    const statusUpdatedBy = (COLLECTION_SCHEMAS['userProfiles/{userId}'] as unknown as { shape: Record<string, { safeParse(value: unknown): { success: boolean } }> }).shape.statusUpdatedBy;
    expect(statusUpdatedBy.safeParse('system:autoHashLock').success).toBe(true);
    expect(statusUpdatedBy.safeParse('admin-uid').success).toBe(true);
    expect(statusUpdatedBy.safeParse('').success).toBe(false);
    expect(statusUpdatedBy.safeParse(null).success).toBe(false);
    expect(has('userProfiles/{userId}/privateData/{userId}', 'squareStreetzAgreementsVersion')).toBe(true);
    expect(has('auditionBoard/{auditionId}', 'closedAt')).toBe(true);
    expect(has('commissionListings/{commissionListingId}', 'closedAt')).toBe(true);
  });
});

describe('second registry completion batch', () => {
  const closure = {
    outcome: 'founded' as const,
    resolutionSummary: 'Verified removal obligation.',
    closedByUid: 'admin-1',
    closedAt: 10,
  };

  it('binds strict NCII closure and reopen events at the exact canonical path', () => {
    const path = 'nciiCases/{caseId}/closureEvents/{eventId}' as const;
    expect(COLLECTION_SCHEMAS[path]).toBe(NciiCaseClosureEventV1Schema);
    expect(PATH_BUILDERS.nciiCaseClosureEvent('case-1', 'closure-r3')).toEqual([
      'nciiCases', 'case-1', 'closureEvents', 'closure-r3',
    ]);
    expect(NciiCaseClosureEventV1Schema.safeParse({ kind: 'caseClosed', revision: 3, closure, at: 10 }).success).toBe(true);
    expect(NciiCaseClosureEventV1Schema.safeParse({ kind: 'caseReopened', revision: 4, reasonInternal: 'New evidence arrived.', actorId: 'admin-2', at: 11 }).success).toBe(true);
    expect(NciiCaseClosureEventV1Schema.safeParse({ kind: 'caseClosed', revision: 3, closure, at: 10, actorId: 'extra' }).success).toBe(false);
    expect(NciiCaseClosureEventV1Schema.safeParse({ kind: 'caseReopened', revision: 4, reasonInternal: '', actorId: 'admin-2', at: 11 }).success).toBe(false);
  });

  it('accepts the new report, task, account-command, cascade, and fanout writer fields', () => {
    const report = {
      schemaVersion: 1,
      reportId: 'report-1',
      reporterUid: 'reporter-1',
      reason: 'Spam' as const,
      resolvedTarget: {
        schemaVersion: 1,
        itemType: 'square-streetz-post' as const,
        canonicalParentPath: 'squareStreetzFeed/activePosts',
        canonicalItemId: 'post-1',
        revision: 1,
        ownerUid: 'owner-1',
        ownerBlockKey: 'user:owner-1',
        locator: { kind: 'squarePost', postId: 'post-1' },
        resolvedAt: 1,
      },
      snapshotRef: 'snapshot-1',
      canonicalTargetKey: 'target-1',
      status: 'actioned' as const,
      createdAt: 1,
      updatedAt: 2,
      escalatedToCase: 'case-1',
    };
    expect(ProtectedReportRootV1Schema.safeParse(report).success).toBe(true);
    expect(ProtectedReportRootV1Schema.safeParse({ ...report, escalatedToCase: '' }).success).toBe(false);

    expect(AdminTaskDocSchema.safeParse({
      taskType: 'userReport', taskId: 'group-1', originalPath: 'activeReportGroups/group-1', status: 'completed',
      checkoutDetails: null, summary: 'done', priority: 1, createdAt: 1, lastUpdatedAt: 2, supersededByCaseId: 'case-1',
    }).success).toBe(true);
    expect(AdminTaskDocSchema.safeParse({
      taskType: 'userReport', taskId: 'group-1', originalPath: 'activeReportGroups/group-1', status: 'completed',
      checkoutDetails: null, summary: 'done', priority: 1, createdAt: 1, lastUpdatedAt: 2, supersededByCaseId: '',
    }).success).toBe(false);

    expect(AccountActionCommandV1Schema.safeParse({
      schemaVersion: 1, caseId: 'case-1', targetUid: 'user-1', action: 'ban', source: 'autoHash', status: 'deadLetter',
      commandId: 'command-1', attemptCount: 8, nextAttemptAt: 9, deadLetterAt: 10, createdAt: 1, updatedAt: 10,
    }).success).toBe(true);
    expect(AccountActionCommandV1Schema.safeParse({
      schemaVersion: 1, caseId: 'case-1', targetUid: 'user-1', action: 'ban', source: 'autoHash', status: 'deadLetter',
      commandId: 'command-1', attemptCount: 8, nextAttemptAt: 9, deadLetterAt: 'later', createdAt: 1, updatedAt: 10,
    }).success).toBe(false);

    expect(ModerationCascadeChangedDocSchema.safeParse({
      docPath: 'hallItems/h1', entityType: 'hallItem', fieldPath: 'hidden', previousValue: false, newValue: true,
      restored: false, restoreSkipped: 'directHidden',
    }).success).toBe(true);
    expect(ModerationCascadeChangedDocSchema.safeParse({
      docPath: 'hallItems/h1', entityType: 'hallItem', fieldPath: 'hidden', previousValue: false, newValue: true,
      restored: false, restoreSkipped: 'other',
    }).success).toBe(false);

    const fanout = {
      jobId: 'event-1:admin_announcement', schemaVersion: 1, notificationType: 'admin_announcement', eventId: 'event-1',
      priority: 1 as const, payload: {}, phases: [{ selector: {}, cursor: null, done: false }], phaseIndex: 0,
      revision: 0, status: 'pending' as const, attemptCount: 0, nextAttemptAt: 1, lastError: null,
      createdAt: 1, updatedAt: 1, completedAt: null, deadLetteredAt: null,
      requestId: 'request-1', actorUid: 'admin-1', payloadHash: 'hash-1',
    };
    expect(NotificationFanoutJobSchema.safeParse(fanout).success).toBe(true);
    const { requestId: _requestId, actorUid: _actorUid, payloadHash: _payloadHash, ...withoutProvenance } = fanout;
    expect(NotificationFanoutJobSchema.safeParse(withoutProvenance).success).toBe(true);
    expect(NotificationFanoutJobSchema.safeParse({ ...withoutProvenance, requestId: 'request-1' }).success).toBe(false);
    expect(NotificationFanoutJobSchema.safeParse({ ...withoutProvenance, actorUid: 'admin-1' }).success).toBe(false);
    expect(NotificationFanoutJobSchema.safeParse({ ...withoutProvenance, payloadHash: 'hash-1' }).success).toBe(false);
    expect(NotificationFanoutJobSchema.safeParse({ ...withoutProvenance, requestId: 'request-1', actorUid: 'admin-1' }).success).toBe(false);
    expect(NotificationFanoutJobSchema.safeParse({ ...withoutProvenance, requestId: 'request-1', payloadHash: 'hash-1' }).success).toBe(false);
    expect(NotificationFanoutJobSchema.safeParse({ ...withoutProvenance, actorUid: 'admin-1', payloadHash: 'hash-1' }).success).toBe(false);
    expect(NotificationFanoutJobSchema.safeParse({ ...fanout, payloadHash: '' }).success).toBe(false);
  });

  it('declares Hall moderation and edge-sync fields on every writer target', () => {
    const edge = {
      moderatedAt: 2, edgeSyncState: 'processing' as const, edgeSyncProcessingAt: 2,
      edgeSyncOp: 'block' as const, edgeSyncAssetIds: ['asset-1'], edgeSyncError: 'retrying', edgeSyncFailedAt: 3,
    };
    expect(PublishedHallItemSchema.safeParse({
      hallItemId: 'h1', workProjectId: 'w1', workProjectType: 'Tales', status: 'published', createdOn: 1,
      hallWingType: 'entertainment', hidden: false, moderatedAt: 2,
      coverSquareAssetId: 'a1', coverPosterAssetId: 'a2', coverCinematicAssetId: 'a3',
    }).success).toBe(true);
    expect(PublishedChapterSchema.safeParse({ uid: 'c1', title: 'Chapter', order: 1, description: 'd', content: 'c', photoAssetId: 'asset-0', hidden: false, ...edge }).success).toBe(true);
    expect(PublishedTuneTrackSchema.safeParse({ uid: 't1', title: 'Track', order: 1, audioAssetId: 'asset-1', photoAssetId: 'asset-0', hidden: false, ...edge }).success).toBe(true);
    expect(PublishedTelevisionEpisodeSchema.safeParse({ uid: 'e1', title: 'Episode', order: 1, videoAssetId: 'asset-1', photoAssetId: 'asset-0', hidden: false, ...edge }).success).toBe(true);
    expect(PublishedChapterSchema.safeParse({ uid: 'c1', title: 'Chapter', order: 1, description: 'd', content: 'c', photoAssetId: 'asset-0', hidden: false, edgeSyncState: 'settled' }).success).toBe(false);
    for (const schema of [
      PublishedHallItemSchema,
      PublishedChapterSchema,
      PublishedTuneTrackSchema,
      PublishedTelevisionEpisodeSchema,
    ]) {
      expect(Object.keys(schema.shape)).toContain('moderatedAt');
    }
    for (const schema of [PublishedChapterSchema, PublishedTuneTrackSchema, PublishedTelevisionEpisodeSchema]) {
      for (const key of ['edgeSyncState', 'edgeSyncProcessingAt', 'edgeSyncOp', 'edgeSyncAssetIds', 'edgeSyncError', 'edgeSyncFailedAt']) {
        expect(Object.keys(schema.shape)).toContain(key);
      }
    }
    for (const key of ['edgeSyncState', 'edgeSyncProcessingAt', 'edgeSyncOp', 'edgeSyncAssetIds', 'edgeSyncError', 'edgeSyncFailedAt']) {
      expect(Object.keys(PublishedHallItemSchema.shape)).not.toContain(key);
    }
    // The clear runner writes moderatedAt to these six live source shapes as well.
    for (const template of [
      'allWorkProjects/{workProjectId}/workProjectTales/{taleId}',
      'allWorkProjects/{workProjectId}/workProjectTales/{taleId}/taleChapters/{chapterId}',
      'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}',
      'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}/tuneTracks/{trackId}',
      'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}',
      'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}/televisionEpisodes/{episodeId}',
    ] as const) {
      const schema = COLLECTION_SCHEMAS[template] as unknown as { shape: Record<string, unknown> };
      expect(Object.keys(schema.shape)).toContain('moderatedAt');
    }
  });
});

describe('notification history — the archived snapshot is the STORED card', () => {
  // What both materializers write: the delivery ledger and processBatchHelper build the
  // active card WITHOUT `id` (it is the deterministic document id).
  const storedCard = {
    type: 'guild_invite',
    dedupKey: 'guildInvite_inv-1',
    category: 'user',
    targetUserId: 'user-1',
    title: 'Guild invite',
    message: 'You were invited.',
    count: 1,
    latestActorIds: ['actor-1'],
    targetPath: '/profile/invites',
    metadata: { inviteId: 'inv-1' },
    seenAt: 0,
    activityGeneration: 'gen-1',
    createdAt: 1,
    updatedAt: 1,
  };
  const expireAt = { seconds: 2, nanoseconds: 0, toMillis: () => 2000, toDate: () => new Date(2000) };
  const history = {
    archiveOccurrenceId: 'occ-1',
    requestId: 'request-1',
    payloadHash: 'hash-1',
    activeId: 'active-1',
    observedActivityGeneration: 'gen-1',
    category: 'user',
    audienceScope: 'user:user-1',
    archivedSnapshot: storedCard,
    archivedAt: 5,
    expireAt,
  };

  it('parses a real history document for BOTH lanes — snapshot without id, activeId at the top level', () => {
    for (const template of [
      'adminNotificationHistory/{notificationId}',
      'userProfiles/{userId}/notificationHistory/{notificationId}',
    ] as const) {
      expect(COLLECTION_SCHEMAS[template]).toBe(NotificationHistoryDocSchema);
      expect(COLLECTION_SCHEMAS[template].safeParse(history).success).toBe(true);
    }
    // Shared-admin archives stamp the archiver.
    expect(NotificationHistoryDocSchema.safeParse({
      ...history,
      category: 'admin',
      audienceScope: 'shared',
      archivedSnapshot: { ...storedCard, targetUserId: null },
      handledBy: 'admin-1',
    }).success).toBe(true);
    expect(NotificationHistoryDocSchema.safeParse({ ...history, archivedAt: 'later' }).success).toBe(false);
  });

  it('keeps ONE definition of the card — the snapshot is the card minus its document id', () => {
    expect(Object.keys(StoredNotificationCardSchema.shape)).not.toContain('id');
    expect(Object.keys(StoredNotificationCardSchema.shape).sort()).toEqual(
      Object.keys(NotificationDocSchema.shape).filter((k) => k !== 'id').sort(),
    );
    expect(NotificationHistoryDocSchema.shape.archivedSnapshot).toBe(StoredNotificationCardSchema);
  });

  it('leaves the active-card bindings unchanged — id stays required and doc-id-injected', () => {
    for (const template of [
      'activeUserNotifications/{notificationId}',
      'activeAdminNotifications/{notificationId}',
    ] as const) {
      expect(COLLECTION_SCHEMAS[template]).toBe(NotificationDocSchema);
      expect(COLLECTION_DOC_ID_FIELDS[template]).toBe('id');
      // The drift check injects `{ id: doc.id, ...data }` before validating.
      expect(COLLECTION_SCHEMAS[template].safeParse(storedCard).success).toBe(false);
      expect(COLLECTION_SCHEMAS[template].safeParse({ id: 'active-1', ...storedCard }).success).toBe(true);
    }
  });
});

describe('NCII evidence deletion-verification — its own subcollection, never takeItDownActions', () => {
  const disposition = { bucket: 'app-bucket', key: 'nciiEvidence/req-1/file-1', method: 'delete', verifiedAt: 5, result: 'gone' } as const;
  const ACTIONS = 'takeItDownRequests/{requestId}/takeItDownActions/{actionId}';
  const DISPOSITION = 'takeItDownRequests/{requestId}/takeItDownEvidenceDisposition/{evidenceId}';

  it('binds the dedicated subcollection to the shared disposition shape', () => {
    expect(COLLECTION_SCHEMAS[DISPOSITION]).toBe(SafetyEvidenceDispositionV1Schema);
    expect(PATH_BUILDERS.takeItDownEvidenceDisposition('req-1', 'ev-1')).toEqual(['takeItDownRequests', 'req-1', 'takeItDownEvidenceDisposition', 'ev-1']);
  });

  it('accepts the current status the retention sweep records, gone or leftover', () => {
    expect(COLLECTION_SCHEMAS[DISPOSITION].safeParse(disposition).success).toBe(true);
    expect(COLLECTION_SCHEMAS[DISPOSITION].safeParse({ ...disposition, result: 'leftover', leftoverDetail: 'object still present after delete attempt' }).success).toBe(true);
    expect(COLLECTION_SCHEMAS[DISPOSITION].safeParse({ ...disposition, extra: 1 }).success).toBe(false);
  });

  it('keeps takeItDownActions bound to action rows ONLY', () => {
    expect(COLLECTION_SCHEMAS[ACTIONS]).toBe(TakeItDownRequestActionV1Schema);
    expect(COLLECTION_SCHEMAS[ACTIONS].safeParse(disposition).success).toBe(false);
  });
});
