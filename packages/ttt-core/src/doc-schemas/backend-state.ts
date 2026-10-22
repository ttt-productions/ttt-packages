import { z } from 'zod';
import { SWEEP_STATE_MAX_DEFERRED, SWEEP_STATE_NAMES } from '../constants/scheduled-jobs.js';
import { SweepRollingCursorSchema } from './sweep-cursor.js';
import {
  ChildSafetyNcmecCompletionChannelSchema,
  ChildSafetyNcmecCompletionProofTypeSchema,
} from './safety/case.js';

export const OperatorStepUpSchema = z.object({
  secret: z.string(),
  status: z.enum(['pending', 'active']),
  grantExpiresAt: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  confirmedAt: z.number().optional(),
  failedAttempts: z.number().int().nonnegative().optional(),
  lockedUntil: z.number().nonnegative().optional(),
});
export type OperatorStepUp = z.infer<typeof OperatorStepUpSchema>;

export const SweepStateNameSchema = z.enum(SWEEP_STATE_NAMES);

export const SweepDeferredRowSchema = z
  .object({
    key: z.string().min(1),
    value: z.number().optional(),
    nextAttemptAt: z.number().int().nonnegative(),
    attemptCount: z.number().int().positive(),
  })
  .strict();
export type SweepDeferredRow = z.infer<typeof SweepDeferredRowSchema>;

// Firebase Auth lists accounts only by page token, with no key to resume after; a token it no
// longer accepts restarts the lap.
export const SweepAuthScanLapSchema = z
  .object({
    pageToken: z.string().min(1),
    lapStartedAt: z.number().int().nonnegative(),
  })
  .strict();
export type SweepAuthScanLap = z.infer<typeof SweepAuthScanLapSchema>;

export const SweepStateSchema = z
  .object({
    fullScanLastRunAt: z.number().optional(),
    fullScanLap: SweepAuthScanLapSchema.optional(),
    rollingCursor: SweepRollingCursorSchema.optional(),
    deferred: z.array(SweepDeferredRowSchema).max(SWEEP_STATE_MAX_DEFERRED).optional(),
    updatedAt: z.number(),
  })
  .superRefine((val, ctx) => {
    const seen = new Set<string>();
    (val.deferred ?? []).forEach((row, index) => {
      if (seen.has(row.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['deferred', index, 'key'],
          message: 'a row is deferred at most once',
        });
      }
      seen.add(row.key);
    });
  });
export type SweepState = z.infer<typeof SweepStateSchema>;

export const NcmecCompletionProofRecordV1Schema = z.object({
  caseId: z.string(),
  submissionId: z.string(),
  channel: ChildSafetyNcmecCompletionChannelSchema,
  proofType: ChildSafetyNcmecCompletionProofTypeSchema,
  portalReceiptArtifactId: z.string(),
  proofText: z.string().optional(),
  ncmecReportId: z.string(),
  recordedByUid: z.string(),
  recordedAt: z.number(),
});
export type NcmecCompletionProofRecordV1 = z.infer<typeof NcmecCompletionProofRecordV1Schema>;

export const NcmecPortalReceiptArtifactV1Schema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string(),
  submissionId: z.string(),
  evidenceVaultKey: z.string(),
  objectGeneration: z.string(),
  sha256: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  capturedAt: z.number(),
  registeredByUid: z.string(),
  description: z.string().optional(),
});
export type NcmecPortalReceiptArtifactV1 = z.infer<typeof NcmecPortalReceiptArtifactV1Schema>;

export const NcmecPortalCorrectionRecordV1Schema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string(),
  ncmecReportId: z.string(),
  correctionFiledAt: z.number(),
  reason: z.string(),
  recordedByUid: z.string(),
  recordedAt: z.number(),
});
export type NcmecPortalCorrectionRecordV1 = z.infer<typeof NcmecPortalCorrectionRecordV1Schema>;
