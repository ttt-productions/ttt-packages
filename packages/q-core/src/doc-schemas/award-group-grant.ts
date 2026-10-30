import { z } from 'zod';
import { buildAwardGroupGrantId, buildAwardGroupGrantTargetKey } from '../ids/award-grant-ids.js';
import {
  AWARD_GROUP_GRANT_ACTION_KEYS,
  AWARD_GROUP_GRANT_STATUS_KEYS,
  AWARD_GROUP_REVOKE_SKIP_KEYS,
  AWARD_GROUP_TYPE_KEYS,
} from '../types/unions.js';
import {
  countSchema,
  documentIdSegmentSchema,
  epochMsSchema,
  revisionSchema,
  userIdSchema,
} from './atoms.js';
import { awardIdSchema } from './catalogs.js';

export const awardGroupTypeSchema = z.enum(AWARD_GROUP_TYPE_KEYS);
export const awardGroupGrantActionSchema = z.enum(AWARD_GROUP_GRANT_ACTION_KEYS);
export const awardGroupGrantStatusSchema = z.enum(AWARD_GROUP_GRANT_STATUS_KEYS);

export const awardGroupGrantDecisionSchema = revisionSchema;

export const AwardGroupGrantSchema = z
  .strictObject({
    grantId: z.string().min(1),
    action: awardGroupGrantActionSchema,
    awardId: awardIdSchema,
    groupType: awardGroupTypeSchema,
    groupId: documentIdSegmentSchema,
    targetKey: z.string().min(1),
    decision: awardGroupGrantDecisionSchema,
    actorUid: userIdSchema,
    status: awardGroupGrantStatusSchema,
    createdAt: epochMsSchema,
    completedAt: epochMsSchema.optional(),
    attemptCount: countSchema,
    nextAttemptAt: epochMsSchema,
    lastError: z.string().optional(),
  })
  .superRefine((grant, ctx) => {
    const targetKey = buildAwardGroupGrantTargetKey(grant);
    if (grant.targetKey !== targetKey) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetKey'],
        message: 'targetKey must be the award and group target key.',
      });
    }
    if (grant.grantId !== buildAwardGroupGrantId(targetKey, grant.decision)) {
      ctx.addIssue({
        code: 'custom',
        path: ['grantId'],
        message: 'grantId must be the target key and the decision.',
      });
    }
  });
export type AwardGroupGrant = z.infer<typeof AwardGroupGrantSchema>;

export function awardGroupGrantOpens(
  latest: Pick<AwardGroupGrant, 'action'> | null,
  action: AwardGroupGrant['action'],
): boolean {
  return action === 'grant' ? latest?.action !== 'grant' : latest?.action === 'grant';
}

export const AwardGroupGrantPersonSchema = z.strictObject({
  userId: userIdSchema,
  heldBefore: z.boolean(),
  recordedAt: epochMsSchema,
  revoked: z.boolean(),
  revokedAt: epochMsSchema.optional(),
  revokeSkipped: z.enum(AWARD_GROUP_REVOKE_SKIP_KEYS).optional(),
});
export type AwardGroupGrantPerson = z.infer<typeof AwardGroupGrantPersonSchema>;
