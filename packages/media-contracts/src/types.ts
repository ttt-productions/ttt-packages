import type { z } from "zod";
import {
  FileCategorySchema,
  MediaAcceptSchema,
  MediaClientConstraintsSchema,
  MediaCropSpecSchema,
  MediaErrorCodeSchema,
  MediaJobStatusPayloadSchema,
  MediaJobStatusSchema,
  MediaKindSchema,
  MediaModerationFindingSchema,
  MediaModerationResultSchema,
  MediaModerationSpecSchema,
  MediaModerationStatusSchema,
  MediaOutputSchema,
  MediaOwnerRefSchema,
  MediaProcessingErrorSchema,
  MediaProcessingResultSchema,
  MediaProcessingSpecSchema,
  MediaProcessingStatusSchema,
  PendingMediaDocSchema,
  SimplifiedMediaTypeSchema,
  TimestampLikeSchema,
  VideoOrientationSchema,
  ImageVariantSpecSchema,
  MediaThreadRefSchema,
} from "./schemas.js";

// ---- basic enums / scalars ----

export type TimestampLike = z.infer<typeof TimestampLikeSchema>;

export type SimplifiedMediaType = z.infer<typeof SimplifiedMediaTypeSchema>;
export type FileCategory = z.infer<typeof FileCategorySchema>;
export type MediaKind = z.infer<typeof MediaKindSchema>;

export type MediaProcessingStatus = z.infer<typeof MediaProcessingStatusSchema>;
export type MediaJobStatus = z.infer<typeof MediaJobStatusSchema>;
export type MediaErrorCode = z.infer<typeof MediaErrorCodeSchema>;

export type VideoOrientation = z.infer<typeof VideoOrientationSchema>;

// ---- small structs ----

export type MediaOwnerRef = z.infer<typeof MediaOwnerRefSchema>;
export type MediaThreadRef = z.infer<typeof MediaThreadRefSchema>;
export type MediaAccept = z.infer<typeof MediaAcceptSchema>;
export type MediaClientConstraints = z.infer<typeof MediaClientConstraintsSchema>;

export type MediaCropSpec = z.infer<typeof MediaCropSpecSchema>;
export type ImageVariantSpec = z.infer<typeof ImageVariantSpecSchema>;

// ---- moderation ----

export type MediaModerationStatus = z.infer<typeof MediaModerationStatusSchema>;
export type MediaModerationFinding = z.infer<typeof MediaModerationFindingSchema>;
export type MediaModerationResult = z.infer<typeof MediaModerationResultSchema>;
export type MediaModerationSpec = z.infer<typeof MediaModerationSpecSchema>;

// ---- processing spec/result ----

export type MediaProcessingSpec = z.infer<typeof MediaProcessingSpecSchema>;
export type MediaProcessingError = z.infer<typeof MediaProcessingErrorSchema>;
export type MediaOutput = z.infer<typeof MediaOutputSchema>;
export type MediaProcessingResult = z.infer<typeof MediaProcessingResultSchema>;

// ---- jobs/docs ----

export type MediaJobStatusPayload = z.infer<typeof MediaJobStatusPayloadSchema>;
export type PendingMediaDoc = z.infer<typeof PendingMediaDocSchema>;
