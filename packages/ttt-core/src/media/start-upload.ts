import { z } from "zod";
import { ClientContextSchema } from "@ttt-productions/media-schemas";
import { FileOriginSchema } from "./file-origin.js";

export const StartUploadRequestSchema = z
  .object({
    storagePath: z.string().min(1),
    originalFileName: z.string().min(1),
    fileOrigin: FileOriginSchema,
    targetInfo: z.unknown().optional(),
    textContent: z.string().optional(),
    clientContext: ClientContextSchema,
  })
  .strict();

export const StartUploadResponseSchema = z
  .object({
    pendingMediaId: z.string().min(1),
  })
  .strict();

export type StartUploadRequest = z.infer<typeof StartUploadRequestSchema>;
export type StartUploadResponse = z.infer<typeof StartUploadResponseSchema>;
