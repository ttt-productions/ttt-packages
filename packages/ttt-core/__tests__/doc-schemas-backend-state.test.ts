import { describe, it, expect } from 'vitest';
import {
  HallMediaReaperCursorSchema,
  NcmecCompletionProofRecordV1Schema,
  NcmecPortalCorrectionRecordV1Schema,
  NcmecPortalReceiptArtifactV1Schema,
  PublicUsersReconcilerCursorSchema,
  SweepStateSchema,
} from '../src/doc-schemas/backend-state';
import { HALL_MEDIA_REAPER_MAX_DEFERRED } from '../src/constants/scheduled-jobs';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';
import { PATH_BUILDERS } from '../src/paths/path-builders';
import { COLLECTIONS, NESTED_SUBCOLLECTIONS, SPECIAL_DOCS } from '../src/paths/collections';

describe('HallMediaReaperCursorSchema', () => {
  const cursor = { createdAtCursor: 1_700_000_000_000, updatedAt: 1_702_000_000_000 };
  const entry = (n: number) => ({
    mediaAssetId: `asset-${n}`,
    createdAt: cursor.createdAtCursor - n,
    nextAttemptAt: cursor.updatedAt + 24 * 60 * 60 * 1000,
    attemptCount: 1,
  });

  it('parses a cursor written before the deferred set existed', () => {
    expect(HallMediaReaperCursorSchema.parse(cursor)).toEqual(cursor);
  });

  it('parses a cursor holding deferred candidates', () => {
    const withDeferred = { ...cursor, deferred: [entry(1), { ...entry(2), attemptCount: 4 }] };
    expect(HallMediaReaperCursorSchema.parse(withDeferred)).toEqual(withDeferred);
  });

  it(`holds at most HALL_MEDIA_REAPER_MAX_DEFERRED (${HALL_MEDIA_REAPER_MAX_DEFERRED}) candidates`, () => {
    const full = Array.from({ length: HALL_MEDIA_REAPER_MAX_DEFERRED }, (_, i) => entry(i + 1));
    expect(HallMediaReaperCursorSchema.safeParse({ ...cursor, deferred: full }).success).toBe(true);
    const over = [...full, entry(HALL_MEDIA_REAPER_MAX_DEFERRED + 1)];
    expect(HallMediaReaperCursorSchema.safeParse({ ...cursor, deferred: over }).success).toBe(false);
  });

  it('defers each asset at most once', () => {
    const duplicate = { ...entry(2), mediaAssetId: entry(1).mediaAssetId };
    expect(HallMediaReaperCursorSchema.safeParse({ ...cursor, deferred: [entry(1), duplicate] }).success).toBe(false);
  });

  it('holds only candidates at or below the cursor that moved past them', () => {
    const atCursor = { ...entry(1), createdAt: cursor.createdAtCursor };
    expect(HallMediaReaperCursorSchema.safeParse({ ...cursor, deferred: [atCursor] }).success).toBe(true);
    const ahead = { ...entry(1), createdAt: cursor.createdAtCursor + 1 };
    expect(HallMediaReaperCursorSchema.safeParse({ ...cursor, deferred: [ahead] }).success).toBe(false);
  });

  it('counts at least the pass that deferred a candidate', () => {
    for (const attemptCount of [0, -1, 1.5]) {
      expect(HallMediaReaperCursorSchema.safeParse({ ...cursor, deferred: [{ ...entry(1), attemptCount }] }).success).toBe(
        false,
      );
    }
  });

  it('keeps every deferred time epoch ms (ARCH-105)', () => {
    const timestamp = { seconds: 1_702_086_400, nanoseconds: 0 };
    for (const field of ['createdAt', 'nextAttemptAt'] as const) {
      expect(
        HallMediaReaperCursorSchema.safeParse({ ...cursor, deferred: [{ ...entry(1), [field]: timestamp }] }).success,
      ).toBe(false);
    }
  });

  it('requires every deferred field, a non-empty id, and nothing undeclared', () => {
    for (const field of ['mediaAssetId', 'createdAt', 'nextAttemptAt', 'attemptCount'] as const) {
      const { [field]: _omitted, ...rest } = entry(1);
      expect(HallMediaReaperCursorSchema.safeParse({ ...cursor, deferred: [rest] }).success).toBe(false);
    }
    expect(HallMediaReaperCursorSchema.safeParse({ ...cursor, deferred: [{ ...entry(1), mediaAssetId: '' }] }).success).toBe(
      false,
    );
    expect(
      HallMediaReaperCursorSchema.safeParse({ ...cursor, deferred: [{ ...entry(1), ownerId: 'hall-1' }] }).success,
    ).toBe(false);
  });

  it('binds the registry path and the path builder to the same location', () => {
    expect(COLLECTION_SCHEMAS['_systemData/hallMediaReaperCursor']).toBe(HallMediaReaperCursorSchema);
    expect(PATH_BUILDERS.hallMediaReaperCursor().join('/')).toBe('_systemData/hallMediaReaperCursor');
  });
});

