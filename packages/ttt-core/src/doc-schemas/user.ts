import { z } from 'zod';
import { HALL_WING_TYPE_KEYS } from '../types/content.js';
import { MAX_ARTISAN_LOCATION_LENGTH } from '../constants/business-user.js';
import { CRAFT_SKILL_TAG_VALUES } from '../constants/options.js';
import { userPrivateDataAgeFieldsShape } from './safety/age.js';
import { ContentMediaKindSchema } from './media-assets.js';
import { ModerationHiddenBySchema } from './moderation.js';
import { calendarDateSchema, documentIdSegmentSchema } from '../schemas/atoms.js';
import {
  PublicDocumentAcceptanceSchema,
  PublicDocumentVersionOrNoneSchema,
} from './public-documents.js';

const mediaKindSchema = ContentMediaKindSchema;

export const UserAccountStatusSchema = z.enum(['active', 'suspended', 'banned']);
export type UserAccountStatus = z.infer<typeof UserAccountStatusSchema>;

export const ABSENT_USER_ACCOUNT_STATUS = 'active' as const satisfies UserAccountStatus;

export function parseUserAccountStatus(value: unknown): UserAccountStatus {
  return value === undefined ? ABSENT_USER_ACCOUNT_STATUS : UserAccountStatusSchema.parse(value);
}

export const CraftSkillKindSchema = z.enum(['original', 'mimicOnTtt', 'mimicOffTtt']);
export type CraftSkillKind = z.infer<typeof CraftSkillKindSchema>;

export const CRAFT_SKILL_KIND_REQUIRING_SOURCE: CraftSkillKind = 'mimicOnTtt';

export const CraftSkillSourceReferenceSchema = z
  .object({
    type: z.enum(['user', 'workProject']),
    id: documentIdSegmentSchema,
  })
  .strict();
export type CraftSkillSourceReference = z.infer<typeof CraftSkillSourceReferenceSchema>;

export const CraftSkillAttestationSchema = z
  .object({
    statementKind: CraftSkillKindSchema,
    statementVersion: z.number().int().min(1),
    agreedAt: z.number(),
  })
  .strict();
export type CraftSkillAttestation = z.infer<typeof CraftSkillAttestationSchema>;

const craftSkillBaseShape = {
  id: z.string(),
  name: z.string(),
  mediaAssetId: z.string(),
  tags: z.array(z.enum(CRAFT_SKILL_TAG_VALUES)),
  createdAt: z.number(),
  type: mediaKindSchema,
  hidden: z.boolean(),
  hiddenBy: ModerationHiddenBySchema.optional(),
  attestation: CraftSkillAttestationSchema,
};

export const CraftSkillSchema = z.discriminatedUnion('kind', [
  z.object({
    ...craftSkillBaseShape,
    kind: z.literal('original'),
  }),
  z.object({
    ...craftSkillBaseShape,
    kind: z.literal('mimicOnTtt'),
    source: CraftSkillSourceReferenceSchema,
  }),
  z.object({
    ...craftSkillBaseShape,
    kind: z.literal('mimicOffTtt'),
  }),
]);
export type CraftSkill = z.infer<typeof CraftSkillSchema>;

export const CraftSkillReferenceSchema = z.object({
  craftSkillId: z.string(),
  compositeId: z.string(),
  userId: z.string(),
  craftSkillName: z.string(),
  craftSkillAssetId: z.string(),
  craftSkillType: mediaKindSchema,
  tags: z.array(z.enum(CRAFT_SKILL_TAG_VALUES)),
  createdAt: z.number(),
  hidden: z.boolean(),
  hiddenBy: ModerationHiddenBySchema.optional(),
  kind: CraftSkillKindSchema,
  source: CraftSkillSourceReferenceSchema.optional(),
});
export type CraftSkillReference = z.infer<typeof CraftSkillReferenceSchema>;

export const MinimalCraftSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  mediaAssetId: z.string(),
  type: mediaKindSchema,
});
export type MinimalCraftSkill = z.infer<typeof MinimalCraftSkillSchema>;

