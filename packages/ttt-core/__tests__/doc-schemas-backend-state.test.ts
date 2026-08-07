import { describe, it, expect } from 'vitest';
import {
  NcmecCompletionProofRecordV1Schema,
  NcmecPortalCorrectionRecordV1Schema,
  NcmecPortalReceiptArtifactV1Schema,
  SweepStateSchema,
} from '../src/doc-schemas/backend-state';
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
        `${NESTED_SUBCOLLECTIONS.NCMEC_COMPLETION_PROOF}/${SPECIAL_DOCS.NCMEC_COMPLETION_PROOF_RECORD}`,
    );
  });

  it('uses the ARCH-104 compound subcollection name and a fixed singleton doc id', () => {
    expect(NESTED_SUBCOLLECTIONS.NCMEC_COMPLETION_PROOF).toBe('ncmecCompletionProof');
    expect(SPECIAL_DOCS.NCMEC_COMPLETION_PROOF_RECORD).toBe('record');
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
