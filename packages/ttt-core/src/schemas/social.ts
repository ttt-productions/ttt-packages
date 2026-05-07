import { z } from 'zod';

export const LikeStreetzPostInputSchema = z.object({
  postId: z.string().min(1),
}).strict();
export type LikeStreetzPostInput = z.infer<typeof LikeStreetzPostInputSchema>;

export const UnlikeStreetzPostInputSchema = z.object({
  postId: z.string().min(1),
}).strict();
export type UnlikeStreetzPostInput = z.infer<typeof UnlikeStreetzPostInputSchema>;
