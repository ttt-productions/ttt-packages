import { z } from "zod";
import { ClientContextSchema, ClientMediaClaimSchema } from "@ttt-productions/media-schemas";
import { FileOriginSchema } from "./file-origin.js";

export const StartUploadRequestSchema = z
  .object({
    storagePath: z.string().min(1),
    originalFileName: z.string().min(1),
    fileOrigin: FileOriginSchema,
    targetInfo: z.unknown().optional(),
    textContent: z.string().optional(),
    clientContext: ClientContextSchema,
    // What the user actually DID (canonical-upload-content-classification):
    // strong for recorder/camera actions, advisory for the picker. OPTIONAL for
    // rolling-client compatibility; the server treats absence as "inspect-only"
    // (bounded claim_missing reason) and NEVER falls back to MIME authority.
    // Untrusted context — the server byte inspection is the one classification
    // authority either way.
    clientMediaClaim: ClientMediaClaimSchema.optional(),
  })
  .strict();

export const StartUploadResponseSchema = z
  .object({
    pendingMediaId: z.string().min(1),
  })
  .strict();

export type StartUploadRequest = z.infer<typeof StartUploadRequestSchema>;
export type StartUploadResponse = z.infer<typeof StartUploadResponseSchema>;