describe('NcmecPortalReceiptArtifactV1Schema', () => {
  // The exact record recordNcmecPortalReceiptArtifact writes: the operator-supplied vault key
  // plus the server-verified storage facts read from the vault object before the transaction.
  const artifact = {
    schemaVersion: 1,
    caseId: 'case-1',
    submissionId: 'sub-1',
    evidenceVaultKey: 'evidence/case-1/receipt.pdf',
    objectGeneration: '1737000000000001',
    sha256: 'a'.repeat(64),
    contentType: 'application/pdf',
    sizeBytes: 12345,
    capturedAt: 1_700_000_000_000,
    registeredByUid: 'operator-1',
  };

  it('accepts the record the operator callable writes, with and without the optional description', () => {
    expect(NcmecPortalReceiptArtifactV1Schema.safeParse(artifact).success).toBe(true);
    expect(
      NcmecPortalReceiptArtifactV1Schema.safeParse({ ...artifact, description: 'Portal receipt PDF' })
        .success,
    ).toBe(true);
  });

  it('requires the storage facts that make the artifact verifiable later', () => {
    for (const field of ['evidenceVaultKey', 'objectGeneration', 'sha256'] as const) {
      const { [field]: _omitted, ...rest } = artifact;
      expect(NcmecPortalReceiptArtifactV1Schema.safeParse(rest).success).toBe(false);
    }
  });

  it('pins schemaVersion to 1 rather than accepting any number', () => {
    expect(NcmecPortalReceiptArtifactV1Schema.safeParse({ ...artifact, schemaVersion: 2 }).success).toBe(
      false,
    );
  });
});

describe('NcmecPortalCorrectionRecordV1Schema', () => {
  // The exact record recordNcmecPortalCorrection writes.
  const correction = {
    schemaVersion: 1,
    caseId: 'case-1',
    ncmecReportId: 'NCMEC-12345',
    correctionFiledAt: 1_700_000_000_000,
    reason: 'Subject re-assessed as adult.',
    recordedByUid: 'operator-1',
    recordedAt: 1_700_000_001_000,
  };

  it('accepts the record the operator callable writes', () => {
    expect(NcmecPortalCorrectionRecordV1Schema.safeParse(correction).success).toBe(true);
  });

  it('requires the portal report id — the correction is worthless without the filed report it corrects', () => {
    const { ncmecReportId: _omitted, ...rest } = correction;
    expect(NcmecPortalCorrectionRecordV1Schema.safeParse(rest).success).toBe(false);
  });

  it('requires the operator reason and recorder, so the disposition gate is never anonymous', () => {
    for (const field of ['reason', 'recordedByUid'] as const) {
      const { [field]: _omitted, ...rest } = correction;
      expect(NcmecPortalCorrectionRecordV1Schema.safeParse(rest).success).toBe(false);
    }
  });
});

