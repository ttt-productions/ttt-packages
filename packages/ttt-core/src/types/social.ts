// Social types: SquareStreetz feed, Mentions, Follows. (Pledge-payment types live in
// ../types/payments.ts.)
export type { Mention, MentionType } from '../media/atoms.js';
import type { Mention } from '../media/atoms.js';
import type { CraftSkillKind, CraftSkillSourceReference } from '../doc-schemas/user.js';
import type { ContentMediaKind } from '../doc-schemas/media-assets.js';
import type { MediaType, AuditionAnnounceKind } from '../doc-schemas/social.js';
import type { HallSubItemType } from '../doc-schemas/content.js';
import type { CraftSkillTagId } from '../constants/options.js';
import type { WorkProjectType } from './content.js';

// --- SquareStreetz Social Media ---

// SquareStreetz post/mention-history/follow shapes are re-exported from
// ../doc-schemas/social.ts below (single source of truth).

/**
 * Serializable subset of SquareStreetz post creation payload.
 * Frontend extends this with `mediaFile?: File` locally.
 * Every union/allowlist field derives from its ONE canonical declaration (ARCH-102) —
 * never an inline literal union.
 */
export type SquareStreetzPostPayload = {
  userId: string;
  mentions?: Mention[];
  newMediaAssetId?: string;
  // `tags` (canonical discipline-tag ids), `kind` (attestation kind), and `source`
  // (the mimicOnTtt original — a user/workProject reference, rendered as a resolvable
  // mention link) let the NEW_CRAFT_SKILL Streetz announcement describe the craft
  // WITHOUT the client-supplied file name (`name` = originalFileName — never put a
  // file name in public post content).
  craftSkill?: {
    id: string;
    name: string;
    mediaAssetId: string;
    type: ContentMediaKind;
    tags?: CraftSkillTagId[];
    kind?: CraftSkillKind;
    source?: CraftSkillSourceReference;
  };
  craftSkillId?: string;
  workProjectTitle?: string;
  workProjectId?: string;
  workProjectType?: WorkProjectType;
  workProjectDescription?: string;
  workRealmId?: string;
  workRealmTitle?: string;
  hallItemId?: string;
  hallItemTitle?: string;
  hallSubItemType?: HallSubItemType;
  content?: string;
  mediaAssetId?: string;
  mediaType?: MediaType;
  createdAt?: number;
  auditionId?: string;
  commissionListingId?: string;
  auditionAnnounceKind?: AuditionAnnounceKind;
};

export type {
  SquareStreetzPostType,
  SquareStreetzPost,
  MentionHistoryItem,
  MentionHistoryDocument,
  FollowEdge,
  FollowCounter,
} from '../doc-schemas/social.js';
