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

    // ===== Parent-publication dependency (the curated-audition absent-parent lane) =====
    // Some publications legitimately arrive before the parent document they attach to
    // exists. The canonical case is an auditionMedia CURATED-lane ENTRY job: the creator
    // uploads the prompt and its option videos in one batch, and the audition document is
    // written by the PROMPT's publish — so an option's publish can run first. That is an
    // expected race, not a fault, and it must not burn the job's normal retry budget.
    //
    // `parentKey` is the id of the publication that must exist first — for the curated
    // audition lane, the `auditionId`. It is set at job-build time ONLY for jobs minted on
    // an absent-parent identity lane; a prompt job never carries it, and neither does an
    // ordinary open-mode entry (its upload surface requires the audition page to already
    // exist, so a missing parent there IS a real failure). The runner may treat a
    // parent-absent publication as a park (rather than a failure) only when this durable key
    // is present, and the prompt's publish uses it to wake its parked siblings.
    //
    // `parentWaitStartedAt` stamps the FIRST parent-absent occurrence and never moves
    // forward, so the bounded wait window is measured from one durable start.
    //
    // BOTH are optional: rows written before this field pair existed still parse unchanged.
    parentKey: z.string().min(1).optional(),
    parentWaitStartedAt: FirestoreTimestampSchema.optional(),

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
