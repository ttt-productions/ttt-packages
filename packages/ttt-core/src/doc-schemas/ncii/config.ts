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
