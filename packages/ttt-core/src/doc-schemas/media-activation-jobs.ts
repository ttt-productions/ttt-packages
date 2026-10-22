import { z } from 'zod';
import { StructuredErrorSchema } from '@ttt-productions/edge-protocol-core';
import { FileOriginSchema } from '../media/file-origin.js';
import { FirestoreTimestampSchema } from './firestore-primitives.js';
import { MediaPublicationKindSchema, MediaServingAuthorityRecordSchema } from './media-assets.js';

export const MediaActivationJobStatusSchema = z.enum([
  'pending',
  'authorityApplied',
  'complete',
  'deadLetter',
]);
export type MediaActivationJobStatus = z.infer<typeof MediaActivationJobStatusSchema>;

export const MediaActivationJobSchema = z
  .object({
    jobId: z.string().min(1),
    schemaVersion: z.number().int().positive(),

    assetId: z.string().min(1),
    pendingMediaId: z.string().min(1),
    fileOrigin: FileOriginSchema,

    authorityVersion: z.number().int().nonnegative(),
    payloadHash: z.string().min(1),
    authorityPayload: MediaServingAuthorityRecordSchema,

    publicationKind: MediaPublicationKindSchema,
    publicationArgs: z.unknown(),

    status: MediaActivationJobStatusSchema,
    attemptCount: z.number().int().nonnegative(),
    nextAttemptAt: z.number().int().nonnegative(),
    lastError: StructuredErrorSchema.optional(),

    parentKey: z.string().min(1).optional(),
    parentWaitStartedAt: z.number().int().nonnegative().optional(),

    createdAt: z.number().int().nonnegative(),
    authorityAppliedAt: z.number().int().nonnegative().optional(),
    completedAt: z.number().int().nonnegative().optional(),
    deadLetteredAt: z.number().int().nonnegative().optional(),
    expireAt: FirestoreTimestampSchema.optional(),
  })
  .strict();
export type MediaActivationJob = z.infer<typeof MediaActivationJobSchema>;
