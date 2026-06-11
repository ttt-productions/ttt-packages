// Commission + Audition Firestore document SCHEMAS — commissionListings/{id} and its
// commissionProposals, auditionBoard/{id} and its auditionEntries, plus the per-user
// auditionVotes doc. Types inferred via z.infer.

import { z } from 'zod';
import { ShortWorkProjectSchema } from '../media/atoms.js';
import { CommissionProposalStatusSchema } from '../schemas/commissions.js';

const userRefSchema = z.object({ uid: z.string() });

export const CommissionAttachmentSchema = z.object({
  pendingMediaId: z.string().optional(),
  name: z.string(),
  mediaAssetId: z.string(),
  // Original type is `'image' | 'video' | 'audio' | 'other' | string`, which TS widens to string.
  type: z.string(),
  size: z.number(),
});
export type CommissionAttachment = z.infer<typeof CommissionAttachmentSchema>;

export const FullCommissionListingSchema = z.object({
  commissionListingId: z.string(),
  title: z.string(),
  description: z.string(),
  commissionAttachment: CommissionAttachmentSchema.optional(),
  requiredTradeProfessions: z.array(z.string()),
  stakeSharesOffered: z.number(),
  createdAt: z.number(),
  createdBy: userRefSchema,
  workProjectAssociatedWith: ShortWorkProjectSchema,
  status: z.enum(['open', 'closed']),
  savedProposalArtisans: z.array(z.string()),
  // Admin moderation hide (reversible). When true the listing is suppressed from
  // the commission board; restored by clearing it.
  hidden: z.boolean(),
});
export type FullCommissionListing = z.infer<typeof FullCommissionListingSchema>;

export const CommissionProposalSchema = z.object({
  commissionProposalId: z.string(),
  commissionListingId: z.string(),
  workProjectId: z.string(),
  proposalText: z.string(),
  proposalFileAssetId: z.string().optional(),
  proposalFileType: z.string().optional(),
  createdBy: userRefSchema,
  createdOn: z.number(),
  status: CommissionProposalStatusSchema,
  guildInviteId: z.string().optional(),
  invitedOn: z.number().optional(),
  acceptedOn: z.number().optional(),
  rejectedAt: z.number().optional(),
});
export type CommissionProposal = z.infer<typeof CommissionProposalSchema>;

export const AuditionTypeSchema = z.enum(['platformAudition', 'sponsoredAudition', 'workAudition']);
export type AuditionType = z.infer<typeof AuditionTypeSchema>;

export const AuditionSchema = z.object({
  auditionId: z.string(),
  type: AuditionTypeSchema,
  title: z.string(),
  description: z.string(),
  videoAssetId: z.string(),
  mediaType: z.enum(['video', 'image', 'audio', 'other']).optional(),
  openTill: z.number(),
  createdOn: z.number(),
  createdBy: userRefSchema,
  workProjectId: z.string().optional(),
  sponsoredAuditionAmountUSD: z.number().optional(),
  stakeSharesOffered: z.number().optional(),
  status: z.enum(['open', 'closed', 'pendingReview']),
  auditionEntryCount: z.number().optional(),
  shortId: z.string().optional(),
  shortUrl: z.string().optional(),
  // Admin moderation hide (reversible). When true the audition is suppressed from
  // the audition board; restored by clearing it.
  hidden: z.boolean(),
});
export type Audition = z.infer<typeof AuditionSchema>;

export const AuditionEntrySchema = z.object({
  auditionEntryId: z.string(),
  auditionId: z.string(),
  workProjectId: z.string().optional(),
  videoAssetId: z.string(),
  mediaType: z.enum(['video', 'image', 'other']).optional(),
  createdBy: userRefSchema,
  createdAt: z.number(),
  votes: z.number(),
  shortId: z.string().optional(),
  shortUrl: z.string().optional(),
  // Admin moderation hide (reversible). When true the entry is suppressed from the
  // audition's entry list; restored by clearing it.
  hidden: z.boolean(),
});
export type AuditionEntry = z.infer<typeof AuditionEntrySchema>;

export const UserAuditionVoteSchema = z.object({
  votedForAuditionEntryId: z.string(),
  votedOn: z.number(),
  auditionEntryArtisanCreator: userRefSchema,
});
export type UserAuditionVote = z.infer<typeof UserAuditionVoteSchema>;
