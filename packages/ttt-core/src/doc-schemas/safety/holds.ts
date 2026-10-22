import { z } from 'zod';
import {
  SafetyHoldResourceTypeSchema,
  SafetyHoldClassSchema,
  SafetyCommandKindSchema,
  TargetLocatorKindSchema,
} from './foundation.js';

export const SafetyHoldRefStateSchema = z.enum(['active', 'released']);
export type SafetyHoldRefState = z.infer<typeof SafetyHoldRefStateSchema>;

export const SafetyHoldRefV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    resourceType: SafetyHoldResourceTypeSchema,
    resourceId: z.string().min(1),
    resourceKeyHash: z.string().min(1),
    canonicalResourceKey: z.string().min(1),
    ownerUid: z.string().min(1).optional(),
    blocksDeletion: z.boolean(),
    blocksAnonymization: z.boolean(),
    blocksReplacementCleanup: z.boolean(),
    state: SafetyHoldRefStateSchema,
    holdClass: SafetyHoldClassSchema,
    createdAt: z.number(),
    releasedAt: z.number().optional(),
    releaseReason: z.string().optional(),
    sourceRequestId: z.string().min(1).optional(),
    expiresAt: z.number().optional(),
    releaseCommandId: z.string().min(1).optional(),
  })
  .strict();
export type SafetyHoldRefV1 = z.infer<typeof SafetyHoldRefV1Schema>;

export const SafetyHoldResourceV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    resourceKeyHash: z.string().min(1),
    canonicalResourceKey: z.string().min(1),
    activeRefCount: z.number(),
    blocksDeletionCount: z.number(),
    blocksAnonymizationCount: z.number(),
    blocksReplacementCleanupCount: z.number(),
    updatedAt: z.number(),
  })
  .strict();
export type SafetyHoldResourceV1 = z.infer<typeof SafetyHoldResourceV1Schema>;

export const SafetyResourceCommandStateSchema = z.enum([
  'authorized',
  'executing',
  'verifiedRemoved',
  'failed',
]);
export type SafetyResourceCommandState = z.infer<typeof SafetyResourceCommandStateSchema>;

export const SafetyResourceCommandAuthorizedForV1Schema = z
  .object({
    requestIds: z.array(z.string().min(1)).max(64),
    caseId: z.string().min(1).optional(),
    linkedCaseIds: z.array(z.string().min(1)).max(32).optional(),
    requestIdsOverflowed: z.boolean().optional(),
  })
  .strict();
export type SafetyResourceCommandAuthorizedForV1 = z.infer<
  typeof SafetyResourceCommandAuthorizedForV1Schema
>;

export const SafetyResourceCommandV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    resourceKeyHash: z.string().min(1),
    canonicalResourceKey: z.string().min(1),
    commandId: z.string().min(1),
    commandKind: SafetyCommandKindSchema,
    resourceType: TargetLocatorKindSchema,
    authorizedFor: SafetyResourceCommandAuthorizedForV1Schema,
    bypassHoldRefIds: z.array(z.string().min(1)).max(256),
    bypassHoldRefsOverflowed: z.boolean().optional(),
    state: SafetyResourceCommandStateSchema,
    attemptCount: z.number(),
    leaseOwner: z.string().min(1).optional(),
    leaseExpiresAt: z.number().optional(),
    lastErrorCode: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    verifiedRemovedAt: z.number().optional(),
  })
  .strict();
export type SafetyResourceCommandV1 = z.infer<typeof SafetyResourceCommandV1Schema>;

export const SafetyResourceCommandAuthorizedRequestV1Schema = z
  .object({
    requestId: z.string().min(1),
    caseId: z.string().min(1).optional(),
    addedAt: z.number(),
  })
  .strict();
export type SafetyResourceCommandAuthorizedRequestV1 = z.infer<
  typeof SafetyResourceCommandAuthorizedRequestV1Schema
>;

export const SafetyResourceCommandBypassRefV1Schema = z
  .object({
    refId: z.string().min(1),
    holdClass: SafetyHoldClassSchema,
    addedAt: z.number(),
  })
  .strict();
export type SafetyResourceCommandBypassRefV1 = z.infer<
  typeof SafetyResourceCommandBypassRefV1Schema
>;
