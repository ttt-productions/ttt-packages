import { describe, it, expect } from 'vitest';
import {
  NciiPolicyConfigV1Schema,
  NCII_EVIDENCE_MAX_FILE_BYTES,
  PrivilegedReviewerSecurityProfileV1Schema,
  type NciiPolicyConfigV1,
  type PrivilegedReviewerSecurityProfileV1,
} from '../src/doc-schemas/ncii/config.js';

const config: NciiPolicyConfigV1 = {
  policyVersion: 'ncii.2026-06-23.v1',
  requesterPiiRetentionDays: 1,
  evidenceRetentionDays: 1,
  blockedHashRetentionPolicy: 'indefiniteUntilReversed',
  allowedEvidenceMimeTypes: ['image/png'],
  maxEvidenceFileBytes: 1,
  maxEvidenceFilesPerRequest: 1,
  maxEvidenceTotalBytesPerRequest: 1,
  uploadReservationMinutes: 1,
  abandonedUploadCleanupHours: 1,
  tempHoldInitialHours: 1,
  tempHoldPendingValidityExtensionHours: 1,
  tempHoldMaxTotalHours: 1,
  incompleteInvalidReleaseDelayHours: 1,
  intakeRateLimitWindowSeconds: 1,
  intakeRateLimitMaxPerIp: 1,
  idempotencyWindowHours: 1,
  maxEvidenceDecodePixels: 1,
  maxEvidenceImageDimension: 1,
  maxEvidenceVideoFrames: 1,
  maxEvidenceVideoDurationSec: 1,
  evidenceParserTimeoutSec: 1,
  evidenceScanCpuBudgetMs: 1,
  evidenceScanMemoryBudgetMb: 1,
  rejectArchiveAndPolyglotPayloads: true,
  approvedBy: 'operatorLaunchDefault',
};

describe('NciiPolicyConfigV1Schema (`_serverData/nciiPolicy`)', () => {
  it('accepts a complete policy config', () => {
    expect(NciiPolicyConfigV1Schema.safeParse(config).success).toBe(true);
  });

  it('carries no lawyer-approval gate: nothing reads one, and uploads are not blocked on it', () => {
    expect(Object.keys(NciiPolicyConfigV1Schema.shape)).not.toContain('counselApproved');
    expect(NciiPolicyConfigV1Schema.safeParse({ ...config, counselApproved: false }).success).toBe(
      false,
    );
  });
});

describe('NCII evidence size cap', () => {
  it('is 100 MiB per file', () => {
    expect(NCII_EVIDENCE_MAX_FILE_BYTES).toBe(104_857_600);
  });
});

const reviewerProfile: PrivilegedReviewerSecurityProfileV1 = {
  requiredSecondFactor: 'passkeyWebAuthn',
  privilegedReauthTtlSeconds: 1,
  privilegedSessionDeviceBound: false,
  twoStepReauthCapabilities: ['evidenceReveal'],
  recoveryCodeCount: 1,
  recoveryCodeUse: 'auditedHighSeverity+forcesReenroll+criticalAlarm',
  allowPrivilegedSessionRevocation: false,
  everyInvocationAudited: false,
};

describe('PrivilegedReviewerSecurityProfileV1Schema (`_serverData/privilegedReviewerSecurity`)', () => {
  it('accepts a complete profile', () => {
    expect(PrivilegedReviewerSecurityProfileV1Schema.safeParse(reviewerProfile).success).toBe(true);
  });

  it('refuses a capability outside the declared set', () => {
    expect(
      PrivilegedReviewerSecurityProfileV1Schema.safeParse({
        ...reviewerProfile,
        twoStepReauthCapabilities: ['somethingElse'],
      }).success,
    ).toBe(false);
  });
});
