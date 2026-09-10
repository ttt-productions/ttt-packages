// Server-owned "archive all" job docs — `notificationArchiveAllJobs/{jobId}`.
//
// BACKEND-ONLY: Firestore rules deny all client access; the client learns a job's
// state only through the `getArchiveAllStatus` callable, which reads this doc
// server-side and returns the `ArchiveAllJobSnapshot` shape. A job replaces the
// browser clear-all loop: `enqueueArchiveAll` `.create()`s ONE deterministic row
// (idempotent per user+category+requestId), the bounded scheduled worker drains that
// ONE category's active cards (PER-TAB SCOPING — never all tabs) reusing the per-card
// archive helper, and advances `archived` + the terminal `state`. Dead-letter/retry
// bookkeeping mirrors the fanout ledger; an unresolved job is never TTL'd.
//
// See ttt-prod docs/design/notification-system.md (Archive contract).

import { z } from 'zod';
import { NotificationCategorySchema } from '../schemas/notification.js';
import { systemRoleSchema } from '../schemas/atoms.js';
import { FirestoreTimestampSchema } from './firestore-primitives.js';

/**
 * Job lifecycle state — mirrors `ArchiveAllJobSnapshot['state']` (the poller's union; the
 * callable maps this doc field straight through). `in-progress` is the drain-in-flight
 * state; the three terminals are `complete` (category fully drained), `incomplete`
 * (attempt budget exhausted with cards still active — retry/dead-letter), and `failed`
 * (unexpected fault).
 */
export const NotificationArchiveAllJobStateSchema = z.enum(['in-progress', 'complete', 'incomplete', 'failed']);
export type NotificationArchiveAllJobState = z.infer<typeof NotificationArchiveAllJobStateSchema>;

/**
 * Persisted archive-all job doc. `.passthrough()` so future additive fields don't fail
 * read-side validation (mirrors the fanout ledger schema).
 */
export const NotificationArchiveAllJobSchema = z
  .object({
    schemaVersion: z.literal(1),
    jobId: z.string().min(1),
    /** Owner uid — the ONLY user whose active cards this job archives. */
    userId: z.string().min(1),
    /** The tab/category this job is scoped to (PER-TAB SCOPING — the worker touches only this). */
    category: NotificationCategorySchema,
    /**
     * The enqueuing admin's resolved role, persisted ONLY for admin-category jobs so the
     * worker can reconstruct a faithful `adminReview` actor for each per-card
     * `notification.adminArchived` audit event (enqueue already admin-gated the create, so
     * the authority was verified). Null / absent for personal jobs.
     */
    actorSystemRole: systemRoleSchema.nullable().optional(),
    state: NotificationArchiveAllJobStateSchema,
    /** Monotonic claim revision preventing concurrent inline/scheduled drains. */
    revision: z.number().int().nonnegative(),
    /** Monotonic count of cards archived so far. */
    archived: z.number().int().nonnegative(),
    /** Human-readable failure reason (only on `failed`). */
    error: z.string().nullable(),
    // ── retry / dead-letter bookkeeping (mirrors the fanout ledger) ──
    attemptCount: z.number().int().nonnegative(),
    /** Due-worker predicate: the worker only picks up a job with `nextAttemptAt <= now`. */
    nextAttemptAt: z.number().int().nonnegative(),
    deadLettered: z.boolean(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    completedAt: z.number().int().nullable(),
    deadLetteredAt: z.number().int().nullable(),
    /**
     * Native-TTL reaper stamp (ARCH-105 exception): a real Firestore Timestamp, stamped ONLY
     * on the terminal `complete` branch (30d), so a completed job is reaped and the
     * collection can't grow one dead doc per "Clear all" click forever. An UNRESOLVED job
     * (in-progress / incomplete / dead-lettered) is NEVER TTL'd, so the field is absent there.
     */
    expireAt: FirestoreTimestampSchema.optional(),
  })
  .passthrough();

export type NotificationArchiveAllJob = z.infer<typeof NotificationArchiveAllJobSchema>;
