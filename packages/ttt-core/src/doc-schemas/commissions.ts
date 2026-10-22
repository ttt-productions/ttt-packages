import { z } from 'zod';
import { CommissionProposalStatusSchema } from '../schemas/commissions.js';
import { stakeSharesOfferedSchema } from '../schemas/atoms.js';
import { AuditionDeadlineSchema } from '../constants/audition-deadlines.js';
import { ContentMediaKindSchema } from './media-assets.js';
import { ModerationHiddenBySchema } from './moderation.js';

const userRefSchema = z.object({ uid: z.string() });

export const CommissionAttachmentSchema = z.object({
  pendingMediaId: z.string().optional(),
  name: z.string(),
  mediaAssetId: z.string(),
  type: ContentMediaKindSchema,
  size: z.number(),
});
export type CommissionAttachment = z.infer<typeof CommissionAttachmentSchema>;

export const FullCommissionListingSchema = z.object({
  commissionListingId: z.string(),
  title: z.string(),
  description: z.string(),
  commissionAttachment: CommissionAttachmentSchema.optional(),
  requiredTradeProfessions: z.array(z.string()),
  stakeSharesOffered: stakeSharesOfferedSchema,
  createdAt: z.number(),
  createdBy: userRefSchema,
  workProjectAssociatedWith: z.object({
    workProjectId: z.string(),
    type: z.string(),
  }),
  status: z.enum(['open', 'closed']),
  closedAt: z.number().optional(),
  savedProposalArtisans: z.array(z.string()),
  shortId: z.string().optional(),
  shortUrl: z.string().optional(),
  hidden: z.boolean(),
  hiddenBy: ModerationHiddenBySchema.optional(),
});
export type FullCommissionListing = z.infer<typeof FullCommissionListingSchema>;

export const CommissionProposalSchema = z.object({
  commissionProposalId: z.string(),
  commissionListingId: z.string(),
  workProjectId: z.string(),
  proposalText: z.string(),
  proposalFileAssetId: z.string().optional(),
  proposalFileType: ContentMediaKindSchema.optional(),
  createdBy: userRefSchema,
  createdOn: z.number(),
  status: CommissionProposalStatusSchema,
  guildInviteId: z.string().optional(),
  invitedOn: z.number().optional(),
  acceptedOn: z.number().optional(),
  rejectedAt: z.number().optional(),
  hidden: z.boolean().optional(),
  hiddenBy: ModerationHiddenBySchema.optional(),
});
export type CommissionProposal = z.infer<typeof CommissionProposalSchema>;

// Declared here, not in schemas/commissions.ts: the reverse import would be a module cycle.
export const CreateCommissionProposalTextResultSchema = z.object({
  success: z.literal(true),
  commissionListingId: z.string().min(1),
  commissionProposalId: z.string().min(1),
  proposal: CommissionProposalSchema,
});
export type CreateCommissionProposalTextResult = z.infer<
  typeof CreateCommissionProposalTextResultSchema
>;

export const AuditionTypeSchema = z.enum(['platformAudition', 'sponsoredAudition', 'workAudition']);
export type AuditionType = z.infer<typeof AuditionTypeSchema>;

export const AuditionModeSchema = z.enum(['open', 'curated']);
export type AuditionMode = z.infer<typeof AuditionModeSchema>;

export const AuditionSchema = z.object({
  auditionId: z.string(),
  type: AuditionTypeSchema,
  title: z.string(),
  description: z.string(),
  videoAssetId: z.string(),
  mediaType: ContentMediaKindSchema.extract(['video']),
  entriesCloseAt: AuditionDeadlineSchema,
  auditionCloseAt: AuditionDeadlineSchema,
  createdOn: z.number(),
  createdBy: userRefSchema,
  workProjectId: z.string().optional(),
  mode: AuditionModeSchema.optional(),
  curatedAssemblyStatus: z.enum(['assembling', 'ready', 'failed', 'closed']).optional(),
  expectedOptionCount: z.number().int().optional(),
  curatedFailureReason: z.string().optional(),
  sponsoredAuditionAmountUSD: z.number().optional(),
  stakeSharesOffered: stakeSharesOfferedSchema.optional(),
  status: z.enum(['open', 'closed', 'pendingReview']),
  closedAt: z.number().optional(),
  auditionEntryCount: z.number().optional(),
  shortId: z.string().optional(),
  shortUrl: z.string().optional(),
  hidden: z.boolean(),
  hiddenBy: ModerationHiddenBySchema.optional(),
});
export type Audition = z.infer<typeof AuditionSchema>;

export const AuditionEntrySchema = z.object({
  auditionEntryId: z.string(),
  auditionId: z.string(),
  workProjectId: z.string().optional(),
  videoAssetId: z.string(),
  mediaType: ContentMediaKindSchema.extract(['video']),
  createdBy: userRefSchema,
  createdAt: z.number(),
  votes: z.number(),
  shortId: z.string().optional(),
  shortUrl: z.string().optional(),
  isCreatorOption: z.boolean().optional(),
  hidden: z.boolean(),
  hiddenBy: ModerationHiddenBySchema.optional(),
});
export type AuditionEntry = z.infer<typeof AuditionEntrySchema>;

export const UserAuditionVoteSchema = z.object({
  votedForAuditionEntryId: z.string(),
  votedOn: z.number(),
  auditionEntryArtisanCreator: userRefSchema,
});
export type UserAuditionVote = z.infer<typeof UserAuditionVoteSchema>;
