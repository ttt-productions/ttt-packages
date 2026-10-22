import { z } from 'zod';
import { TargetLocatorV1Schema } from '../safety/foundation.js';

export const NciiTemporaryHoldStatusSchema = z.enum(['active', 'extended', 'released']);
export type NciiTemporaryHoldStatus = z.infer<typeof NciiTemporaryHoldStatusSchema>;

export const NciiTemporaryHoldV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    holdId: z.string().min(1),
    requestId: z.string().min(1),
    caseId: z.string().min(1).optional(),
    resourceType: z.literal('nciiTemporaryTarget'),
    safetyHoldRefId: z.string().min(1),
    target: TargetLocatorV1Schema,
    rootLineageRef: z.string().min(1).optional(),
    contentHashes: z.array(z.string().min(1)).max(16).optional(),
    ownerUid: z.string().min(1).optional(),
    capturedRevision: z.number().optional(),
    capturedGeneration: z.string().min(1).optional(),
    snapshotRef: z.string().min(1),
    purpose: z.literal('nciiTemporaryPreservation'),
    createdAt: z.number(),
    expiresAt: z.number(),
    status: NciiTemporaryHoldStatusSchema,
    releasedAt: z.number().optional(),
    releaseReason: z.string().optional(),
  })
  .strict();
export type NciiTemporaryHoldV1 = z.infer<typeof NciiTemporaryHoldV1Schema>;
