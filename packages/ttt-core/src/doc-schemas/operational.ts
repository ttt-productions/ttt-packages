import { z } from 'zod';
import { UserAccountStatusSchema } from './user.js';
import { ShortLinkTargetTypeSchema } from '../schemas/atoms.js';

export const ReservedDisplayNameSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
});
export type ReservedDisplayName = z.infer<typeof ReservedDisplayNameSchema>;

export const ReservedRealmNameSchema = z.object({
  workRealmId: z.string(),
  workingTitle: z.string(),
  retired: z.boolean().optional(),
});
export type ReservedRealmName = z.infer<typeof ReservedRealmNameSchema>;

export const StakeShareAuditEventSchema = z.object({
  eventId: z.string(),
  subtype: z.string(),
  reason: z.string(),
  workProjectId: z.string(),
  guildmateUserUid: z.string(),
  guildmateUserPath: z.string(),
  beforeStakeShares: z.number().nullable(),
  afterStakeShares: z.number().nullable(),
  createdAt: z.number(),
  source: z.string(),
});
export type StakeShareAuditEvent = z.infer<typeof StakeShareAuditEventSchema>;

export const ShortLinkSchema = z.object({
  shortId: z.string(),
  shortUrl: z.string(),
  destinationUrl: z.string(),
  type: ShortLinkTargetTypeSchema,
  metadata: z.object({
    auditionId: z.string().nullable(),
    auditionEntryId: z.string().nullable(),
    commissionListingId: z.string().nullable(),
    hallItemId: z.string().nullable(),
  }),
  createdAt: z.number(),
  createdBy: z.string(),
  clicks: z.number(),
});
export type ShortLink = z.infer<typeof ShortLinkSchema>;

export const STATUS_RECONCILE_QUEUE_AUTH_EFFECTS = [
  'accountStatus',
  'publicDocumentsAcceptedClaim',
  'adminClaims',
  'registeredMemberClaim',
] as const;
export const StatusReconcileQueueAuthEffectSchema = z.enum(STATUS_RECONCILE_QUEUE_AUTH_EFFECTS);
export type StatusReconcileQueueAuthEffect = z.infer<typeof StatusReconcileQueueAuthEffectSchema>;

const statusReconcileQueueEntryBase = {
  uid: z.string(),
  enqueuedAt: z.number(),
  lastAttemptAt: z.number().optional(),
  attemptCount: z.number(),
  reason: z.literal('postCommitAuthEffectFailed'),
};

export const StatusReconcileQueueAccountStatusEntrySchema = z.object({
  ...statusReconcileQueueEntryBase,
  reason: z.literal('statusChangePending'),
  authEffect: z.literal('accountStatus' satisfies StatusReconcileQueueAuthEffect).optional(),
  targetStatus: UserAccountStatusSchema,
  writeId: z.string(),
});
export type StatusReconcileQueueAccountStatusEntry = z.infer<
  typeof StatusReconcileQueueAccountStatusEntrySchema
>;

export const StatusReconcileQueuePublicDocumentsAcceptedClaimEntrySchema = z
  .object({
    ...statusReconcileQueueEntryBase,
    authEffect: z.literal('publicDocumentsAcceptedClaim' satisfies StatusReconcileQueueAuthEffect),
  })
  .strict();
export type StatusReconcileQueuePublicDocumentsAcceptedClaimEntry = z.infer<
  typeof StatusReconcileQueuePublicDocumentsAcceptedClaimEntrySchema
>;

export const StatusReconcileQueueAdminClaimsEntrySchema = z
  .object({
    ...statusReconcileQueueEntryBase,
    authEffect: z.literal('adminClaims' satisfies StatusReconcileQueueAuthEffect),
  })
  .strict();
export type StatusReconcileQueueAdminClaimsEntry = z.infer<
  typeof StatusReconcileQueueAdminClaimsEntrySchema
>;

export const StatusReconcileQueueRegisteredMemberClaimEntrySchema = z
  .object({
    ...statusReconcileQueueEntryBase,
    authEffect: z.literal('registeredMemberClaim' satisfies StatusReconcileQueueAuthEffect),
  })
  .strict();
export type StatusReconcileQueueRegisteredMemberClaimEntry = z.infer<
  typeof StatusReconcileQueueRegisteredMemberClaimEntrySchema
>;

export const StatusReconcileQueueEntrySchema = z.discriminatedUnion('authEffect', [
  StatusReconcileQueueAccountStatusEntrySchema,
  StatusReconcileQueuePublicDocumentsAcceptedClaimEntrySchema,
  StatusReconcileQueueAdminClaimsEntrySchema,
  StatusReconcileQueueRegisteredMemberClaimEntrySchema,
]);
export type StatusReconcileQueueEntry = z.infer<typeof StatusReconcileQueueEntrySchema>;

export const FeedbackAliasSchema = z.object({
  canonicalId: z.string(),
  originalType: z.string(),
});
export type FeedbackAlias = z.infer<typeof FeedbackAliasSchema>;

export const UserSuggestionSchema = z.object({
  suggestionText: z.string(),
  count: z.number(),
  submittedBy: z.array(z.object({ userId: z.string() })),
  lastSubmitted: z.number(),
});
export type UserSuggestion = z.infer<typeof UserSuggestionSchema>;
