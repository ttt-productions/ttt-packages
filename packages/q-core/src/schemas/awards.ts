import { z } from 'zod';
import { MAX_AWARD_GRANT_TARGETS } from '../constants/business.js';
import { countSchema, documentIdSegmentSchema, userIdSchema } from '../doc-schemas/atoms.js';
import { awardIdSchema } from '../doc-schemas/catalogs.js';
import {
  AWARD_GRANT_SKIP_REASON_KEYS,
  AWARD_GROUP_TYPE_KEYS,
  FEATURED_AWARD_SLOT_KEYS,
} from '../types/unions.js';

const targetList = <T extends z.ZodTypeAny>(atom: T) =>
  z.array(atom).max(MAX_AWARD_GRANT_TARGETS).optional();

export const AdminUpdateAwardDefinitionGrantsInputSchema = z
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
export type AdminUpdateAwardDefinitionGrantsInput = z.infer<
  typeof AdminUpdateAwardDefinitionGrantsInputSchema
>;

export const AwardGrantSkipSchema = z
  .object({ userId: userIdSchema, reason: z.enum(AWARD_GRANT_SKIP_REASON_KEYS) })
  .strict();
export type AwardGrantSkip = z.infer<typeof AwardGrantSkipSchema>;

export const AdminUpdateAwardDefinitionGrantsResultSchema = z
  .object({
    awardId: awardIdSchema,
    granted: z.array(userIdSchema),
    alreadyHeld: z.array(userIdSchema),
    revoked: z.array(userIdSchema),
    notHeld: z.array(userIdSchema),
    skipped: z.array(AwardGrantSkipSchema),
  })
  .strict();
export type AdminUpdateAwardDefinitionGrantsResult = z.infer<
  typeof AdminUpdateAwardDefinitionGrantsResultSchema
>;

export const AwardGroupSchema = z
  .object({ groupType: z.enum(AWARD_GROUP_TYPE_KEYS), groupId: documentIdSegmentSchema })
  .strict();
export type AwardGroup = z.infer<typeof AwardGroupSchema>;

export const AwardGroupTargetInputSchema = z
  .object({ awardId: awardIdSchema, group: AwardGroupSchema })
  .strict();
export type AwardGroupTargetInput = z.infer<typeof AwardGroupTargetInputSchema>;

export const AwardGroupChangeResultSchema = z
  .object({ awardId: awardIdSchema, changedCount: countSchema })
  .strict();
export type AwardGroupChangeResult = z.infer<typeof AwardGroupChangeResultSchema>;

export const AdminDeleteAwardDefinitionInputSchema = z.object({ awardId: awardIdSchema }).strict();
export type AdminDeleteAwardDefinitionInput = z.infer<typeof AdminDeleteAwardDefinitionInputSchema>;

export const AdminDeleteAwardDefinitionResultSchema = z
  .object({ awardId: awardIdSchema, deleted: z.boolean() })
  .strict();
export type AdminDeleteAwardDefinitionResult = z.infer<
  typeof AdminDeleteAwardDefinitionResultSchema
>;

const featuredAwardSlotSchema = z.enum(FEATURED_AWARD_SLOT_KEYS);
export const UpdateUserProfileFeaturedAwardsInputSchema = z.discriminatedUnion('action', [
  z
    .object({ action: z.literal('set'), slot: featuredAwardSlotSchema, awardId: awardIdSchema })
    .strict(),
  z.object({ action: z.literal('clear'), slot: featuredAwardSlotSchema }).strict(),
]);
export type UpdateUserProfileFeaturedAwardsInput = z.infer<
  typeof UpdateUserProfileFeaturedAwardsInputSchema
>;

export const UpdateUserProfileFeaturedAwardsResultSchema = z
  .object({
    userId: userIdSchema,
    primaryAwardId: awardIdSchema.nullable(),
    secondaryAwardId: awardIdSchema.nullable(),
    changed: z.boolean(),
  })
  .strict();
export type UpdateUserProfileFeaturedAwardsResult = z.infer<
  typeof UpdateUserProfileFeaturedAwardsResultSchema
>;