export const OwnedWorkProjectSchema = z.object({
  workProjectId: z.string(),
  workingTitle: z.string(),
  workingDescription: z.string(),
  type: z.string(),
  createdOn: z.number(),
  hallWingType: z.enum(HALL_WING_TYPE_KEYS),
});
export type OwnedWorkProject = z.infer<typeof OwnedWorkProjectSchema>;

export const AssociatedWorkProjectSchema = z.object({
  workProjectId: z.string(),
  workingTitle: z.string(),
  workingDescription: z.string(),
  type: z.string(),
  joinedOn: z.number(),
});
export type AssociatedWorkProject = z.infer<typeof AssociatedWorkProjectSchema>;

export const FullUserSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  displayName_lowercase: z.string(),
  profilePictureAssetId: z.string().nullable().optional(),
  artisanCreator: z.number().optional(),
  hasPledged: z.boolean().optional(),
  status: UserAccountStatusSchema.optional(),
  statusUpdatedAt: z.number().optional(),
  statusUpdatedBy: z.string().min(1).optional(),
  accountAccessVersion: z.number().optional(),
  accountAccessState: UserAccountStatusSchema.optional(),
  displayNameResetRequired: z.boolean().optional(),
  ownedWorkProjects: z.array(OwnedWorkProjectSchema).optional(),
  associatedWorkProjects: z.array(AssociatedWorkProjectSchema).optional(),
  createdAt: z.number(),
  anonymizedAt: z.number().optional(),
});
export type FullUser = z.infer<typeof FullUserSchema>;

export const UserAgreementsSchema = z.object({
  cleanContent: z.boolean().optional(),
  terms: z.boolean().optional(),
  agreedOn: z.number().optional(),
  wordingVersion: z.number().int().positive().optional(),
  termsVersion: z.number().int().nonnegative().optional(),
  privacyVersion: z.number().int().nonnegative().optional(),
});
export type UserAgreements = z.infer<typeof UserAgreementsSchema>;

export const UserSiteTourStateSchema = z.object({
  completedVersion: z.number().int().optional(),
  completedAt: z.number().optional(),
  notTodayDate: calendarDateSchema.optional(),
  automaticInvitesDisabledAt: z.number().optional(),
});
export type UserSiteTourState = z.infer<typeof UserSiteTourStateSchema>;

export const UserPrivateDataSchema = z.object({
  email: z.string(),
  isWaitingForNewsApproval: z.number().optional(),
  usPersonAttestedAt: z.number().optional(),
  nonUsArtisanInterest: z
    .object({
      country: z.string().min(1).max(MAX_ARTISAN_LOCATION_LENGTH),
      region: z.string().max(MAX_ARTISAN_LOCATION_LENGTH).optional(),
      requestedAt: z.number(),
    })
    .optional(),
  squareStreetzAgreementsDate: z.number().optional(),
  squareStreetzAgreementsVersion: PublicDocumentVersionOrNoneSchema.optional(),
  artisanCreatorAgreementsVersion: PublicDocumentVersionOrNoneSchema.optional(),
  artisanCreatorAgreementsWordingVersion: z.number().int().positive().optional(),
  squareStreetzAgreementsWordingVersion: z.number().int().positive().optional(),
  hallDownloadAcknowledgedAt: z.number().optional(),
  hallDownloadAcknowledgementVersion: z.number().int().positive().optional(),
  agreements: UserAgreementsSchema.optional(),
  publicDocumentAcceptance: PublicDocumentAcceptanceSchema.optional(),
  siteTour: UserSiteTourStateSchema.optional(),
  statusReason: z.string().optional(),
  statusReasonAt: z.number().optional(),
  safetyLocked: z.boolean().optional(),
  orphanDeletionClaimedAt: z.number().int().nonnegative().optional(),
  craftSkillChangeMarker: z.number().int().nonnegative().optional(),
  ...userPrivateDataAgeFieldsShape,
});
export type UserPrivateData = z.infer<typeof UserPrivateDataSchema>;
