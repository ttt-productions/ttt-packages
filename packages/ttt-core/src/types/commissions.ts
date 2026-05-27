// Commission board and Audition types

import type { ShortWorkProject } from './work-project.js';
import type { CommissionProposalStatus } from '../schemas/commissions.js';

export type CommissionAttachment = {
  pendingMediaId?: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'other' | string;
  size: number;
};

export type FullCommissionListing = {
  commissionListingId: string;
  title: string;
  description: string;
  commissionAttachment?: CommissionAttachment;
  requiredTradeProfessions: string[];
  stakeSharesOffered: number;
  createdAt: number;
  createdBy: { uid: string };
  workProjectAssociatedWith: ShortWorkProject;
  status: 'open' | 'closed';
  savedProposalArtisans: string[];
};

export type CommissionProposal = {
  commissionProposalId: string;
  commissionListingId: string;
  workProjectId: string;
  proposalText: string;
  proposalFileUrl?: string;
  proposalFileType?: string;
  createdBy: { uid: string };
  createdOn: number;
  status: CommissionProposalStatus;
  guildInviteId?: string;
  invitedOn?: number;
  acceptedOn?: number;
  rejectedAt?: number;
};

// --- Audition ---

export type AuditionType = 'platformAudition' | 'sponsoredAudition' | 'workAudition';

export type Audition = {
  auditionId: string;
  type: AuditionType;
  title: string;
  description: string;
  videoUrl: string;
  mediaType?: 'video' | 'image' | 'audio' | 'other';
  openTill: number;
  createdOn: number;
  createdBy: { uid: string };
  workProjectId?: string;
  sponsoredAuditionAmountUSD?: number;
  stakeSharesOffered?: number;
  status: 'open' | 'closed' | 'pendingReview';
  replyCount?: number;
  shortId?: string;
  shortUrl?: string;
};

export interface AuditionEntry {
  auditionEntryId: string;
  auditionId: string;
  workProjectId?: string;
  videoUrl: string;
  mediaType?: 'video' | 'image' | 'other';
  createdBy: { uid: string };
  createdAt: number;
  votes: number;
  shortId?: string;
  shortUrl?: string;
}

export interface UserAuditionVote {
  votedForAuditionEntryId: string;
  votedOn: number;
  auditionEntryCreator: { uid: string };
}


