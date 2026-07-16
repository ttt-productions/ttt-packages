import { z } from 'zod';
import { MentionSchema, rejectDuplicateMentionPlaceholders } from '../media/atoms.js';
import { MAX_POST_LENGTH, MAX_MENTIONS } from '../constants/business.js';

export const LikeSquareStreetzPostInputSchema = z.object({
  postId: z.string().min(1),
}).strict();
export type LikeSquareStreetzPostInput = z.infer<typeof LikeSquareStreetzPostInputSchema>;

export const UnlikeSquareStreetzPostInputSchema = z.object({
  postId: z.string().min(1),
}).strict();
export type UnlikeSquareStreetzPostInput = z.infer<typeof UnlikeSquareStreetzPostInputSchema>;

/** The entity kinds a user can follow. Subset of MentionType (commissions/auditions are not followable). */
export const FollowableTargetTypeSchema = z.enum(['user', 'workProject', 'workRealm']);
export type FollowableTargetType = z.infer<typeof FollowableTargetTypeSchema>;

export const FollowTargetInputSchema = z.object({
  targetType: FollowableTargetTypeSchema,
  targetId: z.string().min(1).max(128),
}).strict();
export type FollowTargetInput = z.infer<typeof FollowTargetInputSchema>;

export const UnfollowTargetInputSchema = z.object({
  targetType: FollowableTargetTypeSchema,
  targetId: z.string().min(1).max(128),
}).strict();
export type UnfollowTargetInput = z.infer<typeof UnfollowTargetInputSchema>;

export const AddToMentionHistoryInputSchema = z.object({
  mention: MentionSchema,
}).strict();
export type AddToMentionHistoryInput = z.infer<typeof AddToMentionHistoryInputSchema>;

export const CreateSquareStreetzTextPostInputSchema = z.object({
  textContent: z.string().min(1).max(MAX_POST_LENGTH),
  mentions: z
    .array(MentionSchema)
    .max(MAX_MENTIONS)
    .superRefine(rejectDuplicateMentionPlaceholders)
    .optional(),
}).strict();
export type CreateSquareStreetzTextPostInput = z.infer<typeof CreateSquareStreetzTextPostInputSchema>;

// --- Authoritative mutation RESULTS -----------------------------------------
// The no-optimistic-updates client patches these straight into its React Query
// cache. Every field is something the callable's transaction ALREADY knows at
// commit time — never a value that would force a new read. Result schemas are
// deliberately NON-strict (server → client posture: the backend may append
// fields without breaking older clients — same as SendGuildChatMessageResultSchema).
// (The addToMentionHistory result lives in ../doc-schemas/social.ts — it composes
// MentionHistoryItemSchema, and that module imports THIS one, so declaring it here
// would be a module cycle. It is re-exported on ./schemas via schemas/index.ts.)

export const LikeSquareStreetzPostResultSchema = z.object({
  success: z.literal(true),
  postId: z.string().min(1),
  /** Final caller like-state after commit (an idempotent re-like stays true). */
  isLiked: z.literal(true),
  /** Authoritative post like count at commit — the like transaction reads the
   * post doc, so this is the committed count, not a client guess. */
  likeCount: z.number().int().nonnegative(),
  /** Post author uid — the liked post lives in the AUTHOR's post-list caches. */
  authorId: z.string().min(1),
});
export type LikeSquareStreetzPostResult = z.infer<typeof LikeSquareStreetzPostResultSchema>;

export const UnlikeSquareStreetzPostResultSchema = z.object({
  success: z.literal(true),
  postId: z.string().min(1),
  isLiked: z.literal(false),
  likeCount: z.number().int().nonnegative(),
  authorId: z.string().min(1),
});
export type UnlikeSquareStreetzPostResult = z.infer<typeof UnlikeSquareStreetzPostResultSchema>;

export const FollowTargetResultSchema = z.object({
  success: z.literal(true),
  targetType: FollowableTargetTypeSchema,
  targetId: z.string().min(1),
  /** Final caller follow-state after commit. NOTE: deliberately NO follower count —
   * the counter is a blind FieldValue.increment the transaction never reads. */
  isFollowing: z.literal(true),
  /** True when the edge already existed (idempotent re-follow). */
  alreadyFollowing: z.boolean(),
});
export type FollowTargetResult = z.infer<typeof FollowTargetResultSchema>;

export const UnfollowTargetResultSchema = z.object({
  success: z.literal(true),
  targetType: FollowableTargetTypeSchema,
  targetId: z.string().min(1),
  isFollowing: z.literal(false),
  /** False when there was no edge to remove (idempotent unfollow). */
  wasFollowing: z.boolean(),
});
export type UnfollowTargetResult = z.infer<typeof UnfollowTargetResultSchema>;



