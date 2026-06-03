// Social types: SquareStreetz feed, Mentions, Follows, pledge payments
export type { Mention, MentionType } from '../media/atoms.js';
import type { Mention } from '../media/atoms.js';
import type { FollowableTargetType } from '../schemas/social.js';

// --- SquareStreetz Social Media ---

export type SquareStreetzPostType =
  | 'PROFILE_PICTURE_UPDATE'
  | 'NEW_CRAFT_SKILL'
  | 'NEW_ARTISAN_CREATOR'
  | 'COMMISSION_ACCEPTED'
  | 'DELETE_CRAFT_SKILL'
  | 'USER_POST'
  | 'NEW_WORK_PROJECT'
  | 'LIBRARY_PUBLISHED';

/**
 * Serializable subset of SquareStreetz post creation payload.
 * Frontend extends this with `mediaFile?: File` locally.
 */
export type SquareStreetzPostPayload = {
  userId: string;
  mentions?: Mention[];
  newMediaUrl?: string;
  craftSkill?: { id: string; name: string; url: string; type: 'image' | 'video' | 'audio' };
  craftSkillId?: string;
  workProjectTitle?: string;
  workProjectId?: string;
  workProjectType?: string;
  workProjectDescription?: string;
  workRealmId?: string;
  workRealmTitle?: string;
  hallItemId?: string;
  hallItemTitle?: string;
  hallSubItemType?: 'chapter' | 'track' | 'episode';
  content?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'other';
  createdAt?: number;
};

export type SquareStreetzPost = {
  postId: string;
  createdBy: { uid: string };
  authorId: string;
  content: string;
  mentions?: Mention[];
  relatedIds: string[];
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'other';
  createdAt: number;
  likes: number;
  postType?: SquareStreetzPostType;
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

// --- Follows ---

/**
 * A follow edge in the top-level `followEdges` collection. Doc ID is
 * `${followerUid}__${targetType}__${targetId}` (deterministic O(1) status
 * check + dedupe). The same collection is the reverse index for release
 * fan-out via a composite index on (targetType, targetId).
 */
export type FollowEdge = {
  followerUid: string;
  targetType: FollowableTargetType;
  targetId: string;
  followedOn: number;
};

// --- Pledge payments ---

export type PledgePayment = {
  pledgePaymentId: string;
  stripeSessionId: string;
  amount: number;
  currency: string;
  message: string;
  status: string;
  createdAt: number;
  userId: string;
};


