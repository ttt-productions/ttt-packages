import { z } from 'zod';
import { MentionSchema } from '@ttt-productions/media-contracts';
import { userIdSchema } from './atoms.js';

export const LikeStreetzPostInputSchema = z.object({
  postId: z.string().min(1),
}).strict();
export type LikeStreetzPostInput = z.infer<typeof LikeStreetzPostInputSchema>;

export const UnlikeStreetzPostInputSchema = z.object({
  postId: z.string().min(1),
}).strict();
export type UnlikeStreetzPostInput = z.infer<typeof UnlikeStreetzPostInputSchema>;

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
