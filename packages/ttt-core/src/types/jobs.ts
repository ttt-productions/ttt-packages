// Job board and Opportunity types

import type { ShortUser } from './user.js';
import type { ShortProject } from './project.js';

export type JobFile = {
  pendingMediaId?: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'other' | string;
  size: number;
};

export type FullJob = {
  jobId: string;
  title: string;
  description: string;
  jobFile?: JobFile;
  requiredProfessions: string[];
  sharesOffered: number;
  createdAt: number;
  createdBy: ShortUser;
  projectAssociatedWith: ShortProject;
  status: 'open' | 'closed';
  savedApplicants: string[];
};

export type FullJobReply = {
  replyId: string;
  jobId: string;
  projectId: string;
  reply: string;
  replyFile?: string;
  replyFileType?: string;
  createdBy: ShortUser;
  createdOn: number;
  status: 'open' | 'accepted' | 'rejected';
  acceptedOn?: string;
};

// --- Opportunity ---

export type OpportunityType = 'SystemInput' | 'SponsoredProjects' | 'ProjectInput';

export type Opportunity = {
  opportunityId: string;
  type: OpportunityType;
  title: string;
  description: string;
  videoUrl: string;
  mediaType?: 'video' | 'image' | 'audio' | 'other';
  openTill: number;
  createdOn: number;
  createdBy: ShortUser;
  projectId?: string;
  projectAmountUSD?: number;
  sharesOffered?: number;
  status: 'open' | 'closed' | 'pendingReview';
  replyCount?: number;
  shortId?: string;
  shortUrl?: string;
};

export interface OpportunityReply {
  replyId: string;
  opportunityId: string;
  projectId?: string;
  videoUrl: string;
  mediaType?: 'video' | 'image' | 'other';
  createdBy: ShortUser;
  createdAt: number;
  votes: number;
  shortId?: string;
  shortUrl?: string;
}

export interface UserOpportunityVote {
  votedForReplyId: string;
  votedOn: number;
  replyCreator: ShortUser;
}
