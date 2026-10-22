import { z } from 'zod';
import {
  NciiTargetSurfaceSchema,
  NciiTargetOutcomeSchema,
  TargetLocatorV1Schema,
} from '../safety/foundation.js';

export const NciiRemovalPhaseSchema = z.enum([
  'resolveTargets',
  'discoverKnownCopies',
  'denyServing',
  'removeOrTombstone',
  'writeHashBlocks',
  'verifyRemoval',
  'complete',
]);
export type NciiRemovalPhase = z.infer<typeof NciiRemovalPhaseSchema>;

export const NciiRemovalStatusSchema = z.enum([
  'pending',
  'running',
  'retryableFailure',
  'deadLetter',
  'completed',
]);
export type NciiRemovalStatus = z.infer<typeof NciiRemovalStatusSchema>;

export const NciiDiscoveryCursorV1Schema = z
  .object({
    phase: NciiRemovalPhaseSchema,
    lastSurface: NciiTargetSurfaceSchema,
    lastCursorToken: z.string().min(1).optional(),
  })
  .strict();
export type NciiDiscoveryCursorV1 = z.infer<typeof NciiDiscoveryCursorV1Schema>;

export const NciiRemovalJobV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    jobId: z.string().min(1),
    caseId: z.string().min(1),
    requestId: z.string().min(1),
    generation: z.number(),
    phase: NciiRemovalPhaseSchema,
    status: NciiRemovalStatusSchema,
    cursor: NciiDiscoveryCursorV1Schema.optional(),
    leaseOwner: z.string().min(1).optional(),
    leaseExpiresAt: z.number().optional(),
    attemptCount: z.number(),
    nextAttemptAt: z.number().optional(),
    lastErrorCode: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    completedAt: z.number().optional(),
    deadLetterAt: z.number().optional(),
  })
  .strict();
export type NciiRemovalJobV1 = z.infer<typeof NciiRemovalJobV1Schema>;

export const NciiTargetServingDenyStateSchema = z.enum(['pending', 'denied', 'failed']);
export type NciiTargetServingDenyState = z.infer<typeof NciiTargetServingDenyStateSchema>;

export const NciiTargetRemovalStateSchema = z.enum(['pending', 'removed', 'tombstoned', 'failed']);
export type NciiTargetRemovalState = z.infer<typeof NciiTargetRemovalStateSchema>;

export const NciiTargetVerificationStateSchema = z.enum(['pending', 'verifiedGone', 'leftover']);
export type NciiTargetVerificationState = z.infer<typeof NciiTargetVerificationStateSchema>;

export const NciiRemovalTargetV1Schema = z
  .object({
    targetKeyHash: z.string().min(1),
    locator: TargetLocatorV1Schema,
    surface: NciiTargetSurfaceSchema,
    expectedGeneration: z.number().optional(),
    servingDenyState: NciiTargetServingDenyStateSchema,
    removalState: NciiTargetRemovalStateSchema,
    verificationState: NciiTargetVerificationStateSchema,
    outcome: NciiTargetOutcomeSchema,
    attemptCount: z.number(),
    leaseOwner: z.string().min(1).optional(),
    leaseExpiresAt: z.number().optional(),
    lastErrorCode: z.string().optional(),
    updatedAt: z.number(),
  })
  .strict();
export type NciiRemovalTargetV1 = z.infer<typeof NciiRemovalTargetV1Schema>;
