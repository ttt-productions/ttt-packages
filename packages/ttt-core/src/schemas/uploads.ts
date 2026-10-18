import { z } from 'zod';
import { pendingMediaIdSchema } from './atoms.js';
import { MAX_UPLOADS_MARKED_SEEN_PER_CALL } from '../media/upload-tray-display.js';
import { StartUploadResponseSchema } from '../media/start-upload.js';
import { UploadCraftSkillAcceptedResultSchema } from './craft-skills.js';
import { ApplyToCommissionAcceptedResultSchema } from './commissions.js';
import { CreateAuditionEntryAcceptedResultSchema } from './auditions.js';

// Clears a single finished (completed/failed/rejected) upload from the File-status
// tray. The callable derives ownership + terminal-status from the stored pendingMedia
// doc; this input only carries which one. Tray UX state — not a sensitive action.
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

// Marks terminal pendingMedia docs as seen in the File-status tray (parity with
// notification `seenAt`). The frontend sends every currently-unseen terminal
// pendingMediaId when the File-status tab opens; the callable owns the per-doc
// ownership/terminal/already-seen filtering.
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

// The member startUpload answers by lane: most lanes return the pending media doc it opened;
// the craft-skill, commission-application and audition-entry lanes accept the upload outright.
export const StartUploadResultSchema = z.union([
  StartUploadResponseSchema,
  UploadCraftSkillAcceptedResultSchema,
  ApplyToCommissionAcceptedResultSchema,
  CreateAuditionEntryAcceptedResultSchema,
]);
export type StartUploadResult = z.infer<typeof StartUploadResultSchema>;
