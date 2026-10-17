import { z } from 'zod';
import { pendingMediaIdSchema } from './atoms.js';
import { MAX_UPLOADS_MARKED_SEEN_PER_CALL } from '../media/upload-tray-display.js';

// Clears a single finished (completed/failed/rejected) upload from the File-status
// tray. The callable derives ownership + terminal-status from the stored pendingMedia
// doc; this input only carries which one. Tray UX state — not a sensitive action.
export const ClearUploadActivityRequestSchema = z
  .object({
    pendingMediaId: pendingMediaIdSchema,
  })
  .strict();
export type ClearUploadActivityRequest = z.infer<typeof ClearUploadActivityRequestSchema>;

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
