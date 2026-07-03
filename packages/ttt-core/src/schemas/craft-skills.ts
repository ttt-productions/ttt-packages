import { z } from 'zod';
import { craftSkillIdSchema, addRemoveActionSchema } from './atoms.js';
import { CRAFT_SKILL_TAG_OPTIONS } from '../constants/options.js';

const CRAFT_SKILL_TAG_VALUES = CRAFT_SKILL_TAG_OPTIONS as unknown as [string, ...string[]];

export const DeleteCraftSkillInputSchema = z.object({
  craftSkillId: craftSkillIdSchema,
}).strict();
export type DeleteCraftSkillInput = z.infer<typeof DeleteCraftSkillInputSchema>;

// `tag` is constrained to the canonical option list — the wire schema is the moderation
// boundary (Invariant 12). A free-text tag would put unmoderated public text on the profile
// badge + pollute the craftSkillsByTag index with junk doc IDs (and could break path builders).
export const UpdateCraftSkillTagsInputSchema = z.object({
  craftSkillId: craftSkillIdSchema,
  tag: z.enum(CRAFT_SKILL_TAG_VALUES),
  action: addRemoveActionSchema,
}).strict();
export type UpdateCraftSkillTagsInput = z.infer<typeof UpdateCraftSkillTagsInputSchema>;


