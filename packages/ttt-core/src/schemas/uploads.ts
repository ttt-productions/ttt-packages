import { z } from 'zod';
import { pendingMediaIdSchema } from './atoms.js';
import { MAX_UPLOADS_MARKED_SEEN_PER_CALL } from '../media/upload-tray-display.js';
import { StartUploadResponseSchema } from '../media/start-upload.js';
import { UploadCraftSkillAcceptedResultSchema } from './craft-skills.js';
import { ApplyToCommissionAcceptedResultSchema } from './commissions.js';
import { CreateAuditionEntryAcceptedResultSchema } from './auditions.js';

export const ClearUploadActivityRequestSchema = z
  .object({
    pendingMediaId: pendingMediaIdSchema,
  })
  .strict();
export type ClearUploadActivityRequest = z.infer<typeof ClearUploadActivityRequestSchema>;

export const ClearUploadActivityResultSchema = z.object({
  ok: z.literal(true),
});
export type ClearUploadActivityResult = z.infer<typeof ClearUploadActivityResultSchema>;

export const MarkUploadsSeenRequestSchema = z
  .object({
    pendingMediaIds: z.array(pendingMediaIdSchema).min(1).max(MAX_UPLOADS_MARKED_SEEN_PER_CALL),
  })
  .strict();
export type MarkUploadsSeenRequest = z.infer<typeof MarkUploadsSeenRequestSchema>;

export const MarkUploadsSeenResultSchema = z.object({
  ok: z.literal(true),
  marked: z.number().int().nonnegative(),
});
export type MarkUploadsSeenResult = z.infer<typeof MarkUploadsSeenResultSchema>;

export const StartUploadResultSchema = z.union([
  StartUploadResponseSchema,
  UploadCraftSkillAcceptedResultSchema,
  ApplyToCommissionAcceptedResultSchema,
  CreateAuditionEntryAcceptedResultSchema,
]);
export type StartUploadResult = z.infer<typeof StartUploadResultSchema>;
