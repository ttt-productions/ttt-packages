// Social Firestore document SCHEMAS — SquareStreetz posts, mention history, and
// follow edges. Types inferred via z.infer. (Pledge-payment ledger docs moved to
// ../doc-schemas/payments.ts. SquareStreetzPostPayload is a transport shape, not a
// stored doc — it stays in ../types/social.ts.)

import { z } from 'zod';
import { MentionSchema } from '../media/atoms.js';
import { FollowableTargetTypeSchema } from '../schemas/social.js';
import { ContentMediaKindSchema } from './media-assets.js';
import { CraftSkillKindSchema, CraftSkillSourceReferenceSchema } from './user.js';
import { HallSubItemTypeSchema } from './content.js';
import { CRAFT_SKILL_TAG_VALUES } from '../constants/options.js';
import { WORK_PROJECT_TYPE_KEYS } from '../types/content.js';

/** The ONE canonical display/transport media-type family (the 'other' bucket covers
 * non-previewable kinds). Distinct from the 3-value stored ContentMediaKindSchema
 * (doc-schemas/media-assets.ts) and media-schemas' generic MediaKindSchema. */
export const MediaTypeSchema = z.enum(['image', 'video', 'audio', 'other']);
export type MediaType = z.infer<typeof MediaTypeSchema>;
const mediaTypeSchema = MediaTypeSchema;

/** Discriminates the announcement voice/mention shape of a NEW_AUDITION Streetz post:
 * 'work' names the creating work inline; 'platform' | 'sponsored' name TTT Productions
 * the company instead (no work mention). The ONE declaration of this union. */
export const AuditionAnnounceKindSchema = z.enum(['work', 'platform', 'sponsored']);
export type AuditionAnnounceKind = z.infer<typeof AuditionAnnounceKindSchema>;

export const SquareStreetzPostTypeSchema = z.enum([
  'PROFILE_PICTURE_UPDATE',
  'NEW_CRAFT_SKILL',
  'NEW_ARTISAN_CREATOR',
  'COMMISSION_ACCEPTED',
  'DELETE_CRAFT_SKILL',
  'USER_POST',
  'NEW_WORK_PROJECT',
  'LIBRARY_PUBLISHED',
  'NEW_AUDITION',
  'NEW_COMMISSION',
]);
export type SquareStreetzPostType = z.infer<typeof SquareStreetzPostTypeSchema>;

/**
 * squareStreetzFeed/activePosts/socialPosts/{postId}.
 *
 * **Media-pair invariant (MEDIA-101) — enforced by the superRefine below:**
 * `mediaAssetId` and `mediaType` are ONE unit — both present, or both absent.
 * Gateway URLs are extensionless, so nothing downstream can recover the kind from
 * the id: a post persisted with an asset and NO kind classifies as `'other'` and
 * `AppMediaPreview` renders a Download link INSTEAD of the image/video. The mirror
 * case (a kind with no asset) is an orphan that describes media the post does not
 * carry. Declared HERE, on the canonical doc schema (ARCH-102), so every writer
 * inherits it from the one post-create chokepoint's parse rather than each write
 * site re-deciding — and so no reader ever needs a `?? 'other'` guess.
 *
 * Announcement posts REFERENCE a source asset (audition `videoAssetId`, commission
 * `commissionAttachment.mediaAssetId`), so the kind always comes from that source —
 * it is never invented or defaulted at the post write.
 */
export const SquareStreetzPostSchema = z.object({
  postId: z.string(),
  createdBy: z.object({ uid: z.string() }),
  authorId: z.string(),
  content: z.string(),
  mentions: z.array(MentionSchema).optional(),
  relatedIds: z.array(z.string()),
  /** Paired with `mediaType` — see the media-pair invariant above. */
  mediaAssetId: z.string().optional(),
  /** Paired with `mediaAssetId` — see the media-pair invariant above. */
  mediaType: mediaTypeSchema.optional(),
  createdAt: z.number(),
  likes: z.number(),
  postType: SquareStreetzPostTypeSchema.optional(),
  relatedAssetId: z.string().optional(),
  // Admin moderation hide (reversible). When true the post is suppressed from all
  // feeds/lists; restored by clearing it. `hidden` is the ONLY operative moderation
  // flag on a post — the legacy pre-finalize upload-gating (`visible`) and automated
  // text-moderation outcome (`moderationStatus`/`moderationReason`/`moderationLayer`)
  // fields were removed 2026-07-03: nothing wrote them (posts are created only AFTER
  // media finalize under pattern C), so they were dead. Durable owner:
  // ttt-prod docs/design/streetz-social-feed.md.
  hidden: z.boolean(),
}).superRefine((val, ctx) => {
  if (val.mediaAssetId !== undefined && val.mediaType === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['mediaType'],
      message: 'mediaType is required whenever a post carries mediaAssetId (MEDIA-101: an extensionless gateway URL with no kind renders a Download link instead of the media)',
    });
  }
  if (val.mediaType !== undefined && val.mediaAssetId === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['mediaAssetId'],
      message: 'mediaType is only allowed on a post that carries mediaAssetId — an orphan kind describes media the post does not have',
    });
  }
});
export type SquareStreetzPost = z.infer<typeof SquareStreetzPostSchema>;

