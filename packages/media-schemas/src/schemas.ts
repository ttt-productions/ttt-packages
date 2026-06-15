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

// Publication/serving readiness — ORTHOGONAL to the processing-outcome `status`.
// A media upload's processing can be `completed` while it is not yet servable
// from every edge; this axis tracks that readiness so the UI never shows "Done"
// off processing-complete alone. notStarted → activating → publishing → live
// (or publicationFailed). See ttt-prod media-assets-and-protected-serving.md
// (serving authority + publication gating) and upload-and-media-pipeline.md.
export const MediaPublicationStateSchema = z.enum([
  "notStarted",
  "activating",
  "publishing",
  "live",
  "publicationFailed",
]);
export type MediaPublicationState = z.infer<typeof MediaPublicationStateSchema>;

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
    shape: z.enum(["rect", "round"]).optional(),
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
    meta: z.record(z.string(), z.unknown()).optional(),
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
    config: z.record(z.string(), z.unknown()).optional(),
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

// ---- registry entry (upload contract + optional processing pipeline) ----

export const MediaProcessingByKindSchema = z
  .object({
    image: MediaProcessingSpecSchema.optional(),
    video: MediaProcessingSpecSchema.optional(),
    audio: MediaProcessingSpecSchema.optional(),
  })
  .strict();

export const MediaOriginSpecSchema = MediaProcessingSpecSchema
  .omit({
    image: true,
    video: true,
    audio: true,
    requiredWidth: true,
    requiredHeight: true,
    allowAutoFormat: true,
  })
  .extend({
    processing: MediaProcessingByKindSchema.optional(),
  });

export const MediaProcessingErrorSchema = z
  .object({
    code: MediaErrorCodeSchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const MediaOutputSchema = z
  .object({
    key: z.string().min(1),
    // Internal-only (e.g. local file:// paths mid-pipeline). Final platform
    // persistence stores object keys / asset refs — never URLs.
    url: z.string().min(1).optional(),
    path: z.string().optional(),
    mime: z.string().optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    durationSec: z.number().positive().optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const MediaProcessingResultMetaSchema = z
  .object({
    mime: z.string().optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    durationSec: z.number().positive().optional(),
  })
  .strict();

const mediaProcessingResultSharedShape = {
  mediaType: SimplifiedMediaTypeSchema,
  outputs: z.array(MediaOutputSchema).optional(),
  meta: MediaProcessingResultMetaSchema.optional(),
  warnings: z.array(z.string()).optional(),
  moderation: MediaModerationResultSchema.optional(),
};

export const MediaProcessingResultSchema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      ...mediaProcessingResultSharedShape,
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      error: MediaProcessingErrorSchema,
      ...mediaProcessingResultSharedShape,
    })
    .strict(),
]);

// ---- jobs/docs ----

export const MediaJobStatusPayloadSchema = z
  .object({
    status: MediaJobStatusSchema,
    progress: z.number().min(0).max(1).optional(),
    reasonCode: z.string().optional(),
    updatedAt: TimestampLikeSchema.optional(),
    mediaDocId: z.string().optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

// ---- parsers ----

export function parseMediaProcessingSpec(input: unknown) {
  return MediaProcessingSpecSchema.parse(input);
}

export function parseMediaProcessingResult(input: unknown) {
  return MediaProcessingResultSchema.parse(input);
}

// ---- client context (used by factory) ----

export const ClientContextSchema = z
  .object({
    surface: z.string().min(1),
    targetIds: z.array(z.string().min(1)).optional(),
  })
  .strict();
