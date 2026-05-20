import { createPendingMediaSchemas } from "@ttt-productions/media-schemas";
import type { z } from "zod";
import { FileOriginSchema } from "./file-origin.js";
import { DomainEventSchema } from "./domain-events.js";

const schemas = createPendingMediaSchemas({
  fileOriginSchema: FileOriginSchema,
  domainEventSchema: DomainEventSchema,
});

export const PendingMediaErrorCategorySchema = schemas.PendingMediaErrorCategorySchema;
export const PendingMediaResultSchema = schemas.PendingMediaResultSchema;
export const PendingMediaPendingSchema = schemas.PendingMediaPendingSchema;
export const PendingMediaProcessingSchema = schemas.PendingMediaProcessingSchema;
export const PendingMediaCompletedSchema = schemas.PendingMediaCompletedSchema;
export const PendingMediaFailedSchema = schemas.PendingMediaFailedSchema;
export const PendingMediaRejectedSchema = schemas.PendingMediaRejectedSchema;
export const PendingMediaSchema = schemas.PendingMediaSchema;

export const ArchivedPendingMediaCompletedSchema = schemas.ArchivedPendingMediaCompletedSchema;
export const ArchivedPendingMediaFailedSchema = schemas.ArchivedPendingMediaFailedSchema;
export const ArchivedPendingMediaRejectedSchema = schemas.ArchivedPendingMediaRejectedSchema;
export const ArchivedPendingMediaSchema = schemas.ArchivedPendingMediaSchema;

export type PendingMediaErrorCategory = z.infer<typeof PendingMediaErrorCategorySchema>;
export type PendingMediaResult = z.infer<typeof PendingMediaResultSchema>;
export type PendingMediaPending = z.infer<typeof PendingMediaPendingSchema>;
export type PendingMediaProcessing = z.infer<typeof PendingMediaProcessingSchema>;
export type PendingMediaCompleted = z.infer<typeof PendingMediaCompletedSchema>;
export type PendingMediaFailed = z.infer<typeof PendingMediaFailedSchema>;
export type PendingMediaRejected = z.infer<typeof PendingMediaRejectedSchema>;
export type PendingMedia = z.infer<typeof PendingMediaSchema>;
export type ArchivedPendingMedia = z.infer<typeof ArchivedPendingMediaSchema>;

export function parsePendingMedia(input: unknown): PendingMedia {
  return PendingMediaSchema.parse(input);
}

export function parseArchivedPendingMedia(input: unknown): ArchivedPendingMedia {
  return ArchivedPendingMediaSchema.parse(input);
}
