import { z } from 'zod';
import { craftSkillIdSchema, addRemoveActionSchema } from './atoms.js';

export const DeleteCraftSkillInputSchema = z.object({
  craftSkillId: craftSkillIdSchema,
}).strict();
export type DeleteCraftSkillInput = z.infer<typeof DeleteCraftSkillInputSchema>;

export const UpdateCraftSkillTagsInputSchema = z.object({
  craftSkillId: craftSkillIdSchema,
  tag: z.string().min(1),
  action: addRemoveActionSchema,
}).strict();
export type UpdateCraftSkillTagsInput = z.infer<typeof UpdateCraftSkillTagsInputSchema>;


