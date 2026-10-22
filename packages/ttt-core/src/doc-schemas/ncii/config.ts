import { z } from 'zod';
import { MIB } from '../../constants/byte-units.js';

export const NciiBlockedHashRetentionPolicySchema = z.literal('indefiniteUntilReversed');
export type NciiBlockedHashRetentionPolicy = z.infer<typeof NciiBlockedHashRetentionPolicySchema>;

export const NciiPolicyConfigV1Schema = z
  .object({
    policyVersion: z.literal('ncii.2026-06-23.v1'),
    requesterPiiRetentionDays: z.number(),
    evidenceRetentionDays: z.number(),
    blockedHashRetentionPolicy: NciiBlockedHashRetentionPolicySchema,
    allowedEvidenceMimeTypes: z.array(z.string().min(1)),
    maxEvidenceFileBytes: z.number(),
    maxEvidenceFilesPerRequest: z.number(),
    maxEvidenceTotalBytesPerRequest: z.number(),
    uploadReservationMinutes: z.number(),
    abandonedUploadCleanupHours: z.number(),
    tempHoldInitialHours: z.number(),
    tempHoldPendingValidityExtensionHours: z.number(),
    tempHoldMaxTotalHours: z.number(),
    incompleteInvalidReleaseDelayHours: z.number(),
    intakeRateLimitWindowSeconds: z.number(),
    intakeRateLimitMaxPerIp: z.number(),
    idempotencyWindowHours: z.number(),
    maxEvidenceDecodePixels: z.number(),
    maxEvidenceImageDimension: z.number(),
    maxEvidenceVideoFrames: z.number(),
    maxEvidenceVideoDurationSec: z.number(),
    evidenceParserTimeoutSec: z.number(),
    evidenceScanCpuBudgetMs: z.number(),
    evidenceScanMemoryBudgetMb: z.number(),
    rejectArchiveAndPolyglotPayloads: z.boolean(),
    approvedBy: z.literal('operatorLaunchDefault'),
  })
  .strict();
export type NciiPolicyConfigV1 = z.infer<typeof NciiPolicyConfigV1Schema>;

export const NCII_EVIDENCE_MAX_FILE_BYTES = 100 * MIB;

export const PrivilegedReviewerSecondFactorSchema = z.literal('passkeyWebAuthn');
export type PrivilegedReviewerSecondFactor = z.infer<typeof PrivilegedReviewerSecondFactorSchema>;

export const PrivilegedTwoStepReauthCapabilitySchema = z.enum([
  'evidenceReveal',
  'ncmecCredentialUse',
  'reverseHashBlock',
  'legalDisposition',
  'falsePositiveCorrection',
  'ncmecManualFallback',
]);
export type PrivilegedTwoStepReauthCapability = z.infer<
  typeof PrivilegedTwoStepReauthCapabilitySchema
>;

export const PrivilegedReviewerSecurityProfileV1Schema = z
  .object({
    requiredSecondFactor: PrivilegedReviewerSecondFactorSchema,
    privilegedReauthTtlSeconds: z.number(),
    privilegedSessionDeviceBound: z.boolean(),
    twoStepReauthCapabilities: z.array(PrivilegedTwoStepReauthCapabilitySchema),
    recoveryCodeCount: z.number(),
    recoveryCodeUse: z.literal('auditedHighSeverity+forcesReenroll+criticalAlarm'),
    allowPrivilegedSessionRevocation: z.boolean(),
    everyInvocationAudited: z.boolean(),
  })
  .strict();
export type PrivilegedReviewerSecurityProfileV1 = z.infer<
  typeof PrivilegedReviewerSecurityProfileV1Schema
>;
