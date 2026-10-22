import type { z } from 'zod';
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
  MediaOriginSpecSchema,
  MediaProcessingByKindSchema,
  TimestampLikeSchema,
  VideoOrientationSchema,
  ImageVariantSpecSchema,
  MediaThreadRefSchema,
  ClientContextSchema,
} from './schemas.js';

export type TimestampLike = z.infer<typeof TimestampLikeSchema>;

export type SimplifiedMediaType = z.infer<typeof SimplifiedMediaTypeSchema>;
export type FileCategory = z.infer<typeof FileCategorySchema>;
export type MediaKind = z.infer<typeof MediaKindSchema>;

export type MediaProcessingStatus = z.infer<typeof MediaProcessingStatusSchema>;
export type MediaJobStatus = z.infer<typeof MediaJobStatusSchema>;
export type MediaErrorCode = z.infer<typeof MediaErrorCodeSchema>;

export type VideoOrientation = z.infer<typeof VideoOrientationSchema>;

export type MediaOwnerRef = z.infer<typeof MediaOwnerRefSchema>;
export type MediaThreadRef = z.infer<typeof MediaThreadRefSchema>;
export type MediaAccept = z.infer<typeof MediaAcceptSchema>;
export type MediaClientConstraints = z.infer<typeof MediaClientConstraintsSchema>;

export type MediaCropSpec = z.infer<typeof MediaCropSpecSchema>;
export type ImageVariantSpec = z.infer<typeof ImageVariantSpecSchema>;

export type MediaModerationStatus = z.infer<typeof MediaModerationStatusSchema>;
export type MediaModerationFinding = z.infer<typeof MediaModerationFindingSchema>;
export type MediaModerationResult = z.infer<typeof MediaModerationResultSchema>;
export type MediaModerationSpec = z.infer<typeof MediaModerationSpecSchema>;

export type MediaProcessingSpec = z.infer<typeof MediaProcessingSpecSchema>;
export type MediaProcessingError = z.infer<typeof MediaProcessingErrorSchema>;
export type MediaOutput = z.infer<typeof MediaOutputSchema>;
export type MediaProcessingResult = z.infer<typeof MediaProcessingResultSchema>;

export type MediaJobStatusPayload = z.infer<typeof MediaJobStatusPayloadSchema>;

export type MediaProcessingByKind = z.infer<typeof MediaProcessingByKindSchema>;
export type MediaOriginSpec = z.infer<typeof MediaOriginSpecSchema>;

export type ClientContext = z.infer<typeof ClientContextSchema>;

export type UploadPhase = 'preparing' | 'uploading' | 'finalizing';

export interface UploadState {
  phase: UploadPhase;
  percent: number | null;
}
