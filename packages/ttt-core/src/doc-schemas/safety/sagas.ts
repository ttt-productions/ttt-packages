import { z } from 'zod';
import { NcmecSubmissionStateSchema } from './foundation.js';

export const QuarantineStatusSchema = z.enum(['running', 'quarantineComplete', 'deadLetter']);
export type QuarantineStatus = z.infer<typeof QuarantineStatusSchema>;

export const QuarantinePhaseSchema = z.enum([
  'holdCommitted',
  'sourceManifestCaptured',
  'servingDenyRequested',
  'servingDenyVerified',
  'evidenceCopying',
  'evidenceVerified',
  'activeCopiesRemovalRequested',
  'activeCopiesRemovalVerified',
  'quarantineComplete',
]);
export type QuarantinePhase = z.infer<typeof QuarantinePhaseSchema>;

export const QuarantineSagaJobV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    quarantineStatus: QuarantineStatusSchema,
    phase: QuarantinePhaseSchema,
    phaseVersion: z.number(),
    commandId: z.string().min(1),
    relatedAssetIds: z.array(z.string().min(1)).max(256),
    attemptCount: z.number(),
    nextAttemptAt: z.number(),
    leaseOwner: z.string().min(1).optional(),
    leaseExpiresAt: z.number().optional(),
    lastError: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    completedAt: z.number().optional(),
  })
  .strict();
export type QuarantineSagaJobV1 = z.infer<typeof QuarantineSagaJobV1Schema>;

export const QuarantineSagaRelatedAssetV1Schema = z
  .object({
    rootIngestId: z.string().min(1),
    addedAt: z.number(),
  })
  .strict();
export type QuarantineSagaRelatedAssetV1 = z.infer<typeof QuarantineSagaRelatedAssetV1Schema>;

export const NcmecSubmissionJobV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    submissionId: z.string().min(1),
    state: NcmecSubmissionStateSchema,
    commandId: z.string().min(1),
    attemptCount: z.number(),
    nextAttemptAt: z.number(),
    leaseOwner: z.string().min(1).optional(),
    leaseExpiresAt: z.number().optional(),
    lastErrorCode: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    completedAt: z.number().optional(),
  })
  .strict();
export type NcmecSubmissionJobV1 = z.infer<typeof NcmecSubmissionJobV1Schema>;

export const AccountActionSchema = z.enum([
  'ban',
  'suspend',
  'watch',
  'safetyLocked',
  'reinstate',
  'none',
]);
export type AccountAction = z.infer<typeof AccountActionSchema>;

export const AccountActionSourceSchema = z.enum(['autoHash', 'operator']);
export type AccountActionSource = z.infer<typeof AccountActionSourceSchema>;

export const AccountActionStatusSchema = z.enum(['pending', 'applied', 'reverted', 'deadLetter']);
export type AccountActionStatus = z.infer<typeof AccountActionStatusSchema>;

export const AccountActionCommandV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    targetUid: z.string().min(1),
    action: AccountActionSchema,
    source: AccountActionSourceSchema,
    status: AccountActionStatusSchema,
    commandId: z.string().min(1),
    attemptCount: z.number(),
    nextAttemptAt: z.number(),
    leaseOwner: z.string().min(1).optional(),
    leaseExpiresAt: z.number().optional(),
    lastError: z.string().optional(),
    deadLetterAt: z.number().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    completedAt: z.number().optional(),
  })
  .strict();
export type AccountActionCommandV1 = z.infer<typeof AccountActionCommandV1Schema>;
