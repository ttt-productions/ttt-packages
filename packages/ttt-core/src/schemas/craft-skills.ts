import { z } from 'zod';
import { craftSkillIdSchema, addRemoveActionSchema } from './atoms.js';

export const DeleteSkillInputSchema = z.object({
  skillId: craftSkillIdSchema,
}).strict();
export type DeleteSkillInput = z.infer<typeof DeleteSkillInputSchema>;

export const UpdateSkillTagsInputSchema = z.object({
  skillId: craftSkillIdSchema,
  tag: z.string().min(1),
  action: addRemoveActionSchema,
}).strict();
export type UpdateSkillTagsInput = z.infer<typeof UpdateSkillTagsInputSchema>;
