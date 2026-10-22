import { z } from 'zod';
import { craftSkillIdSchema, addRemoveActionSchema } from './atoms.js';
import { CRAFT_SKILL_TAG_VALUES } from '../constants/options.js';

export const DeleteCraftSkillInputSchema = z
  .object({
    craftSkillId: craftSkillIdSchema,
  })
  .strict();
export type DeleteCraftSkillInput = z.infer<typeof DeleteCraftSkillInputSchema>;

export const UpdateCraftSkillTagsInputSchema = z
  .object({
    craftSkillId: craftSkillIdSchema,
    tag: z.enum(CRAFT_SKILL_TAG_VALUES),
    action: addRemoveActionSchema,
  })
  .strict();
export type UpdateCraftSkillTagsInput = z.infer<typeof UpdateCraftSkillTagsInputSchema>;

export const UploadCraftSkillAcceptedResultSchema = z.object({
  success: z.literal(true),
  pendingMediaId: z.string().min(1),
  craftSkillId: craftSkillIdSchema,
});
export type UploadCraftSkillAcceptedResult = z.infer<typeof UploadCraftSkillAcceptedResultSchema>;

export const DeleteCraftSkillResultSchema = z.object({
  success: z.literal(true),
  craftSkillId: craftSkillIdSchema,
});
export type DeleteCraftSkillResult = z.infer<typeof DeleteCraftSkillResultSchema>;

export const UpdateCraftSkillTagsResultSchema = z.object({
  success: z.literal(true),
  craftSkillId: craftSkillIdSchema,
  newTags: z.array(z.enum(CRAFT_SKILL_TAG_VALUES)),
  changed: z.boolean(),
  action: addRemoveActionSchema,
});
export type UpdateCraftSkillTagsResult = z.infer<typeof UpdateCraftSkillTagsResultSchema>;

export const GetOwnHiddenCraftSkillCountInputSchema = z.object({}).strict();
export type GetOwnHiddenCraftSkillCountInput = z.infer<
  typeof GetOwnHiddenCraftSkillCountInputSchema
>;

export const GetOwnHiddenCraftSkillCountResultSchema = z.object({
  hiddenCount: z.number().int().nonnegative(),
});
export type GetOwnHiddenCraftSkillCountResult = z.infer<
  typeof GetOwnHiddenCraftSkillCountResultSchema
>;
