// Social types: Streetz feed, Mentions, Follows, Donations

import type { ShortUser } from './user.js';

// --- Streetz Social Media ---

export type StreetzPostType =
  | 'PROFILE_PICTURE_UPDATE'
  | 'NEW_SKILL'
  | 'NEW_CREATOR'
  | 'JOB_ACCEPTED'
  | 'DELETE_SKILL'
  | 'USER_POST'
  | 'NEW_PROJECT';

export type MentionType = 'user' | 'project' | 'job' | 'opportunity';

export type Mention = {
  placeholder: string;
  type: MentionType;
  id: string;
  text: string;
};

/**
 * Serializable subset of Streetz post creation payload.
 * Frontend extends this with `mediaFile?: File` locally.
 */
export type StreetzPostPayload = {
  userId: string;
  displayName: string;
  profilePictureUrlMedium?: string | null;
  mentions?: Mention[];
  newMediaUrl?: string;
  skill?: { id: string; name: string; url: string; type: 'image' | 'video' | 'audio' };
  skillId?: string;
  projectTitle?: string;
  projectId?: string;
  projectType?: string;
  projectDescription?: string;
  content?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'other';
  createdAt?: number;
};

export type StreetzPost = {
  postId: string;
  createdBy: ShortUser;
  authorId: string;
  content: string;
  mentions?: Mention[];
  relatedIds: string[];
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'other';
  createdAt: number;
  likes: number;
  postType?: StreetzPostType;
  relatedAssetId?: string;
  moderationStatus?: 'pending' | 'approved' | 'rejected' | 'pending_review';
  moderationReason?: string;
  moderationLayer?: 'word_filter' | 'perspective';
  visible?: boolean;
};

export type MentionHistoryItem = Mention & {
  viewedAt: number;
};

export type MentionHistoryDocument = {
  userId: string;
  items: MentionHistoryItem[];
};

// --- Donations ---

export type Donation = {
  donationId: string;
  stripeSessionId: string;
  amount: number;
  currency: string;
  message: string;
  status: string;
  createdAt: number;
  userId: string;
  displayName: string;
};
