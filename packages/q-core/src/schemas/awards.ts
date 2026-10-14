// Callable contracts for the award catalog, award grants, and the badges an account features.
//
// An award is created by its first badge's publication (the `award-badge` upload, ./uploads.ts), so
// no callable here creates one. Grants and revokes share one input — four named lists, never an
// action discriminator (BACKEND-002) — like the role roster's.

import { z } from 'zod';
import { MAX_AWARD_GRANT_TARGETS } from '../constants/business.js';
import { awardIdSchema } from '../doc-schemas/catalogs.js';
import { AWARD_GRANT_SKIP_REASON_KEYS } from '../types/unions.js';
import { leagueIdSchema, teamIdSchema, userIdSchema } from './atoms.js';

const targetList = <T extends z.ZodTypeAny>(atom: T) => z.array(atom).max(MAX_AWARD_GRANT_TARGETS).optional();

// An admin grants an award to accounts — named directly, or as every active real member of a team
// or of a league — and revokes it from accounts. Recipients are resolved on the server, deduplicated,
// and bounded by MAX_AWARD_GRANT_RECIPIENTS; ghosts hold no account and are skipped.
export const AdminUpdateAwardGrantsInputSchema = z
  .object({
    awardId: awardIdSchema,
    grantUserIds: targetList(userIdSchema),
    grantTeamIds: targetList(teamIdSchema),
    grantLeagueIds: targetList(leagueIdSchema),
    revokeUserIds: targetList(userIdSchema),
  })
  .strict()
  .refine(
    (input) =>
      [input.grantUserIds, input.grantTeamIds, input.grantLeagueIds, input.revokeUserIds].some(
        (list) => list !== undefined && list.length > 0,
      ),
    { message: 'Name someone to grant the award to or revoke it from.' },
  )
  .refine(
    (input) => !(input.grantUserIds ?? []).some((userId) => (input.revokeUserIds ?? []).includes(userId)),
    { message: 'An account cannot be granted and revoked the award in one change.', path: ['revokeUserIds'] },
  );
export type AdminUpdateAwardGrantsInput = z.infer<typeof AdminUpdateAwardGrantsInputSchema>;

export const AwardGrantSkipSchema = z
  .object({ userId: userIdSchema, reason: z.enum(AWARD_GRANT_SKIP_REASON_KEYS) })
  .strict();
export type AwardGrantSkip = z.infer<typeof AwardGrantSkipSchema>;

// What the change did for each account it reached: granted now, already held, revoked now, not held
// to begin with, or skipped with its reason. A retried call reports the accounts its first call
// changed as already held or not held, and writes nothing again.
export const AdminUpdateAwardGrantsResultSchema = z
  .object({
    awardId: awardIdSchema,
    granted: z.array(userIdSchema),
    alreadyHeld: z.array(userIdSchema),
    revoked: z.array(userIdSchema),
    notHeld: z.array(userIdSchema),
    skipped: z.array(AwardGrantSkipSchema),
  })
  .strict();
export type AdminUpdateAwardGrantsResult = z.infer<typeof AdminUpdateAwardGrantsResultSchema>;

// An admin deletes an award nobody holds. Its badge's files are retired with it.
export const AdminDeleteAwardDefinitionInputSchema = z.object({ awardId: awardIdSchema }).strict();
export type AdminDeleteAwardDefinitionInput = z.infer<typeof AdminDeleteAwardDefinitionInputSchema>;

// `deleted` is false when the award was already gone: nothing was written.
export const AdminDeleteAwardDefinitionResultSchema = z
  .object({ awardId: awardIdSchema, deleted: z.boolean() })
  .strict();
export type AdminDeleteAwardDefinitionResult = z.infer<typeof AdminDeleteAwardDefinitionResultSchema>;

// The signed-in account chooses which of its own awards to show beside its name: a primary and a
// secondary badge, each an award it holds, or `null` for none. No user id is ever sent.
export const UpdateFeaturedAwardsInputSchema = z
  .object({ primaryAwardId: awardIdSchema.nullable(), secondaryAwardId: awardIdSchema.nullable() })
  .strict()
  .refine(
    (input) => input.primaryAwardId === null || input.primaryAwardId !== input.secondaryAwardId,
    { message: 'Choose two different awards.', path: ['secondaryAwardId'] },
  );
export type UpdateFeaturedAwardsInput = z.infer<typeof UpdateFeaturedAwardsInputSchema>;

export const UpdateFeaturedAwardsResultSchema = z
  .object({
    userId: userIdSchema,
    primaryAwardId: awardIdSchema.nullable(),
    secondaryAwardId: awardIdSchema.nullable(),
    changed: z.boolean(),
  })
  .strict();
export type UpdateFeaturedAwardsResult = z.infer<typeof UpdateFeaturedAwardsResultSchema>;
