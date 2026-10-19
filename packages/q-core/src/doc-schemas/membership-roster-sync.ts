// `membershipRosterSyncs/{teamMembershipId}` — one team membership's durable obligation to bring
// its team's open game rosters in line with it (QUALITY-104, BACKEND-302).
//
// Every change to a membership — made, removed, or linked — advances `rosterRevision` in the same
// transaction as the change, so a committed membership can never lose its roster work. The roster
// core raises `reconciledRosterRevision` to the revision it finished; the obligation is outstanding
// while it is lower. The document outlives a deleted membership, so a removal is still reconciled,
// and it is keyed by the membership id, so no second id format exists (ARCH-109). Backend-only.

import { z } from 'zod';
import { MAX_ROSTER_SYNC_FAILURE_MESSAGE_LENGTH } from '../constants/business.js';
import { FAILED_ROSTER_SYNC_STATUS, RECONCILED_ROSTER_SYNC_STATUS } from '../types/unions.js';
import {
  appliedRevisionSchema,
  countSchema,
  epochMsSchema,
  gameIdSchema,
  leagueIdSchema,
  membershipRosterSyncStatusSchema,
  revisionSchema,
  teamIdSchema,
  userIdSchema,
} from './atoms.js';

// Where a run that stopped part-way resumes: the last game it finished for this revision. A cursor
// for an older revision is ignored, because a newer change re-reconciles every open game.
export const MembershipRosterSyncCursorSchema = z.strictObject({
  rosterRevision: revisionSchema,
  afterGameId: gameIdSchema,
});
export type MembershipRosterSyncCursor = z.infer<typeof MembershipRosterSyncCursorSchema>;

export const MembershipRosterSyncSchema = z
  .object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    userId: userIdSchema,
    // Advanced by every change to the membership; the first change writes 1.
    rosterRevision: revisionSchema,
    // The revision the roster core last finished; 0 before the first finish.
    reconciledRosterRevision: appliedRevisionSchema,
    syncStatus: membershipRosterSyncStatusSchema,
    // Runs of the worker at the current revision that ended in a failure.
    attemptCount: countSchema,
    // The earliest moment the worker takes the obligation again.
    nextAttemptAt: epochMsSchema,
    cursor: MembershipRosterSyncCursorSchema.optional(),
    // When its retries ran out: present exactly while the obligation is failed.
    failedAt: epochMsSchema.optional(),
    // The last failed run's message, kept while it retries and while it is failed; a finished run or
    // an admin's retry clears it.
    lastFailureMessage: z.string().max(MAX_ROSTER_SYNC_FAILURE_MESSAGE_LENGTH).optional(),
    updatedAt: epochMsSchema,
  })
  .refine((sync) => sync.reconciledRosterRevision <= sync.rosterRevision, {
    message: 'A roster obligation cannot be reconciled past its own revision.',
    path: ['reconciledRosterRevision'],
  })
  .refine(
    (sync) =>
      (sync.syncStatus === RECONCILED_ROSTER_SYNC_STATUS) ===
      (sync.reconciledRosterRevision === sync.rosterRevision),
    {
      message: 'An obligation is reconciled exactly when its reconciled revision is its revision.',
      path: ['syncStatus'],
    },
  )
  .refine(
    (sync) => (sync.syncStatus === FAILED_ROSTER_SYNC_STATUS) === (sync.failedAt !== undefined),
    {
      message: 'An obligation carries `failedAt` exactly while it is failed.',
      path: ['failedAt'],
    },
  );
export type MembershipRosterSync = z.infer<typeof MembershipRosterSyncSchema>;
