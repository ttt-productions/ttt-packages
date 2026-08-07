import { describe, it, expect } from 'vitest';
import {
  NcmecPortalCorrectionRecordV1Schema,
  NcmecPortalReceiptArtifactV1Schema,
} from '../src/doc-schemas/backend-state';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';
import { PATH_BUILDERS } from '../src/paths/path-builders';
import { COLLECTIONS, NESTED_SUBCOLLECTIONS } from '../src/paths/collections';

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
