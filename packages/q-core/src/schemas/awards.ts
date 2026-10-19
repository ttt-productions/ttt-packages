// Callable contracts for the award catalog, award grants, and the badges an account features.
//
// An award is created by its first badge's publication (the `award-badge` upload, ./uploads.ts), so
// no callable here creates one. Grants and revokes to named accounts share one input — two named
// lists, never an action discriminator (BACKEND-002) — like the role roster's. A team's or a whole
// league's grant is its own decision, carried out a page of people at a time.

import { z } from 'zod';
import { MAX_AWARD_GRANT_TARGETS } from '../constants/business.js';
import {
  awardGroupGrantActionSchema,
  awardGroupGrantDecisionSchema,
  awardGroupGrantStatusSchema,
  awardGroupTypeSchema,
} from '../doc-schemas/award-group-grant.js';
import {
  countSchema,
  documentIdSegmentSchema,
  epochMsSchema,
  userIdSchema,
} from '../doc-schemas/atoms.js';
import { awardIdSchema } from '../doc-schemas/catalogs.js';
import { AWARD_GRANT_SKIP_REASON_KEYS, FEATURED_AWARD_SLOT_KEYS } from '../types/unions.js';

const targetList = <T extends z.ZodTypeAny>(atom: T) =>
  z.array(atom).max(MAX_AWARD_GRANT_TARGETS).optional();

// An admin grants an award to named accounts and revokes it from named accounts, in one commit.
// Recipients are deduplicated on the server; a ghost holds no account and is skipped.
export const AdminUpdateAwardGrantsInputSchema = z
  .object({
    awardId: awardIdSchema,
    grantUserIds: targetList(userIdSchema),
    revokeUserIds: targetList(userIdSchema),
  })
  .strict()
  .refine(
    (input) =>
      [input.grantUserIds, input.revokeUserIds].some(
        (list) => list !== undefined && list.length > 0,
      ),
    { message: 'Name someone to grant the award to or revoke it from.' },
  )
  .refine(
    (input) =>
      !(input.grantUserIds ?? []).some((userId) => (input.revokeUserIds ?? []).includes(userId)),
    {
      message: 'An account cannot be granted and revoked the award in one change.',
      path: ['revokeUserIds'],
    },
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

// The group a group grant reaches: every active member of one team, or of one whole league.
// `groupId` is that team's or league's id.
export const AwardGroupSchema = z
  .object({ groupType: awardGroupTypeSchema, groupId: documentIdSegmentSchema })
  .strict();
export type AwardGroup = z.infer<typeof AwardGroupSchema>;

// An admin grants an award to a group, or takes back what the group's grants gave. The decision opens
// at once and its people are reached a page at a time after the answer; a request the group's latest
// decision already settles (granting what is granted, taking back what is not) opens nothing.
export const AdminUpdateAwardGroupGrantInputSchema = z
  .object({ awardId: awardIdSchema, action: awardGroupGrantActionSchema, group: AwardGroupSchema })
  .strict();
export type AdminUpdateAwardGroupGrantInput = z.infer<typeof AdminUpdateAwardGroupGrantInputSchema>;

// Where one decision on an award for a group stands. `peopleReached` is how many people it has dealt
// with so far: a grant's recorded people, or the people a revoke has taken the award back from or left
// holding it. A pending decision that failed carries its failure and how many times it has tried; the
// scheduled resume tries it again.
export const AwardGroupGrantProgressSchema = z
  .object({
    grantId: z.string().min(1),
    action: awardGroupGrantActionSchema,
    decision: awardGroupGrantDecisionSchema,
    status: awardGroupGrantStatusSchema,
    peopleReached: countSchema,
    attemptCount: countSchema,
    lastError: z.string().nullable(),
    createdAt: epochMsSchema,
    completedAt: epochMsSchema.nullable(),
  })
  .strict();
export type AwardGroupGrantProgress = z.infer<typeof AwardGroupGrantProgressSchema>;

// `opened` is false when the group's latest decision already settled the request; `grant` is then that
// decision, or null when the group has none.
export const AdminUpdateAwardGroupGrantResultSchema = z
  .object({
    awardId: awardIdSchema,
    opened: z.boolean(),
    grant: AwardGroupGrantProgressSchema.nullable(),
  })
  .strict();
export type AdminUpdateAwardGroupGrantResult = z.infer<
  typeof AdminUpdateAwardGroupGrantResultSchema
>;

// An admin reads the latest decision on an award for a group, so the progress survives a closed page.
export const AdminGetAwardGroupGrantStatusInputSchema = z
  .object({ awardId: awardIdSchema, group: AwardGroupSchema })
  .strict();
export type AdminGetAwardGroupGrantStatusInput = z.infer<
  typeof AdminGetAwardGroupGrantStatusInputSchema
>;
export const AdminGetAwardGroupGrantStatusResultSchema = z
  .object({ grant: AwardGroupGrantProgressSchema.nullable() })
  .strict();
export type AdminGetAwardGroupGrantStatusResult = z.infer<
  typeof AdminGetAwardGroupGrantStatusResultSchema
>;

// An admin deletes an award nobody holds. Its badge's files are retired with it.
export const AdminDeleteAwardDefinitionInputSchema = z.object({ awardId: awardIdSchema }).strict();
export type AdminDeleteAwardDefinitionInput = z.infer<typeof AdminDeleteAwardDefinitionInputSchema>;

// `deleted` is false when the award was already gone: nothing was written.
export const AdminDeleteAwardDefinitionResultSchema = z
  .object({ awardId: awardIdSchema, deleted: z.boolean() })
  .strict();
export type AdminDeleteAwardDefinitionResult = z.infer<
  typeof AdminDeleteAwardDefinitionResultSchema
>;

// The signed-in account chooses which of its own awards to show beside its name: a primary and a
// secondary badge, each an award it holds, or none. The input is the one change the person made —
// set a slot, clear a slot, or swap the two — and the core applies it to the pair as stored, so a
// change to one slot never writes back a stale value of the other. No user id is ever sent.
const featuredAwardSlotSchema = z.enum(FEATURED_AWARD_SLOT_KEYS);
export const UpdateFeaturedAwardsInputSchema = z.discriminatedUnion('action', [
  z
    .object({ action: z.literal('set'), slot: featuredAwardSlotSchema, awardId: awardIdSchema })
    .strict(),
  z.object({ action: z.literal('clear'), slot: featuredAwardSlotSchema }).strict(),
  z.object({ action: z.literal('swap') }).strict(),
]);
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
