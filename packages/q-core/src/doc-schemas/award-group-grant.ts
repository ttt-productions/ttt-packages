// `awardGroupGrants/{grantId}` — one decision on one award for one group (a team, or a whole league):
// grant the award to the group's active members, or take back what the group's grants gave. The
// people are reached a page at a time, after the decision opens in its own small transaction. Written
// only by Cloud Functions; an admin reads a decision through the status callable.
//
// A grant records each person in `awardGroupGrantPeople` before it changes their profile, so a re-run
// after any interruption finds every recorded person and finishes them, and its revoke reverses exactly
// the people it gave the award to. Someone who already held the award is recorded as holding it before,
// and a revoke leaves them holding it. `status` stays `pending` until every page is done; the retry
// ledger lets a decision that keeps failing back off instead of holding the resume's window.

import { z } from 'zod';
import { buildAwardGroupGrantId, buildAwardGroupGrantTargetKey } from '../ids/award-grant-ids.js';
import {
  AWARD_GROUP_GRANT_ACTION_KEYS,
  AWARD_GROUP_GRANT_STATUS_KEYS,
  AWARD_GROUP_REVOKE_SKIP_KEYS,
  AWARD_GROUP_TYPE_KEYS,
} from '../types/unions.js';
import { countSchema, documentIdSegmentSchema, epochMsSchema, revisionSchema, userIdSchema } from './atoms.js';
import { awardIdSchema } from './catalogs.js';

export const awardGroupTypeSchema = z.enum(AWARD_GROUP_TYPE_KEYS);
export const awardGroupGrantActionSchema = z.enum(AWARD_GROUP_GRANT_ACTION_KEYS);
export const awardGroupGrantStatusSchema = z.enum(AWARD_GROUP_GRANT_STATUS_KEYS);

// A decision's number among every decision on its award and group: the first is 1.
export const awardGroupGrantDecisionSchema = revisionSchema;

export const AwardGroupGrantSchema = z
  .strictObject({
    grantId: z.string().min(1),
    action: awardGroupGrantActionSchema,
    awardId: awardIdSchema,
    groupType: awardGroupTypeSchema,
    // The team id or the league id, as `groupType` says.
    groupId: documentIdSegmentSchema,
    targetKey: z.string().min(1),
    decision: awardGroupGrantDecisionSchema,
    // The admin who decided. Each person's audit event is recorded as their action.
    actorUid: userIdSchema,
    status: awardGroupGrantStatusSchema,
    createdAt: epochMsSchema,
    completedAt: epochMsSchema.optional(),
    attemptCount: countSchema,
    nextAttemptAt: epochMsSchema,
    lastError: z.string().optional(),
  })
  .superRefine((grant, ctx) => {
    // The key and the id are derived fields: a decision whose stored key or id disagrees with its
    // award, group, and number would sit outside that pair's decision sequence.
    const targetKey = buildAwardGroupGrantTargetKey(grant);
    if (grant.targetKey !== targetKey) {
      ctx.addIssue({ code: 'custom', path: ['targetKey'], message: 'targetKey must be the award and group target key.' });
    }
    if (grant.grantId !== buildAwardGroupGrantId(targetKey, grant.decision)) {
      ctx.addIssue({ code: 'custom', path: ['grantId'], message: 'grantId must be the target key and the decision.' });
    }
  });
export type AwardGroupGrant = z.infer<typeof AwardGroupGrantSchema>;

/**
 * Whether a request opens a new decision on an award for a group, given the group's latest decision
 * (`null` when it has none): a grant opens unless the latest is a grant, and a take-back opens only
 * when it is. A request the latest decision already settles opens nothing. The server applies it in
 * the transaction that opens the decision; the admin surface offers only the request it opens.
 */
export function awardGroupGrantOpens(
  latest: Pick<AwardGroupGrant, 'action'> | null,
  action: AwardGroupGrant['action'],
): boolean {
  return action === 'grant' ? latest?.action !== 'grant' : latest?.action === 'grant';
}

// `awardGroupGrants/{grantId}/awardGroupGrantPeople/{userId}` — one person a grant decision reached,
// recorded before their profile changed. `heldBefore` says they already held the award, so the grant
// gave them nothing. `revoked` turns true once a revoke has dealt with them; `revokeSkipped` says why
// that revoke left them holding the award.
export const AwardGroupGrantPersonSchema = z.strictObject({
  userId: userIdSchema,
  heldBefore: z.boolean(),
  recordedAt: epochMsSchema,
  revoked: z.boolean(),
  revokedAt: epochMsSchema.optional(),
  revokeSkipped: z.enum(AWARD_GROUP_REVOKE_SKIP_KEYS).optional(),
});
export type AwardGroupGrantPerson = z.infer<typeof AwardGroupGrantPersonSchema>;
