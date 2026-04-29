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
  SimplifiedMediaTypeSchema,
  TTTMediaOriginEntrySchema,
  TTTMediaProcessingByKindSchema,
  TimestampLikeSchema,
  VideoOrientationSchema,
  ImageVariantSpecSchema,
  MediaThreadRefSchema,
  ClientContextSchema,
  PendingMediaSchema,
  PendingMediaPendingSchema,
  PendingMediaProcessingSchema,
  PendingMediaCompletedSchema,
  PendingMediaFailedSchema,
  PendingMediaRejectedSchema,
  PendingMediaResultSchema,
  PendingMediaErrorCategorySchema,
  SerializedQueryKeySchema,
  StartUploadRequestSchema,
  StartUploadResponseSchema,
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

// ---- registry entry ----

export type TTTMediaProcessingByKind = z.infer<typeof TTTMediaProcessingByKindSchema>;
export type TTTMediaOriginEntry = z.infer<typeof TTTMediaOriginEntrySchema>;

// ---- unified upload pipeline (Phase 1.5) ----

export type ClientContext = z.infer<typeof ClientContextSchema>;
export type SerializedQueryKey = z.infer<typeof SerializedQueryKeySchema>;
export type PendingMediaResult = z.infer<typeof PendingMediaResultSchema>;
export type PendingMediaErrorCategory = z.infer<typeof PendingMediaErrorCategorySchema>;
export type PendingMediaPending = z.infer<typeof PendingMediaPendingSchema>;
export type PendingMediaProcessing = z.infer<typeof PendingMediaProcessingSchema>;
export type PendingMediaCompleted = z.infer<typeof PendingMediaCompletedSchema>;
export type PendingMediaFailed = z.infer<typeof PendingMediaFailedSchema>;
export type PendingMediaRejected = z.infer<typeof PendingMediaRejectedSchema>;
export type PendingMedia = z.infer<typeof PendingMediaSchema>;

export type StartUploadRequest = z.infer<typeof StartUploadRequestSchema>;
export type StartUploadResponse = z.infer<typeof StartUploadResponseSchema>;