describe('Portal-artifact registry + path bindings', () => {
  it('binds both portal-artifact paths in COLLECTION_SCHEMAS', () => {
    expect(COLLECTION_SCHEMAS['childSafetyCases/{caseId}/portalReceiptArtifacts/{artifactId}']).toBe(
      NcmecPortalReceiptArtifactV1Schema,
    );
    expect(COLLECTION_SCHEMAS['childSafetyCases/{caseId}/ncmecPortalCorrections/{correctionId}']).toBe(
      NcmecPortalCorrectionRecordV1Schema,
    );
  });

  it('the path builders address exactly the registered paths', () => {
    expect(PATH_BUILDERS.childSafetyPortalReceiptArtifact('c1', 'art1').join('/')).toBe(
      `${COLLECTIONS.CHILD_SAFETY_CASES}/c1/${NESTED_SUBCOLLECTIONS.NCMEC_PORTAL_RECEIPT_ARTIFACTS}/art1`,
    );
    expect(PATH_BUILDERS.childSafetyNcmecPortalCorrection('c1', 'corr1').join('/')).toBe(
      `${COLLECTIONS.CHILD_SAFETY_CASES}/c1/${NESTED_SUBCOLLECTIONS.NCMEC_PORTAL_CORRECTIONS}/corr1`,
    );
  });
});

describe('NcmecCompletionProofRecordV1Schema', () => {
  // The exact record commitNcmecCompletion writes create-if-absent in the completion transaction.
  const proof = {
    caseId: 'case-1',
    submissionId: 'sub-1',
    channel: 'manualPortal',
    proofType: 'portalConfirmation',
    portalReceiptArtifactId: 'artifact-1',
    ncmecReportId: 'NCMEC-12345',
    recordedByUid: 'operator-1',
    recordedAt: 1_700_000_000_000,
  };

  it('accepts the record the completion transaction writes, with and without the optional note', () => {
    expect(NcmecCompletionProofRecordV1Schema.safeParse(proof).success).toBe(true);
    expect(
      NcmecCompletionProofRecordV1Schema.safeParse({ ...proof, proofText: 'Confirmed on the portal.' })
        .success,
    ).toBe(true);
  });

  it('requires the artifact binding — an unbound proof would be an arbitrary operator string', () => {
    const { portalReceiptArtifactId: _omitted, ...rest } = proof;
    expect(NcmecCompletionProofRecordV1Schema.safeParse(rest).success).toBe(false);
  });

  it('requires the portal-assigned report id — there is no "filed, number pending" grace', () => {
    const { ncmecReportId: _omitted, ...rest } = proof;
    expect(NcmecCompletionProofRecordV1Schema.safeParse(rest).success).toBe(false);
  });

  it('constrains channel and proofType to the canonical submission unions', () => {
    expect(NcmecCompletionProofRecordV1Schema.safeParse({ ...proof, channel: 'ispwsApi' }).success).toBe(
      false,
    );
    expect(
      NcmecCompletionProofRecordV1Schema.safeParse({ ...proof, proofType: 'reportDoneResponse' }).success,
    ).toBe(false);
  });

  it('binds the registry path and the path builder to the same location', () => {
    expect(
      COLLECTION_SCHEMAS[
        'childSafetyCases/{caseId}/ncmecSubmissions/{submissionId}/ncmecCompletionProof/record'
      ],
    ).toBe(NcmecCompletionProofRecordV1Schema);
    expect(PATH_BUILDERS.childSafetyNcmecCompletionProof('c1', 's1').join('/')).toBe(
      `${COLLECTIONS.CHILD_SAFETY_CASES}/c1/${NESTED_SUBCOLLECTIONS.CHILD_SAFETY_NCMEC_SUBMISSIONS}/s1/` +
        `${NESTED_SUBCOLLECTIONS.NCMEC_COMPLETION_PROOF}/${SPECIAL_DOCS.RECORD}`,
    );
  });

  it('uses the ARCH-104 compound subcollection name and a fixed singleton doc id', () => {
    expect(NESTED_SUBCOLLECTIONS.NCMEC_COMPLETION_PROOF).toBe('ncmecCompletionProof');
    expect(SPECIAL_DOCS.RECORD).toBe('record');
    // One proof per submission — the builder takes no doc id.
    expect(PATH_BUILDERS.childSafetyNcmecCompletionProof('c1', 's1')).toHaveLength(6);
  });
});

