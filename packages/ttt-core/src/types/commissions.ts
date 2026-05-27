// Commission board and Audition types

import type { ShortProject } from './work-project.js';
import type { JobApplicationStatus } from '../schemas/commissions.js';

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
  requiredTradeProfessions: string[];
  sharesOffered: number;
  createdAt: number;
  createdBy: { uid: string };
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
  createdBy: { uid: string };
  createdOn: number;
  status: JobApplicationStatus;
  inviteId?: string;
  invitedOn?: number;
  acceptedOn?: number;
  rejectedAt?: number;
};

// --- Audition ---

export type OpportunityType = 'SystemInput' | 'SponsoredProjects' | 'ProjectInput';

export type Audition = {
  opportunityId: string;
  type: OpportunityType;
  title: string;
  description: string;
  videoUrl: string;
  mediaType?: 'video' | 'image' | 'audio' | 'other';
  openTill: number;
  createdOn: number;
  createdBy: { uid: string };
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
  createdBy: { uid: string };
  createdAt: number;
  votes: number;
  shortId?: string;
  shortUrl?: string;
}

export interface UserOpportunityVote {
  votedForReplyId: string;
  votedOn: number;
  replyCreator: { uid: string };
}
