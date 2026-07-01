import { z } from 'zod';

// Clears a single finished (completed/failed/rejected) upload from the File-status
// tray. The callable derives ownership + terminal-status from the stored pendingMedia
// doc; this input only carries which one. Tray UX state — not a sensitive action.
export const ClearUploadActivityRequestSchema = z
  .object({
    pendingMediaId: z.string().min(1),
  })
  .strict();
export type ClearUploadActivityRequest = z.infer<typeof ClearUploadActivityRequestSchema>;

// Marks terminal pendingMedia docs as seen in the File-status tray (parity with
// notification `seenAt`). The frontend sends every currently-unseen terminal
// pendingMediaId when the File-status tab opens; the callable owns the per-doc
// ownership/terminal/already-seen filtering.
export const MarkUploadsSeenRequestSchema = z
  .object({
    pendingMediaIds: z.array(z.string().min(1)).min(1).max(200),
  })
  .strict();
export type MarkUploadsSeenRequest = z.infer<typeof MarkUploadsSeenRequestSchema>;
