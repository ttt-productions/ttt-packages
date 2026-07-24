// Commission + Audition Firestore document SCHEMAS — commissionListings/{id} and its
// commissionProposals, auditionBoard/{id} and its auditionEntries, plus the per-user
// auditionVotes doc. Types inferred via z.infer.

import { z } from 'zod';
import { CommissionProposalStatusSchema } from '../schemas/commissions.js';
import { ContentMediaKindSchema } from './media-assets.js';

const userRefSchema = z.object({ uid: z.string() });

export const CommissionAttachmentSchema = z.object({
  pendingMediaId: z.string().optional(),
  name: z.string(),
  mediaAssetId: z.string(),
  // The stored content kind (image/video/audio). Set once by the upload pipeline
  // (getSimplifiedMediaType) and written by the commissionListingMedia publication adapter
  // as z.enum(['image','video','audio']); derived here from the ONE canonical stored-kind
  // union (ARCH-102), never a widened `string`.
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
  shortId: z.string().optional(),
  shortUrl: z.string().optional(),
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

// Authoritative result of the createCommissionProposalText callable — the created item,
// exactly as the transaction committed it; the client seeds its proposal caches from this
// instead of refetching. Declared HERE (not schemas/commissions.ts) because it composes
// CommissionProposalSchema and this module already imports schemas/commissions.js
// (CommissionProposalStatusSchema) — the reverse runtime import would be a module cycle.
// Re-exported on the ./schemas subpath via schemas/index.ts. Non-strict (server → client
// result posture).
export const CreateCommissionProposalTextResultSchema = z.object({
  success: z.literal(true),
  commissionListingId: z.string().min(1),
  commissionProposalId: z.string().min(1),
  /** The proposal doc exactly as committed. */
  proposal: CommissionProposalSchema,
});
export type CreateCommissionProposalTextResult = z.infer<typeof CreateCommissionProposalTextResultSchema>;

export const AuditionTypeSchema = z.enum(['platformAudition', 'sponsoredAudition', 'workAudition']);
export type AuditionType = z.infer<typeof AuditionTypeSchema>;

export const AuditionSchema = z.object({
  auditionId: z.string(),
  type: AuditionTypeSchema,
  title: z.string(),
  description: z.string(),
  videoAssetId: z.string(),
  // Auditions are VIDEO ONLY (DJ ruling). Paired with the required videoAssetId (both
  // always present — the MEDIA-101 shape, not a required-asset/optional-kind mismatch),
  // derived from the ONE canonical stored-kind union narrowed to video — never an inline
  // re-declared union (ARCH-102).
  mediaType: ContentMediaKindSchema.extract(['video']),
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
  //   'closed'     — a curated audition that was closed (by its creator or an admin) after reveal;
  //                  terminal, kept for record. Distinct from the pre-reveal assembly states above.
  curatedAssemblyStatus: z.enum(['assembling', 'ready', 'failed', 'closed']).optional(),
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
  // Audition entries are VIDEO ONLY (DJ ruling) — same video-only pairing as the audition
  // prompt above; derived from the canonical stored-kind union narrowed to video.
  mediaType: ContentMediaKindSchema.extract(['video']),
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