describe('SweepStateSchema', () => {
  it('accepts the orphan-registration sweep state, which carries all three fields', () => {
    expect(
      SweepStateSchema.safeParse({
        reaperLastRunAt: 1_700_000_000_000,
        reaperCursorPath: 'userProfiles/u1/privateData/u1',
        fullScanLastRunAt: 1_700_000_500_000,
        updatedAt: 1_700_000_500_000,
      }).success,
    ).toBe(true);
  });

  it('accepts the reconcile sweep state, which carries only the full-scan stamp', () => {
    expect(
      SweepStateSchema.safeParse({ fullScanLastRunAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000 })
        .success,
    ).toBe(true);
  });

  it('accepts a first-write doc with no pass having run yet', () => {
    expect(SweepStateSchema.safeParse({ updatedAt: 1_700_000_000_000 }).success).toBe(true);
  });

  it('requires updatedAt — a sweep-state doc with no stamp cannot gate a cadence', () => {
    expect(SweepStateSchema.safeParse({ fullScanLastRunAt: 1 }).success).toBe(false);
  });

  it('keeps the cadence stamps numeric epoch ms and the cursor a path string', () => {
    expect(SweepStateSchema.safeParse({ updatedAt: 1, fullScanLastRunAt: '1' }).success).toBe(false);
    expect(SweepStateSchema.safeParse({ updatedAt: 1, reaperCursorPath: 12 }).success).toBe(false);
  });

  it('binds the registry path and the path builder to the same location', () => {
    expect(COLLECTION_SCHEMAS['sweepState/{sweepName}']).toBe(SweepStateSchema);
    expect(PATH_BUILDERS.sweepState('orphanRegistrationCleanup')).toEqual([
      COLLECTIONS.SWEEP_STATE,
      'orphanRegistrationCleanup',
    ]);
    expect(PATH_BUILDERS.sweepState('reconcileAccountStatus').join('/')).toBe(
      `${COLLECTIONS.SWEEP_STATE}/reconcileAccountStatus`,
    );
  });
});

describe('PublicUsersReconcilerCursorSchema', () => {
  it('accepts the first-write cursor, where the empty string means start from the beginning', () => {
    expect(
      PublicUsersReconcilerCursorSchema.safeParse({ profileIdCursor: '', updatedAt: 1 }).success,
    ).toBe(true);
  });

  it('accepts a mid-sweep cursor naming the last cleared userProfiles document id', () => {
    expect(
      PublicUsersReconcilerCursorSchema.safeParse({
        profileIdCursor: 'user-abc',
        updatedAt: 1_700_000_000_000,
      }).success,
    ).toBe(true);
  });

  it('requires updatedAt — a cursor doc with no stamp cannot evidence a pass', () => {
    expect(PublicUsersReconcilerCursorSchema.safeParse({ profileIdCursor: 'user-abc' }).success).toBe(
      false,
    );
  });

  it('binds the registry path and the path builder to the same location', () => {
    expect(COLLECTION_SCHEMAS['_systemData/publicUsersReconcilerCursor']).toBe(
      PublicUsersReconcilerCursorSchema,
    );
    expect(PATH_BUILDERS.publicUsersReconcilerCursor()).toEqual([
      COLLECTIONS.SYSTEM_DATA,
      SPECIAL_DOCS.PUBLIC_USERS_RECONCILER_CURSOR,
    ]);
    expect(PATH_BUILDERS.publicUsersReconcilerCursor().join('/')).toBe(
      '_systemData/publicUsersReconcilerCursor',
    );
  });
});
