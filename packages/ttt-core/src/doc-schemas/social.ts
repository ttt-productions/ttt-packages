// Social Firestore document SCHEMAS — SquareStreetz posts, mention history,
// follow edges, and pledge-payment ledger docs. Types inferred via z.infer.
// (SquareStreetzPostPayload is a transport shape, not a stored doc — it stays in
// ../types/social.ts.)

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
]);
export type SquareStreetzPostType = z.infer<typeof SquareStreetzPostTypeSchema>;

export const SquareStreetzPostSchema = z.object({
  postId: z.string(),
  createdBy: z.object({ uid: z.string() }),
  authorId: z.string(),
  content: z.string(),
  mentions: z.array(MentionSchema).optional(),
  relatedIds: z.array(z.string()),
  mediaUrl: z.string().optional(),
  mediaType: mediaTypeSchema.optional(),
  createdAt: z.number(),
  likes: z.number(),
  postType: SquareStreetzPostTypeSchema.optional(),
  relatedAssetId: z.string().optional(),
  moderationStatus: z.enum(['pending', 'approved', 'rejected', 'pending_review']).optional(),
  moderationReason: z.string().optional(),
  moderationLayer: z.enum(['word_filter', 'perspective']).optional(),
  visible: z.boolean().optional(),
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

export const PledgePaymentSchema = z.object({
  pledgePaymentId: z.string(),
  stripeSessionId: z.string(),
  amount: z.number(),
  currency: z.string(),
  message: z.string(),
  status: z.string(),
  createdAt: z.number(),
  userId: z.string(),
});
export type PledgePayment = z.infer<typeof PledgePaymentSchema>;

// pledgePaymentsSummary/summary — running pledge totals counter updated by the Stripe webhook.
// (functions/src/payments/stripeWebhook.ts)
export const PledgePaymentsSummarySchema = z.object({
  totalPledgePayments: z.number(),
  totalPledgePaymentsByType: z.object({
    card: z.number(),
    paypal: z.number(),
    crypto: z.number(),
  }),
  pledgePaymentCount: z.number(),
  lastUpdatedAt: z.number(),
});
export type PledgePaymentsSummary = z.infer<typeof PledgePaymentsSummarySchema>;

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
