// Social types: SquareStreetz feed, Mentions, Follows. (Pledge-payment types live in
// ../types/payments.ts.)
export type { Mention, MentionType } from '../media/atoms.js';
import type { Mention } from '../media/atoms.js';

// --- SquareStreetz Social Media ---

// SquareStreetz post/mention-history/follow shapes are re-exported from
// ../doc-schemas/social.ts below (single source of truth).

/**
 * Serializable subset of SquareStreetz post creation payload.
 * Frontend extends this with `mediaFile?: File` locally.
 */
export type SquareStreetzPostPayload = {
  userId: string;
  mentions?: Mention[];
  newMediaAssetId?: string;
  craftSkill?: { id: string; name: string; mediaAssetId: string; type: 'image' | 'video' | 'audio' };
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
  mediaAssetId?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'other';
  createdAt?: number;
};

export type {
  SquareStreetzPostType,
  SquareStreetzPost,
  MentionHistoryItem,
  MentionHistoryDocument,
  FollowEdge,
  FollowCounter,
} from '../doc-schemas/social.js';


