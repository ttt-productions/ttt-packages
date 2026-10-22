import { z } from 'zod';
import {
  NciiInternalStatusSchema,
  NciiChildSafetyLinkStatusSchema,
  NciiChildSafetyCrossoverSchema,
  SafetyCaseClosureV1Schema,
  TargetLocatorV1Schema,
} from '../safety/foundation.js';

export const NciiCaseLaneSchema = z.enum(['ncii', 'likeness']);
export type NciiCaseLane = z.infer<typeof NciiCaseLaneSchema>;

export const NciiCaseV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    revision: z.number(),
    lane: NciiCaseLaneSchema,
    internalStatus: NciiInternalStatusSchema,
    childSafetyLinkStatus: NciiChildSafetyLinkStatusSchema,
    crossover: NciiChildSafetyCrossoverSchema,
    childSafetyCaseId: z.string().min(1).optional(),
    nciiRemovalDeadlineAt: z.number().optional(),
    closure: SafetyCaseClosureV1Schema.optional(),
    chatMessageLocator: TargetLocatorV1Schema.optional(),
    contextResolutionPending: z.boolean().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .strict();
export type NciiCaseV1 = z.infer<typeof NciiCaseV1Schema>;

export const NciiCaseClosureEventV1Schema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('caseClosed'),
      revision: z.number(),
      closure: SafetyCaseClosureV1Schema,
      at: z.number(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('caseReopened'),
      revision: z.number(),
      reasonInternal: z.string().min(1),
      actorId: z.string().min(1),
      at: z.number(),
    })
    .strict(),
]);
export type NciiCaseClosureEventV1 = z.infer<typeof NciiCaseClosureEventV1Schema>;

export const NciiCaseAllegationLinkV1Schema = z
  .object({
    allegationId: z.string().min(1),
    linkedAt: z.number(),
    linkedByUid: z.string().min(1),
    reportId: z.string().min(1).optional(),
  })
  .strict();
export type NciiCaseAllegationLinkV1 = z.infer<typeof NciiCaseAllegationLinkV1Schema>;

export const NciiCaseRequestLinkV1Schema = z
  .object({
    requestId: z.string().min(1),
    linkedAt: z.number(),
    linkedByUid: z.string().min(1),
  })
  .strict();
export type NciiCaseRequestLinkV1 = z.infer<typeof NciiCaseRequestLinkV1Schema>;

export const NciiCaseRemovalActionMethodSchema = z.enum([
  'tombstone',
  'accountAction',
  'assetBlock',
]);
export type NciiCaseRemovalActionMethod = z.infer<typeof NciiCaseRemovalActionMethodSchema>;

export const NciiCaseRemovalActionV1Schema = z
  .object({
    at: z.number(),
    actorId: z.string().min(1),
    surface: z.string(),
    targetItemType: z.string(),
    targetItemId: z.string().min(1),
    method: NciiCaseRemovalActionMethodSchema,
    result: z.string(),
  })
  .strict();
export type NciiCaseRemovalActionV1 = z.infer<typeof NciiCaseRemovalActionV1Schema>;

export const NciiBlockedHashSourceSchema = z.enum([
  'requestEvidence',
  'platformOriginal',
  'platformCopy',
  'knownIdenticalCopy',
]);
export type NciiBlockedHashSource = z.infer<typeof NciiBlockedHashSourceSchema>;

export const NciiBlockedHashStatusSchema = z.enum(['active', 'reversed']);
export type NciiBlockedHashStatus = z.infer<typeof NciiBlockedHashStatusSchema>;

export const NciiBlockedHashV1Schema = z
  .object({
    hashId: z.string().min(1),
    algorithm: z.literal('sha256'),
    digest: z.string().min(1),
    source: NciiBlockedHashSourceSchema,
    createdAt: z.number(),
    createdByUid: z.string().min(1),
    status: NciiBlockedHashStatusSchema,
    reversedAt: z.number().optional(),
    reversedByUid: z.string().min(1).optional(),
    reversalReason: z.string().optional(),
  })
  .strict();
export type NciiBlockedHashV1 = z.infer<typeof NciiBlockedHashV1Schema>;
