// Typed text is a plain string here: the adapter judges it after the parse, so a refused text ends
// the job instead of failing every retry.

import { z } from 'zod';
import { CRAFT_SKILL_TAG_VALUES } from '../../constants/options.js';
import { MAX_CRAFT_SKILL_TAGS } from '../../constants/business-user.js';
import {
  HALL_CONTENT_DETAIL_SURFACES,
  HALL_CONTENT_SUB_ITEM_SURFACES,
} from '../../constants/hall-content-routing.js';
import {
  ContentMediaKindSchema,
  type MediaPublicationKind,
} from '../../doc-schemas/media-assets.js';
import {
  CraftSkillAttestationSchema,
  CraftSkillKindSchema,
  CraftSkillSourceReferenceSchema,
} from '../../doc-schemas/user.js';
import { AuditionModeSchema, AuditionTypeSchema } from '../../doc-schemas/commissions.js';
import { SystemVideoSlotIdSchema } from '../../system-slots/system-slots.js';
import { ConversationFileRefSchema } from '../conversation-file-ref.js';
import { SquareStreetzPostMentionsSchema } from '../atoms.js';
import {
  auditionEntryIdSchema,
  auditionIdSchema,
  commissionListingIdSchema,
  conversationFileIdSchema,
  craftSkillIdSchema,
  hallSubItemIdSchema,
  itemIdSchema,
  squareStreetzPostIdSchema,
  storedAgreementVersionSchema,
  userIdSchema,
  workFileFolderIdSchema,
  workFileIdSchema,
  workProjectIdSchema,
  workRealmIdSchema,
} from '../../schemas/atoms.js';

export const ProfilePicturePublicationArgsSchema = z
  .object({
    userId: userIdSchema,
  })
  .strict();
export type ProfilePicturePublicationArgs = z.infer<typeof ProfilePicturePublicationArgsSchema>;

export const CraftSkillMediaPublicationArgsSchema = z
  .object({
    userId: userIdSchema,
    craftSkillId: craftSkillIdSchema,
    name: z.string(),
    skillType: ContentMediaKindSchema,
    kind: CraftSkillKindSchema,
    attestation: CraftSkillAttestationSchema,
    source: CraftSkillSourceReferenceSchema.optional(),
    tags: z.array(z.enum(CRAFT_SKILL_TAG_VALUES)).min(1).max(MAX_CRAFT_SKILL_TAGS),
  })
  .strict();
export type CraftSkillMediaPublicationArgs = z.infer<typeof CraftSkillMediaPublicationArgsSchema>;

export const WorkAssetPublicationArgsSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    folderId: workFileFolderIdSchema,
    workFileId: workFileIdSchema,
    userId: userIdSchema,
    name: z.string(),
    size: z.number().int().nonnegative(),
    contentType: z.string().min(1),
    mediaKind: ContentMediaKindSchema,
  })
  .strict();
export type WorkAssetPublicationArgs = z.infer<typeof WorkAssetPublicationArgsSchema>;

export const HallCoverPublicationArgsSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    itemType: z.enum(HALL_CONTENT_DETAIL_SURFACES),
    itemId: itemIdSchema,
  })
  .strict();
export type HallCoverPublicationArgs = z.infer<typeof HallCoverPublicationArgsSchema>;

export const RealmCoverPublicationArgsSchema = z
  .object({ workRealmId: workRealmIdSchema })
  .strict();
export type RealmCoverPublicationArgs = z.infer<typeof RealmCoverPublicationArgsSchema>;

export const WorkContentMediaPublicationArgsSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    itemType: z.enum(HALL_CONTENT_SUB_ITEM_SURFACES),
    parentId: itemIdSchema,
    itemId: hallSubItemIdSchema,
  })
  .strict();
export type WorkContentMediaPublicationArgs = z.infer<typeof WorkContentMediaPublicationArgsSchema>;

export const ConversationFilePublicationArgsSchema = z
  .object({
    conversation: ConversationFileRefSchema,
    conversationFileId: conversationFileIdSchema,
    uploadedByUid: userIdSchema,
    name: z.string().min(1),
    mediaKind: ContentMediaKindSchema,
    contentType: z.string().min(1),
    reservedBytes: z.number().int().nonnegative(),
  })
  .strict();
export type ConversationFilePublicationArgs = z.infer<typeof ConversationFilePublicationArgsSchema>;

export const SquarePostMediaPublicationArgsSchema = z
  .object({
    userId: userIdSchema,
    postId: squareStreetzPostIdSchema,
    content: z.string(),
    mentions: SquareStreetzPostMentionsSchema,
    mediaType: ContentMediaKindSchema,
  })
  .strict();
