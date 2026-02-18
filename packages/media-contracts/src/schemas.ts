import { z } from "zod";

// ---- primitives ----

export const TimestampLikeSchema = z.union([z.number(), z.string()]);

export const SimplifiedMediaTypeSchema = z.enum(["image", "video", "audio", "other"]);

export const FileCategorySchema = z.enum([
  "profile",
  "post",
  "message",
  "comment",
  "report",
  "admin",
  "other",
]);

export const MediaKindSchema = z.enum(["image", "video", "audio", "file"]);

export const MediaProcessingStatusSchema = z.enum(["pending", "processing", "ready", "failed", "rejected"]);

export const MediaJobStatusSchema = z.enum([
  "selecting",
  "uploading",
  "queued",
  "processing",
  "ready",
  "rejected",
  "failed",
]);

export const MediaErrorCodeSchema = z.enum([
  "invalid_mime",
  "too_large",
  "too_long",
  "upload_failed",
  "upload_canceled",
  "upload_timeout",
  "network_error",
  "quota_exceeded",
  "invalid_spec",
  "unsupported_format",
  "processing_failed",
  "processing_canceled",
  "not_found",
  "permission_denied",
  "orientation_mismatch",
  "aspect_ratio_mismatch",
  "dimensions_mismatch",
  "rejected",
  "unknown",
]);

// ---- small structs ----

export const MediaOwnerRefSchema = z
  .object({
    uid: z.string().min(1),
  })
  .strict();

export const MediaThreadRefSchema = z
  .object({
    threadId: z.string().min(1),
  })
  .strict();

export const MediaAcceptSchema = z
  .object({
    mimes: z.array(z.string()).optional(),
    kinds: z.array(MediaKindSchema).optional(),
  })
  .strict();

export const MediaCropSpecSchema = z
  .object({
    aspectRatio: z.number().positive(),
    outputWidth: z.number().int().positive(),
    outputHeight: z.number().int().positive(),
    format: z.enum(["jpeg", "png", "webp", "avif"]).optional(),
    quality: z.number().int().min(1).max(100).optional(),
    aspectRatioDisplay: z.string().optional(),
  })
  .strict();

export const ImageVariantSpecSchema = z
  .object({
    key: z.string().min(1),
    maxWidth: z.number().int().positive().optional(),
    maxHeight: z.number().int().positive().optional(),
    crop: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        gravity: z.enum(["center", "top", "bottom", "left", "right"]).optional(),
      })
      .strict()
      .optional(),
    format: z.enum(["jpeg", "png", "webp", "avif"]).optional(),
    quality: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export const MediaClientConstraintsSchema = z
  .object({
    allowPick: z.boolean().optional(),
    allowCapturePhoto: z.boolean().optional(),
    allowRecordVideo: z.boolean().optional(),
    allowRecordAudio: z.boolean().optional(),
    cameraFacingMode: z.enum(["user", "environment"]).optional(),
    maxRecordDurationSec: z.number().positive().optional(),
  })
  .strict();

// ---- moderation ----

export const MediaModerationStatusSchema = z.enum(["passed", "flagged", "rejected", "error"]);

export const MediaModerationFindingSchema = z
  .object({
    category: z.string().optional(),
    label: z.string().optional(),
    score: z.number().optional(),
    severity: z.string().optional(),
    reasons: z.array(z.string()).optional(),
    meta: z.record(z.unknown()).optional(),
  })
  .strict();

export const MediaModerationResultSchema = z
  .object({
    status: MediaModerationStatusSchema,
    provider: z.string().optional(),
    reasons: z.array(z.string()).optional(),
    findings: z.array(MediaModerationFindingSchema).optional(),
    reviewedAt: TimestampLikeSchema.optional(),
  })
  .strict();

export const MediaModerationSpecSchema = z
  .object({
    provider: z.string().optional(),
    stage: z.enum(["input", "output", "both"]).optional(),
    rejectOn: z.array(z.enum(["flagged", "rejected"])).optional(),
    config: z.record(z.unknown()).optional(),
  })
  .strict();

// ---- processing spec/result ----

export const VideoOrientationSchema = z.enum(["vertical", "horizontal", "any"]);

