// squareAnnouncementJobs/{jobId} — durable outbox for AUTOMATIC Square Streetz
// announcements. The announcing domain enqueues a job in the SAME transaction as
// its state commit (commission accepted, new audition/commission/work-project,
// craft-skill create/delete, profile-picture update, …) instead of awaiting
// runManageSquareStreetzPost inside the callable; the outbox trigger worker
// drains the job and applies the announcement. Admin-SDK-only
// (`allow read, write: if false`); NO client access.
//
// jobId — DETERMINISTIC (collision over duplication): derived from the announcing
// action's natural key via `buildSquareAnnouncementJobId` below — the ONE canonical
// derivation (Rule 36); enqueue sites, the worker, and tests MUST call it, never
// hand-roll the template. The enqueue MUST use `.create()` at this id inside the
// announcing transaction, so a replayed/retried transaction COLLIDES with the
// already-enqueued job instead of duplicating the announcement.
//
// Timestamps follow the app-wide epoch-ms number convention (Date.now()). No
// native-TTL field on this doc — `dead` jobs are retained for operator replay.

import { z } from 'zod';
import { SquareStreetzPostTypeSchema } from './social.js';
import type { SquareStreetzPostType } from './social.js';
import type { SquareStreetzPostPayload } from '../types/social.js';

/**
 * The ONE canonical derivation of a Square announcement outbox job id (Rule 36 —
 * every enqueue site, the outbox worker, and tests derive from HERE, never a
 * hand-rolled template): `${announcementType}_${primaryDocId}`, where
 * `primaryDocId` is the announcing action's natural-key doc id (e.g.
 * `NEW_CRAFT_SKILL_${craftSkillId}`, `NEW_WORK_PROJECT_${workProjectId}`,
 * `COMMISSION_ACCEPTED_${commissionProposalId}`). Deterministic so a replayed
 * transaction's `.create()` collides instead of duplicating the announcement.
 */
export function buildSquareAnnouncementJobId(
  announcementType: SquareStreetzPostType,
  primaryDocId: string,
): string {
  return `${announcementType}_${primaryDocId}`;
}

/**
 * Payload half of the announcement input — exactly what the
 * runManageSquareStreetzPost dispatcher accepts: the canonical
 * SquareStreetzPostPayload plus the two dispatcher-level extras (`projectId`,
 * and the pattern-C pre-minted `postId` for USER_POST). Validated structurally
 * (a plain object) and TYPED precisely; the dispatcher re-validates domain
 * fields when the worker delivers (same posture as chatMessageOutbox.payload).
 */
export type SquareAnnouncementPayload = SquareStreetzPostPayload & {
  projectId?: string;
  postId?: string;
};

export const SquareAnnouncementPayloadSchema = z.custom<SquareAnnouncementPayload>(
  (v) => typeof v === 'object' && v !== null,
  { message: 'Expected a Square announcement payload object' },
);

/** The discriminated announcement input (`{ type, payload }`) the job carries. */
export const SquareAnnouncementInputSchema = z.object({
  type: SquareStreetzPostTypeSchema,
  payload: SquareAnnouncementPayloadSchema,
});
export type SquareAnnouncementInput = z.infer<typeof SquareAnnouncementInputSchema>;

export const SquareAnnouncementJobStatusSchema = z.enum([
  'pending', // enqueued; awaiting the outbox worker
  'processing', // claimed by a worker run
  'delivered', // announcement applied to the Streetz feed; terminal success
  'dead', // retries exhausted — retained for operator replay
]);
export type SquareAnnouncementJobStatus = z.infer<typeof SquareAnnouncementJobStatusSchema>;

export const SquareAnnouncementJobSchema = z
  .object({
    jobId: z.string().min(1),
    /** The exact runManageSquareStreetzPost input the worker dispatches. */
    announcement: SquareAnnouncementInputSchema,
    /** The announcing action's natural-key ids, keyed by field name (e.g.
     * `{ craftSkillId: '…' }`, `{ commissionListingId: '…', commissionProposalId: '…' }`) —
     * the same key(s) the deterministic jobId is derived from. */
    source: z.record(z.string(), z.string()),
    status: SquareAnnouncementJobStatusSchema,
    attemptCount: z.number().int().nonnegative(),
    lastError: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .strict();
export type SquareAnnouncementJob = z.infer<typeof SquareAnnouncementJobSchema>;