/**
 * The create/announcement transport payload for a SquareStreetz post — the exact input
 * `runManageSquareStreetzPost` accepts. Every enqueue site (the durable
 * `squareAnnouncementJobs` outbox) and the manual post callables build one of these; the
 * different post types populate different subsets, so every field beyond `userId` is
 * optional. The TYPE is inferred from this schema (ARCH-102 — one declaration; the
 * frontend extends it with a local `mediaFile?: File`).
 *
 * NON-strict and carrying NO cross-field pairing refinement ON PURPOSE: it is parsed at
 * ENQUEUE inside the announcing transaction (ttt-prod square-announcement-outbox.ts), so a
 * throw here would fail the user's primary action over an announcement defect (ENG-009). It
 * validates that each present field has its canonical type and strips unknowns; the
 * `mediaAssetId`↔`mediaType` pairing (MEDIA-101) is enforced at DELIVERY, where the post
 * core parses `SquareStreetzPostSchema` and a failure dead-letters the job instead.
 */
export const SquareStreetzPostPayloadSchema = z.object({
  userId: z.string(),
  mentions: z.array(MentionSchema).optional(),
  newMediaAssetId: z.string().optional(),
  // NEW_CRAFT_SKILL announcement descriptor — id/kind/tags/source let the post describe the
  // craft WITHOUT leaking the client-supplied original file name.
  craftSkill: z
    .object({
      id: z.string(),
      name: z.string(),
      mediaAssetId: z.string(),
      type: ContentMediaKindSchema,
      tags: z.array(z.enum(CRAFT_SKILL_TAG_VALUES)).optional(),
      kind: CraftSkillKindSchema.optional(),
      source: CraftSkillSourceReferenceSchema.optional(),
    })
    .optional(),
  craftSkillId: z.string().optional(),
  workProjectTitle: z.string().optional(),
  workProjectId: z.string().optional(),
  workProjectType: z.enum(WORK_PROJECT_TYPE_KEYS).optional(),
  workProjectDescription: z.string().optional(),
  workRealmId: z.string().optional(),
  workRealmTitle: z.string().optional(),
  hallItemId: z.string().optional(),
  hallItemTitle: z.string().optional(),
  hallSubItemType: HallSubItemTypeSchema.optional(),
  content: z.string().optional(),
  mediaAssetId: z.string().optional(),
  mediaType: mediaTypeSchema.optional(),
  createdAt: z.number().optional(),
  auditionId: z.string().optional(),
  commissionListingId: z.string().optional(),
  auditionAnnounceKind: AuditionAnnounceKindSchema.optional(),
});
export type SquareStreetzPostPayload = z.infer<typeof SquareStreetzPostPayloadSchema>;

export const MentionHistoryItemSchema = MentionSchema.extend({ viewedAt: z.number() });
export type MentionHistoryItem = z.infer<typeof MentionHistoryItemSchema>;

export const MentionHistoryDocumentSchema = z.object({
  userId: z.string(),
  items: z.array(MentionHistoryItemSchema),
});
export type MentionHistoryDocument = z.infer<typeof MentionHistoryDocumentSchema>;

// Authoritative result of the addToMentionHistory callable — the transaction computes
// the deduped, capped list in memory before committing, so returning it costs no read.
// Declared HERE (not schemas/social.ts) because it composes MentionHistoryItemSchema
// and this module already imports schemas/social.js (FollowableTargetTypeSchema) — the
// reverse runtime import would be a module cycle. Re-exported on the ./schemas subpath
// via schemas/index.ts. Non-strict (server → client result posture).
export const AddToMentionHistoryResultSchema = z.object({
  success: z.literal(true),
  itemCount: z.number().int().nonnegative(),
  /** The full, deduped, capped history AFTER this write — a drop-in cache replacement. */
  items: z.array(MentionHistoryItemSchema),
});
export type AddToMentionHistoryResult = z.infer<typeof AddToMentionHistoryResultSchema>;

export const FollowEdgeSchema = z.object({
  followerUid: z.string(),
  targetType: FollowableTargetTypeSchema,
  targetId: z.string(),
  followedOn: z.number(),
});
export type FollowEdge = z.infer<typeof FollowEdgeSchema>;

// followCounters/{targetType__targetId} — denormalized follower count for a followable target,
// maintained by the follow/unfollow callables via FieldValue.increment (never written by clients).
// The Hall Library "Most Followed" sort mirrors the workProject count onto hallItems.followerCount.
export const FollowCounterSchema = z.object({
  followerCount: z.number(),
  updatedOn: z.number(),
});
export type FollowCounter = z.infer<typeof FollowCounterSchema>;

// userProfiles/{uid}/userLikes/likeHistory/squareStreetzLikes/{postId} — a user's like on a
// SquareStreetz post; existence == liked. The path nests three of the registry segments
// (userLikes / likeHistory / squareStreetzLikes). (functions/src/social/likeSquareStreetzPost.ts)
export const SquareStreetzLikeSchema = z.object({
  likedOn: z.number(),
});
export type SquareStreetzLike = z.infer<typeof SquareStreetzLikeSchema>;

// squareStreetzFeed/trendingPosts — singleton holding the ordered top-N trending post IDs that the
// client infinite-scrolls through. (functions/src/social/runUpdateTrendingFeed.ts)
export const TrendingPostsSchema = z.object({
  postIds: z.array(z.string()),
  lastUpdated: z.number(),
});
export type TrendingPosts = z.infer<typeof TrendingPostsSchema>;
