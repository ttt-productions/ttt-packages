import { z } from 'zod';
import { craftSkillIdSchema, addRemoveActionSchema } from './atoms.js';
import { CRAFT_SKILL_TAG_VALUES } from '../constants/options.js';

export const DeleteCraftSkillInputSchema = z.object({
  craftSkillId: craftSkillIdSchema,
}).strict();
export type DeleteCraftSkillInput = z.infer<typeof DeleteCraftSkillInputSchema>;

// `tag` is constrained to the canonical option list — the wire schema is the moderation
// boundary (BACKEND-106). A free-text tag would put unmoderated public text on the profile
// badge + pollute the craftSkillsByTag index with junk doc IDs (and could break path builders).
export const UpdateCraftSkillTagsInputSchema = z.object({
  craftSkillId: craftSkillIdSchema,
  tag: z.enum(CRAFT_SKILL_TAG_VALUES),
  action: addRemoveActionSchema,
}).strict();
export type UpdateCraftSkillTagsInput = z.infer<typeof UpdateCraftSkillTagsInputSchema>;

// --- Authoritative mutation RESULTS (non-strict server → client posture) ---

// Acceptance result of the craft-skill CREATE flow (startUpload with fileOrigin
// 'craft-skill-media'). Creation itself is asynchronous via the media pipeline; the
// skill doc id is minted server-side AS the pendingMedia id (processCraftSkill:
// craftSkillId = pendingFile.id), so it is knowable at accept time without any read.
export const UploadCraftSkillAcceptedResultSchema = z.object({
  success: z.literal(true),
  pendingMediaId: z.string().min(1),
  /** Equal to pendingMediaId by pipeline contract. */
  craftSkillId: craftSkillIdSchema,
});
export type UploadCraftSkillAcceptedResult = z.infer<typeof UploadCraftSkillAcceptedResultSchema>;

// deleteCraftSkill: the skill doc + tag-index mirrors are gone at commit. The Streetz
// feed patch (updatedPostIds/updates) deliberately does NOT ride this result — the
// DELETE_CRAFT_SKILL post update is enqueued to the squareAnnouncementJobs outbox in
// the delete transaction and applied by the outbox worker.
export const DeleteCraftSkillResultSchema = z.object({
  success: z.literal(true),
  craftSkillId: craftSkillIdSchema,
});
export type DeleteCraftSkillResult = z.infer<typeof DeleteCraftSkillResultSchema>;

export const UpdateCraftSkillTagsResultSchema = z.object({
  success: z.literal(true),
  craftSkillId: craftSkillIdSchema,
  /** Authoritative tag list after commit (unchanged when `changed` is false). */
  newTags: z.array(z.enum(CRAFT_SKILL_TAG_VALUES)),
  changed: z.boolean(),
  /** Echo of the requested action (always known — it is the input). */
  action: addRemoveActionSchema,
});
export type UpdateCraftSkillTagsResult = z.infer<typeof UpdateCraftSkillTagsResultSchema>;