export const MediaProcessingSpecSchema = z
  .object({
    specVersion: z.union([z.literal(1), z.literal(2)]).optional(),
    kind: z.enum(["image", "video", "audio", "generic"]),
    accept: MediaAcceptSchema.optional(),
    maxBytes: z.number().int().positive().optional(),
    maxOutputBytes: z.number().int().positive().optional(),
    maxTotalOutputBytes: z.number().int().positive().optional(),
    maxDurationSec: z.number().positive().optional(),
    requiredAspectRatio: z.number().positive().optional(),
    aspectRatioTolerance: z.number().positive().optional(),
    requiredWidth: z.number().int().positive().optional(),
    requiredHeight: z.number().int().positive().optional(),
    videoOrientation: VideoOrientationSchema.optional(),
    allowAutoFormat: z.boolean().optional(),
    imageCrop: MediaCropSpecSchema.optional(),
    client: MediaClientConstraintsSchema.optional(),
    moderation: MediaModerationSpecSchema.optional(),
    image: z
      .object({
        variants: z.array(ImageVariantSpecSchema).min(1),
        stripMetadata: z.boolean().optional(),
      })
      .strict()
      .optional(),
    video: z
      .object({
        maxDurationSec: z.number().positive().optional(),
        preset: z.enum([
          "ultrafast", "superfast", "veryfast", "faster",
          "fast", "medium", "slow", "slower", "veryslow",
        ]).optional(),
        crf: z.number().int().min(1).max(51).optional(),
        scaleMode: z.enum(["crop", "fit"]).optional(),
      })
      .strict()
      .optional(),
    audio: z
      .object({
        maxDurationSec: z.number().positive().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const MediaProcessingErrorSchema = z
  .object({
    code: MediaErrorCodeSchema,
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  })
  .strict();

export const MediaOutputSchema = z
  .object({
    key: z.string().min(1),
    url: z.string().min(1),
    path: z.string().optional(),
    mime: z.string().optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    durationSec: z.number().positive().optional(),
    extra: z.record(z.unknown()).optional(),
  })
  .strict();

export const MediaProcessingResultSchema = z
  .object({
    ok: z.boolean(),
    mediaType: SimplifiedMediaTypeSchema,
    outputs: z.array(MediaOutputSchema).optional(),
    meta: z
      .object({
        mime: z.string().optional(),
        sizeBytes: z.number().int().nonnegative().optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        durationSec: z.number().positive().optional(),
      })
      .strict()
      .optional(),
    warnings: z.array(z.string()).optional(),
    error: MediaProcessingErrorSchema.optional(),
    moderation: MediaModerationResultSchema.optional(),
  })
  .strict();

// ---- jobs/docs ----

export const MediaJobStatusPayloadSchema = z
  .object({
    status: MediaJobStatusSchema,
    progress: z.number().min(0).max(1).optional(),
    reasonCode: z.string().optional(),
    updatedAt: TimestampLikeSchema.optional(),
    mediaDocId: z.string().optional(),
    extra: z.record(z.unknown()).optional(),
  })
  .strict();

export const PendingMediaDocSchema = z
  .object({
    id: z.string().min(1),
    owner: MediaOwnerRefSchema,
    thread: MediaThreadRefSchema.optional(),
    category: FileCategorySchema.optional(),
    originalName: z.string().optional(),
    mime: z.string().optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    mediaType: SimplifiedMediaTypeSchema,
    originalPath: z.string().optional(),
    originalUrl: z.string().optional(),
    status: MediaProcessingStatusSchema,
    spec: MediaProcessingSpecSchema.optional(),
    result: MediaProcessingResultSchema.optional(),
    error: MediaProcessingErrorSchema.optional(),
    createdAt: TimestampLikeSchema.optional(),
    updatedAt: TimestampLikeSchema.optional(),
  })
  .strict();

// ---- parsers ----

export function parseMediaProcessingSpec(input: unknown) {
  return MediaProcessingSpecSchema.parse(input);
}

export function parseMediaProcessingResult(input: unknown) {
  return MediaProcessingResultSchema.parse(input);
}

export function parsePendingMediaDoc(input: unknown) {
  return PendingMediaDocSchema.parse(input);
}
