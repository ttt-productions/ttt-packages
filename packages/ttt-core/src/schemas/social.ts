import { z } from 'zod';
import { MentionSchema } from '../media/atoms.js';
import { userIdSchema } from './atoms.js';
import { MAX_POST_LENGTH } from '../constants/business.js';

export const LikeSquareStreetzPostInputSchema = z.object({
  postId: z.string().min(1),
}).strict();
export type LikeSquareStreetzPostInput = z.infer<typeof LikeSquareStreetzPostInputSchema>;

export const UnlikeSquareStreetzPostInputSchema = z.object({
  postId: z.string().min(1),
}).strict();
export type UnlikeSquareStreetzPostInput = z.infer<typeof UnlikeSquareStreetzPostInputSchema>;

export const FollowUserInputSchema = z.object({
  targetUid: userIdSchema,
}).strict();
export type FollowUserInput = z.infer<typeof FollowUserInputSchema>;

export const UnfollowUserInputSchema = z.object({
  targetUid: userIdSchema,
}).strict();
export type UnfollowUserInput = z.infer<typeof UnfollowUserInputSchema>;

export const AddToMentionHistoryInputSchema = z.object({
  mention: MentionSchema,
}).strict();
export type AddToMentionHistoryInput = z.infer<typeof AddToMentionHistoryInputSchema>;

export const CreateSquareStreetzTextPostInputSchema = z.object({
  textContent: z.string().min(1).max(MAX_POST_LENGTH),
  mentions: z.array(MentionSchema).optional(),
}).strict();
export type CreateSquareStreetzTextPostInput = z.infer<typeof CreateSquareStreetzTextPostInputSchema>;



