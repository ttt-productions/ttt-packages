import { z } from 'zod';
import { documentIdSegmentSchema, squareStreetzPostIdSchema } from './atoms.js';
import {
  MentionSchema,
  SquareStreetzPostMentionsSchema,
  SquareStreetzPostTextSchema,
  refineMentionCorrespondence,
} from '../media/atoms.js';

export const LikeSquareStreetzPostInputSchema = z
  .object({
    postId: squareStreetzPostIdSchema,
  })
  .strict();
export type LikeSquareStreetzPostInput = z.infer<typeof LikeSquareStreetzPostInputSchema>;

export const UnlikeSquareStreetzPostInputSchema = z
  .object({
    postId: squareStreetzPostIdSchema,
  })
  .strict();
export type UnlikeSquareStreetzPostInput = z.infer<typeof UnlikeSquareStreetzPostInputSchema>;

export const FollowableTargetTypeSchema = z.enum(['user', 'workProject', 'workRealm']);
export type FollowableTargetType = z.infer<typeof FollowableTargetTypeSchema>;

export const FollowTargetInputSchema = z
  .object({
    targetType: FollowableTargetTypeSchema,
    targetId: documentIdSegmentSchema.max(128),
  })
  .strict();
export type FollowTargetInput = z.infer<typeof FollowTargetInputSchema>;

export const UnfollowTargetInputSchema = z
  .object({
    targetType: FollowableTargetTypeSchema,
    targetId: documentIdSegmentSchema.max(128),
  })
  .strict();
export type UnfollowTargetInput = z.infer<typeof UnfollowTargetInputSchema>;

export const AddToMentionHistoryInputSchema = z
  .object({
    mention: MentionSchema,
  })
  .strict();
export type AddToMentionHistoryInput = z.infer<typeof AddToMentionHistoryInputSchema>;

export const CreateSquareStreetzTextPostInputSchema = z
  .object({
    textContent: SquareStreetzPostTextSchema,
    mentions: SquareStreetzPostMentionsSchema.optional(),
  })
  .strict()
  .superRefine((input, ctx) => refineMentionCorrespondence(input.textContent, input.mentions, ctx));
export type CreateSquareStreetzTextPostInput = z.infer<
  typeof CreateSquareStreetzTextPostInputSchema
>;

// Result schemas are non-strict: the backend may append fields without breaking older clients.

export const LikeSquareStreetzPostResultSchema = z.object({
  success: z.literal(true),
  postId: z.string().min(1),
  isLiked: z.literal(true),
  likeCount: z.number().int().nonnegative(),
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
  // No follower count: the counter is a blind increment the transaction never reads.
  isFollowing: z.literal(true),
  alreadyFollowing: z.boolean(),
});
export type FollowTargetResult = z.infer<typeof FollowTargetResultSchema>;

export const UnfollowTargetResultSchema = z.object({
  success: z.literal(true),
  targetType: FollowableTargetTypeSchema,
  targetId: z.string().min(1),
  isFollowing: z.literal(false),
  wasFollowing: z.boolean(),
});
export type UnfollowTargetResult = z.infer<typeof UnfollowTargetResultSchema>;
