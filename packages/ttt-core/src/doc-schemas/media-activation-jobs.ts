import { z } from 'zod';
import { StructuredErrorSchema } from '@ttt-productions/edge-protocol-core';
import { FileOriginSchema } from '../media/file-origin.js';
import { HALL_LIBRARY_SUB_ITEM_FILE_ORIGINS } from '../media/hall-library-target-fields.js';
import { FirestoreTimestampSchema } from './firestore-primitives.js';
import { MediaPublicationKindSchema, MediaServingAuthorityRecordSchema } from './media-assets.js';

export const MediaActivationJobStatusSchema = z.enum([
  'pending',
  'authorityApplied',
  'complete',
  'deadLetter',
]);
export type MediaActivationJobStatus = z.infer<typeof MediaActivationJobStatusSchema>;

const MediaActivationJobFieldsSchema = z
  .object({
    jobId: z.string().min(1),
    schemaVersion: z.number().int().positive(),

    assetId: z.string().min(1),
    pendingMediaId: z.string().min(1),

    authorityVersion: z.number().int().nonnegative(),
    payloadHash: z.string().min(1),
    authorityPayload: MediaServingAuthorityRecordSchema,

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

export const MediaActivationJobSchema = z.discriminatedUnion('publicationKind', [
  MediaActivationJobFieldsSchema.extend({
    publicationKind: z.literal('workContentMedia'),
    fileOrigin: FileOriginSchema.extract(HALL_LIBRARY_SUB_ITEM_FILE_ORIGINS),
  }),
  MediaActivationJobFieldsSchema.extend({
    publicationKind: MediaPublicationKindSchema.exclude(['workContentMedia']),
    fileOrigin: FileOriginSchema,
  }),
]);
export type MediaActivationJob = z.infer<typeof MediaActivationJobSchema>;