export type SquarePostMediaPublicationArgs = z.infer<typeof SquarePostMediaPublicationArgsSchema>;

export const CommissionListingMediaPublicationArgsSchema = z
  .object({
    commissionListingId: commissionListingIdSchema,
    userId: userIdSchema,
    title: z.string(),
    description: z.string(),
    requiredTradeProfessions: z.array(z.string()),
    postingStakeSharesOffered: z.number().int(),
    attachmentName: z.string(),
    attachmentType: ContentMediaKindSchema,
    attachmentSize: z.number().int().nonnegative(),
    workProjectAssociatedWith: z
      .object({
        workProjectId: workProjectIdSchema,
        type: z.string().min(1),
      })
      .strict(),
  })
  .strict();
export type CommissionListingMediaPublicationArgs = z.infer<
  typeof CommissionListingMediaPublicationArgsSchema
>;

export const CommissionProposalMediaPublicationArgsSchema = z
  .object({
    commissionListingId: commissionListingIdSchema,
    userId: userIdSchema,
    coverLetterText: z.string(),
    replyFileType: ContentMediaKindSchema,
    agreementVersion: storedAgreementVersionSchema,
  })
  .strict();
export type CommissionProposalMediaPublicationArgs = z.infer<
  typeof CommissionProposalMediaPublicationArgsSchema
>;

const auditionPromptModeFields = {
  auditionMode: AuditionModeSchema.optional(),
  expectedOptionCount: z.number().optional(),
};

const WorkPromptPublicationArgsSchema = z
  .object({
    mode: z.literal('workPrompt'),
    userId: userIdSchema,
    auditionId: auditionIdSchema,
    workProjectId: workProjectIdSchema,
    title: z.string(),
    description: z.string(),
    entriesCloseAt: z.number(),
    auditionCloseAt: z.number(),
    submittedAt: z.number(),
    stakeSharesOffered: z.number().optional(),
    ...auditionPromptModeFields,
  })
  .strict();

const AdminPromptPublicationArgsSchema = z
  .object({
    mode: z.literal('adminPrompt'),
    userId: userIdSchema,
    auditionId: auditionIdSchema,
    auditionType: AuditionTypeSchema.exclude(['workAudition']),
    title: z.string(),
    description: z.string(),
    entriesCloseAt: z.number(),
    auditionCloseAt: z.number(),
    submittedAt: z.number(),
    sponsoredAuditionAmountUSD: z.number().optional(),
    ...auditionPromptModeFields,
  })
  .strict();

const auditionEntryPublicationFields = {
  userId: userIdSchema,
  auditionId: auditionIdSchema,
  auditionEntryId: auditionEntryIdSchema,
  submittedAt: z.number(),
};

const EntryPublicationArgsSchema = z
  .object({
    mode: z.literal('entry'),
    ...auditionEntryPublicationFields,
    agreementVersion: storedAgreementVersionSchema,
  })
  .strict();

const CuratedOptionPublicationArgsSchema = z
  .object({
    mode: z.literal('curatedOption'),
    ...auditionEntryPublicationFields,
  })
  .strict();

export const AuditionMediaPublicationArgsSchema = z.discriminatedUnion('mode', [
  WorkPromptPublicationArgsSchema,
  AdminPromptPublicationArgsSchema,
  EntryPublicationArgsSchema,
  CuratedOptionPublicationArgsSchema,
]);
export type AuditionMediaPublicationArgs = z.infer<typeof AuditionMediaPublicationArgsSchema>;

export const SystemVideoSlotPublicationArgsSchema = z
  .object({ slotId: SystemVideoSlotIdSchema })
  .strict();
export type SystemVideoSlotPublicationArgs = z.infer<typeof SystemVideoSlotPublicationArgsSchema>;

export const MEDIA_PUBLICATION_ARGS_SCHEMAS = {
  profilePicture: ProfilePicturePublicationArgsSchema,
  squarePostMedia: SquarePostMediaPublicationArgsSchema,
  workAsset: WorkAssetPublicationArgsSchema,
  hallCover: HallCoverPublicationArgsSchema,
  realmCover: RealmCoverPublicationArgsSchema,
  workContentMedia: WorkContentMediaPublicationArgsSchema,
  auditionMedia: AuditionMediaPublicationArgsSchema,
  commissionListingMedia: CommissionListingMediaPublicationArgsSchema,
  commissionProposalMedia: CommissionProposalMediaPublicationArgsSchema,
  craftSkillMedia: CraftSkillMediaPublicationArgsSchema,
  conversationFile: ConversationFilePublicationArgsSchema,
  systemVideoSlot: SystemVideoSlotPublicationArgsSchema,
} as const satisfies Record<MediaPublicationKind, z.ZodType>;
