// Social Firestore document SCHEMAS — SquareStreetz posts, mention history, and
// follow edges. Types inferred via z.infer. (Pledge-payment ledger docs moved to
// ../doc-schemas/payments.ts. SquareStreetzPostPayload is a transport shape, not a
// stored doc — it stays in ../types/social.ts.)

import { z } from 'zod';
import { MentionSchema } from '../media/atoms.js';
import { FollowableTargetTypeSchema } from '../schemas/social.js';

const mediaTypeSchema = z.enum(['image', 'video', 'audio', 'other']);

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

export const SquareStreetzPostSchema = z.object({
  postId: z.string(),
  createdBy: z.object({ uid: z.string() }),
  authorId: z.string(),
  content: z.string(),
  mentions: z.array(MentionSchema).optional(),
  relatedIds: z.array(z.string()),
  mediaAssetId: z.string().optional(),
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
  // media finalize under pattern C), so they were dead. See
  // CODE_CHANGE_feed_slice_hygiene_misc.md item 1.
  hidden: z.boolean(),
});
export type SquareStreetzPost = z.infer<typeof SquareStreetzPostSchema>;

export const MentionHistoryItemSchema = MentionSchema.extend({ viewedAt: z.number() });
export type MentionHistoryItem = z.infer<typeof MentionHistoryItemSchema>;

export const MentionHistoryDocumentSchema = z.object({
  userId: z.string(),
  items: z.array(MentionHistoryItemSchema),
});
export type MentionHistoryDocument = z.infer<typeof MentionHistoryDocumentSchema>;

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
