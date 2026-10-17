// The args each media publication kind's activation job carries. A processor writes them at
// PREPARE and the kind's adapter parses them before every publish attempt: the scheduled
// recovery worker re-reads them from the stored job, so the stored row is never trusted as-is.
//
// Text a person typed (titles, descriptions, captions, cover letters) is a plain string here.
// The adapter judges it with its declaration after the parse, so a refused text ends the job
// terminally instead of failing the parse on every retry.

import { z } from "zod";
import { CRAFT_SKILL_TAG_VALUES } from "../../constants/options.js";
import { MAX_CRAFT_SKILL_TAGS } from "../../constants/business.js";
import {
  HALL_CONTENT_DETAIL_SURFACES,
  HALL_CONTENT_SUB_ITEM_SURFACES,
} from "../../constants/hall-content-routing.js";
import { ContentMediaKindSchema, type MediaPublicationKind } from "../../doc-schemas/media-assets.js";
import {
  CraftSkillAttestationSchema,
  CraftSkillKindSchema,
  CraftSkillSourceReferenceSchema,
} from "../../doc-schemas/user.js";
import { AuditionModeSchema, AuditionTypeSchema } from "../../doc-schemas/commissions.js";
import { SystemVideoSlotIdSchema } from "../../system-slots/system-slots.js";
import { ConversationFileRefSchema } from "../conversation-file-ref.js";
import { SquareStreetzPostMentionsSchema } from "../atoms.js";

export const ProfilePicturePublicationArgsSchema = z
  .object({
    userId: z.string().min(1),
    // Accepted and never read: the picture a publish supersedes is read from the profile doc
    // inside the publish transaction, so overlapping uploads each retire their own predecessor.
    previousAssetId: z.string().optional(),
  })
  .strict();
export type ProfilePicturePublicationArgs = z.infer<typeof ProfilePicturePublicationArgsSchema>;

export const CraftSkillMediaPublicationArgsSchema = z
  .object({
    userId: z.string().min(1),
    craftSkillId: z.string().min(1),
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
    workProjectId: z.string().min(1),
    folderId: z.string().min(1),
    workFileId: z.string().min(1),
    userId: z.string().min(1),
    name: z.string(),
    size: z.number().int().nonnegative(),
    contentType: z.string().min(1),
    // The server-inspected kind every Work-file preview renders by, never the declared type.
    mediaKind: ContentMediaKindSchema,
  })
  .strict();
export type WorkAssetPublicationArgs = z.infer<typeof WorkAssetPublicationArgsSchema>;

export const HallCoverPublicationArgsSchema = z
  .object({
    workProjectId: z.string().min(1),
    itemType: z.enum(HALL_CONTENT_DETAIL_SURFACES),
    itemId: z.string().min(1),
  })
  .strict();
export type HallCoverPublicationArgs = z.infer<typeof HallCoverPublicationArgsSchema>;

export const RealmCoverPublicationArgsSchema = z.object({ workRealmId: z.string().min(1) }).strict();
export type RealmCoverPublicationArgs = z.infer<typeof RealmCoverPublicationArgsSchema>;

export const WorkContentMediaPublicationArgsSchema = z
  .object({
    workProjectId: z.string().min(1),
    itemType: z.enum(HALL_CONTENT_SUB_ITEM_SURFACES),
    parentId: z.string().min(1),
    itemId: z.string().min(1),
  })
  .strict();
export type WorkContentMediaPublicationArgs = z.infer<typeof WorkContentMediaPublicationArgsSchema>;

export const ConversationFilePublicationArgsSchema = z
  .object({
    conversation: ConversationFileRefSchema,
    conversationFileId: z.string().min(1),
    uploadedByUid: z.string().min(1),
    name: z.string().min(1),
    mediaKind: ContentMediaKindSchema,
    contentType: z.string().min(1),
    // The bytes startUpload reserved for this upload. The publish subtracts them from the
    // parent's reserved total, so its byte-ceiling check honors every other live reservation.
    reservedBytes: z.number().int().nonnegative(),
  })
  .strict();
export type ConversationFilePublicationArgs = z.infer<typeof ConversationFilePublicationArgsSchema>;

export const SquarePostMediaPublicationArgsSchema = z
  .object({
    userId: z.string().min(1),
    postId: z.string().min(1),
    content: z.string(),
    mentions: SquareStreetzPostMentionsSchema,
    mediaType: ContentMediaKindSchema,
  })
  .strict();
export type SquarePostMediaPublicationArgs = z.infer<typeof SquarePostMediaPublicationArgsSchema>;

export const CommissionListingMediaPublicationArgsSchema = z
  .object({
    commissionListingId: z.string().min(1),
    userId: z.string().min(1),
    title: z.string(),
    description: z.string(),
    requiredTradeProfessions: z.array(z.string()),
    postingStakeSharesOffered: z.number().int(),
    attachmentName: z.string(),
    attachmentType: ContentMediaKindSchema,
    attachmentSize: z.number().int().nonnegative(),
    // Id and type only: the Work's title and description resolve at render (ARCH-103).
    workProjectAssociatedWith: z
      .object({
        workProjectId: z.string().min(1),
        type: z.string().min(1),
      })
      .strict(),
  })
  .strict();
export type CommissionListingMediaPublicationArgs = z.infer<typeof CommissionListingMediaPublicationArgsSchema>;

export const CommissionProposalMediaPublicationArgsSchema = z
  .object({
    commissionListingId: z.string().min(1),
    userId: z.string().min(1),
    coverLetterText: z.string(),
    replyFileType: ContentMediaKindSchema,
  })
  .strict();
export type CommissionProposalMediaPublicationArgs = z.infer<typeof CommissionProposalMediaPublicationArgsSchema>;

// `auditionMode` carries the audition's own `mode`; it is named apart from the branch
// discriminant `mode` below.
const auditionPromptModeFields = {
  auditionMode: AuditionModeSchema.optional(),
  expectedOptionCount: z.number().optional(),
};

const WorkPromptPublicationArgsSchema = z
  .object({
    mode: z.literal("workPrompt"),
    userId: z.string().min(1),
    auditionId: z.string().min(1),
    workProjectId: z.string().min(1),
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
    mode: z.literal("adminPrompt"),
    userId: z.string().min(1),
    auditionId: z.string().min(1),
    auditionType: AuditionTypeSchema.exclude(["workAudition"]),
    title: z.string(),
    description: z.string(),
    entriesCloseAt: z.number(),
    auditionCloseAt: z.number(),
    submittedAt: z.number(),
    sponsoredAuditionAmountUSD: z.number().optional(),
    ...auditionPromptModeFields,
  })
  .strict();

const EntryPublicationArgsSchema = z
  .object({
    mode: z.literal("entry"),
    userId: z.string().min(1),
    auditionId: z.string().min(1),
    auditionEntryId: z.string().min(1),
    // The upload's submit time, which the entry deadline is judged by.
    submittedAt: z.number(),
  })
  .strict();

export const AuditionMediaPublicationArgsSchema = z.discriminatedUnion("mode", [
  WorkPromptPublicationArgsSchema,
  AdminPromptPublicationArgsSchema,
  EntryPublicationArgsSchema,
]);
export type AuditionMediaPublicationArgs = z.infer<typeof AuditionMediaPublicationArgsSchema>;

export const SystemVideoSlotPublicationArgsSchema = z.object({ slotId: SystemVideoSlotIdSchema }).strict();
export type SystemVideoSlotPublicationArgs = z.infer<typeof SystemVideoSlotPublicationArgsSchema>;

/** Every publication kind's args schema, keyed by kind, so a new kind cannot build without its args. */
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
