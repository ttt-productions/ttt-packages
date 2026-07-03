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



