import { z } from 'zod';
import { skillIdSchema, addRemoveActionSchema } from './atoms.js';

export const DeleteSkillInputSchema = z.object({
  skillId: skillIdSchema,
}).strict();
export type DeleteSkillInput = z.infer<typeof DeleteSkillInputSchema>;

export const UpdateSkillTagsInputSchema = z.object({
  skillId: skillIdSchema,
  tag: z.string().min(1),
  action: addRemoveActionSchema,
}).strict();
export type UpdateSkillTagsInput = z.infer<typeof UpdateSkillTagsInputSchema>;
