// mediaActivationJobs/{jobId} — the durable job that drives the three-stage
// finalize (prepare → activate → publish) and its crash recovery. Created in the
// SAME private prepare transaction as mediaAssets/{assetId}; attempted
// immediately and re-driven by a scheduled recovery worker. Server-only
// (`allow read, write: if false`); NO client access.
//
// See ttt-prod docs/design/media-assets-and-protected-serving.md — the design owner
// for this job, the three-stage finalize, the typed publication adapters, and the
// reconcile pass.
//
// jobId = hash('media-activation', assetId, authorityVersion)  (edge-protocol-core
// canonical hash family; collision-safe per the frozen ID rules).

import { z } from 'zod';
import { StructuredErrorSchema } from '@ttt-productions/edge-protocol-core';
import { FileOriginSchema } from '../media/file-origin.js';
import { FirestoreTimestampSchema } from './firestore-primitives.js';
import {
  MediaPublicationKindSchema,
  MediaServingAuthorityRecordSchema,
} from './media-assets.js';

export const MediaActivationJobStatusSchema = z.enum([
  'pending', // call the signed activation endpoint, verify the ack, CAS → authorityApplied
  'authorityApplied', // call the typed publication adapter, on success CAS → complete
  'complete', // owner published; TTL eligible
  'deadLetter', // retries exhausted — retained for operator replay; user sees publication-failed
]);
export type MediaActivationJobStatus = z.infer<typeof MediaActivationJobStatusSchema>;

export const MediaActivationJobSchema = z
  .object({
    jobId: z.string().min(1),
    schemaVersion: z.number().int().positive(),

    assetId: z.string().min(1),
    pendingMediaId: z.string().min(1),
    fileOrigin: FileOriginSchema,

    // The exact serving record this job activates — the DO must ack this exact
    // version + payloadHash before publication may proceed.
    authorityVersion: z.number().int().nonnegative(),
    payloadHash: z.string().min(1),
    authorityPayload: MediaServingAuthorityRecordSchema,

    // Typed publication adapter. `publicationArgs` is forward-validated by the
    // per-kind adapter registry — NEVER arbitrary Firestore
    // writes; the job carries typed data, not serialized writes.
    publicationKind: MediaPublicationKindSchema,
    publicationArgs: z.unknown(),

    status: MediaActivationJobStatusSchema,
    attemptCount: z.number().int().nonnegative(),
    nextAttemptAt: FirestoreTimestampSchema,
    lastError: StructuredErrorSchema.optional(),

    createdAt: FirestoreTimestampSchema,
    authorityAppliedAt: FirestoreTimestampSchema.optional(),
    completedAt: FirestoreTimestampSchema.optional(),
    deadLetteredAt: FirestoreTimestampSchema.optional(),
    // TTL set ONLY at `complete`; NEVER on pending/authorityApplied/deadLetter.
    // Replay clears terminal/TTL fields (frozen matrix rule).
    expireAt: FirestoreTimestampSchema.optional(),
  })
  .strict();
export type MediaActivationJob = z.infer<typeof MediaActivationJobSchema>;
