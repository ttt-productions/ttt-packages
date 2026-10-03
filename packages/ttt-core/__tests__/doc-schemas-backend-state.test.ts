import { describe, it, expect } from 'vitest';
import {
  NcmecCompletionProofRecordV1Schema,
  NcmecPortalCorrectionRecordV1Schema,
  NcmecPortalReceiptArtifactV1Schema,
  SweepStateNameSchema,
  SweepStateSchema,
} from '../src/doc-schemas/backend-state';
import { SweepRollingCursorSchema } from '../src/doc-schemas/sweep-cursor';
import { SWEEP_STATE_MAX_DEFERRED, SWEEP_STATE_NAMES } from '../src/constants/scheduled-jobs';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';
import { PATH_BUILDERS } from '../src/paths/path-builders';
import { COLLECTIONS, NESTED_SUBCOLLECTIONS, SPECIAL_DOCS } from '../src/paths/collections';

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
  it('accepts the orphan-registration sweep state: the privateData reaper lap and the full-scan stamp', () => {
    const state = {
      rollingCursor: {
        state: 'inLap' as const,
        // A collection-group query resumes after the full document path.
        afterKey: 'userProfiles/u1/privateData/u1',
        lapStartedAt: 1_700_000_000_000,
      },
      fullScanLastRunAt: 1_700_000_500_000,
      updatedAt: 1_700_000_500_000,
    };
    expect(SweepStateSchema.parse(state)).toEqual(state);
  });

  it('keeps no second cursor beside the rolling cursor', () => {
    const parsed = SweepStateSchema.parse({
      reaperLastRunAt: 1_700_000_000_000,
      reaperCursorPath: 'userProfiles/u1/privateData/u1',
      updatedAt: 1_700_000_500_000,
    });
    expect(parsed).toEqual({ updatedAt: 1_700_000_500_000 });
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

  it('keeps the cadence stamps numeric epoch ms', () => {
    expect(SweepStateSchema.safeParse({ updatedAt: 1, fullScanLastRunAt: '1' }).success).toBe(false);
  });

  it('holds the rows a pass deferred, each once, at most SWEEP_STATE_MAX_DEFERRED of them', () => {
    const row = (n: number) => ({ key: `asset-${n}`, value: 1_700_000_000_000 - n, nextAttemptAt: 1, attemptCount: 1 });
    const full = Array.from({ length: SWEEP_STATE_MAX_DEFERRED }, (_, i) => row(i + 1));
    expect(SweepStateSchema.safeParse({ deferred: full, updatedAt: 1 }).success).toBe(true);
    expect(SweepStateSchema.safeParse({ deferred: [...full, row(0)], updatedAt: 1 }).success).toBe(false);
    expect(SweepStateSchema.safeParse({ deferred: [row(1), row(1)], updatedAt: 1 }).success).toBe(false);
    expect(SweepStateSchema.safeParse({ deferred: [{ ...row(1), attemptCount: 0 }], updatedAt: 1 }).success).toBe(false);
    expect(SweepStateSchema.safeParse({ deferred: [{ ...row(1), key: '' }], updatedAt: 1 }).success).toBe(false);
  });

  it('names every pass that keeps a persisted position, the safety backstops and reconcilers included', () => {
    for (const name of [
      'reconcilePublicUsers',
      'hallMediaReaperAssetPhase',
      'quarantineEnqueueBackstop',
      'ncmecEnqueueBackstop',
      'staleSafetyCaseAlertSweep',
      'csamStrandedProcessing',
      'nciiStrandedProcessing',
    ]) {
      expect(SweepStateNameSchema.safeParse(name).success, name).toBe(true);
    }
  });

  it('gives the refund-approval reconciler its own position, so a row that keeps failing can leave its window', () => {
    expect(SweepStateNameSchema.safeParse('reconcilePledgeRefundApprovals').success).toBe(true);
    expect(PATH_BUILDERS.sweepState('reconcilePledgeRefundApprovals')).toEqual([
      COLLECTIONS.SWEEP_STATE,
      'reconcilePledgeRefundApprovals',
    ]);
  });

  it('gives each crossover leg reconcile query its own position, so the two legs never share a cursor', () => {
    const legPasses = ['crossoverServingDenyReconcile', 'crossoverPhotoDnaReconcile'] as const;
    for (const name of legPasses) {
      expect(SweepStateNameSchema.safeParse(name).success, name).toBe(true);
      expect(PATH_BUILDERS.sweepState(name)).toEqual([COLLECTIONS.SWEEP_STATE, name]);
    }
    expect(new Set(legPasses).size).toBe(legPasses.length);
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

  it('names each sweep-state doc once, from the one list the path builder is typed on', () => {
    expect(new Set(SWEEP_STATE_NAMES).size).toBe(SWEEP_STATE_NAMES.length);
    expect(SweepStateNameSchema.options).toEqual([...SWEEP_STATE_NAMES]);
    expect(SweepStateNameSchema.safeParse('someOtherSweep').success).toBe(false);
    // @ts-expect-error a name outside SWEEP_STATE_NAMES is not a sweep-state doc id
    PATH_BUILDERS.sweepState('someOtherSweep');
  });
});

describe('SweepRollingCursorSchema', () => {
  const lapStartedAt = 1_700_000_000_000;

  it('keeps a Storage listing lap resuming after the last object name it moved past', () => {
    const cursor = { state: 'inLap' as const, afterKey: 'rejected/u1/pm-9', lapStartedAt };
    expect(SweepRollingCursorSchema.parse(cursor)).toEqual(cursor);
    expect(SweepStateSchema.parse({ rollingCursor: cursor, updatedAt: lapStartedAt + 1 })).toEqual({
      rollingCursor: cursor,
      updatedAt: lapStartedAt + 1,
    });
  });

  it("keeps a Firestore query lap resuming after the last row's ordered value and document id", () => {
    const cursor = { state: 'inLap' as const, afterKey: 'asset-201', afterValue: 1_699_000_000_000, lapStartedAt };
    expect(SweepRollingCursorSchema.parse(cursor)).toEqual(cursor);
  });

  it('never stores an ordered value without the key that breaks ties on it', () => {
    expect(
      SweepRollingCursorSchema.safeParse({ state: 'inLap', afterValue: 1_699_000_000_000, lapStartedAt }).success,
    ).toBe(false);
  });

  it('keeps an exhausted source as done, so the pass that exhausted it does not start page one again', () => {
    const done = { state: 'done' as const, lapStartedAt, lapCompletedAt: lapStartedAt + 60_000 };
    expect(SweepRollingCursorSchema.parse(done)).toEqual(done);
    expect(SweepRollingCursorSchema.safeParse({ ...done, afterKey: 'rejected/u1/pm-9' }).success).toBe(false);
  });

  it('rejects a lap that completed before it started', () => {
    expect(
      SweepRollingCursorSchema.safeParse({ state: 'done', lapStartedAt, lapCompletedAt: lapStartedAt - 1 }).success,
    ).toBe(false);
  });

  it('never stores an in-lap cursor without the key it resumes after', () => {
    expect(SweepRollingCursorSchema.safeParse({ state: 'inLap', lapStartedAt }).success).toBe(false);
    expect(SweepRollingCursorSchema.safeParse({ state: 'inLap', afterKey: '', lapStartedAt }).success).toBe(false);
  });

  it('stores its times as epoch milliseconds', () => {
    expect(
      SweepRollingCursorSchema.safeParse({ state: 'inLap', afterKey: 'k', lapStartedAt: '1700000000000' }).success,
    ).toBe(false);
  });

  it('leaves a sweep-state doc without a cursor valid — no lap has run yet', () => {
    expect(SweepStateSchema.parse({ updatedAt: lapStartedAt }).rollingCursor).toBeUndefined();
  });
});
