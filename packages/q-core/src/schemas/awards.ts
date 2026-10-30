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

export const AwardGroupSchema = z
  .object({ groupType: awardGroupTypeSchema, groupId: documentIdSegmentSchema })
  .strict();
export type AwardGroup = z.infer<typeof AwardGroupSchema>;

export const AdminUpdateAwardGroupGrantInputSchema = z
  .object({ awardId: awardIdSchema, action: awardGroupGrantActionSchema, group: AwardGroupSchema })
  .strict();
export type AdminUpdateAwardGroupGrantInput = z.infer<typeof AdminUpdateAwardGroupGrantInputSchema>;

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

export const AdminDeleteAwardDefinitionInputSchema = z.object({ awardId: awardIdSchema }).strict();
export type AdminDeleteAwardDefinitionInput = z.infer<typeof AdminDeleteAwardDefinitionInputSchema>;

export const AdminDeleteAwardDefinitionResultSchema = z
  .object({ awardId: awardIdSchema, deleted: z.boolean() })
  .strict();
export type AdminDeleteAwardDefinitionResult = z.infer<
  typeof AdminDeleteAwardDefinitionResultSchema
>;

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
