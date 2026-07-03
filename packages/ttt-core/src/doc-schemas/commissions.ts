// Commission + Audition Firestore document SCHEMAS — commissionListings/{id} and its
// commissionProposals, auditionBoard/{id} and its auditionEntries, plus the per-user
// auditionVotes doc. Types inferred via z.infer.

import { z } from 'zod';
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
  // Work reference only — title/description are NOT snapshotted (Display Identity Invariant:
  // resolve at render from publicWorkProjects by id, fallback label if the work is gone).
  // `type` (Tales/Tunes/Television) is an immutable classification, not display text, and IS
  // consumed by a commission-board type filter/index, so it stays — mirroring the
  // GuildInviteConversation `workProject: { workProjectId, type }` precedent.
  workProjectAssociatedWith: z.object({
    workProjectId: z.string(),
    type: z.string(),
  }),
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
  // [EUAS-006] Admin moderation hide (reversible) — matches the listing/audition/entry pattern. When
  // true the proposal's TEXT is suppressed from the board (tombstoned for ordinary viewers); restored
  // by clearing it. Optional so existing/seeded proposals don't need backfilling pre-launch.
  hidden: z.boolean().optional(),
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
  // Curated vs open. 'open' (default when absent — existing auditions): anyone may post reply
  // entries AND vote. 'curated': the creating work posts the option entries itself (min 2, max 8,
  // each `isCreatorOption: true`) and users may ONLY vote — community reply entries are rejected.
  mode: z.enum(['open', 'curated']).optional(),
  // Curated atomic-reveal state (only meaningful when mode === 'curated'). The prompt + all N option
  // videos upload as ONE fixed batch; the audition stays non-votable + off the public board until the
  // WHOLE batch is live and every video passed moderation:
  //   'assembling' — batch still processing/moderating; not votable, not on the board (status stays
  //                  'pendingReview'), only the creator sees a "preparing…" state.
  //   'ready'      — all N+1 landed and approved; app flips status → 'open' and the audition reveals.
  //   'failed'     — any video in the batch was rejected by moderation; the whole audition fails.
  //                  status stays non-open; only the creator sees it (on the project page) to Edit &
  //                  resubmit or Discard.
  curatedAssemblyStatus: z.enum(['assembling', 'ready', 'failed']).optional(),
  // The fixed number of creator option videos submitted at create-time (2..8). Used to know when the
  // whole batch has landed (all expected entries approved → reveal).
  expectedOptionCount: z.number().int().optional(),
  // Set when curatedAssemblyStatus === 'failed': which video was rejected, for the creator-only
  // failed-audition surface on the project page.
  curatedFailureReason: z.string().optional(),
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
  // Curated-mode option: true when this entry is a work-authored voting option on a
  // `mode: 'curated'` audition (posted by the creating work at creation), not a community reply.
  isCreatorOption: z.boolean().optional(),
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
