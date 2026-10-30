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
    rosterRevision: revisionSchema,
    reconciledRosterRevision: appliedRevisionSchema,
    syncStatus: membershipRosterSyncStatusSchema,
    attemptCount: countSchema,
    nextAttemptAt: epochMsSchema,
    cursor: MembershipRosterSyncCursorSchema.optional(),
    failedAt: epochMsSchema.optional(),
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
