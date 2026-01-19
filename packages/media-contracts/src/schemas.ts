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

export const MediaModerationSpecSchema = z
  .object({
    provider: z.string().optional(),
    stage: z.enum(["input", "output", "both"]).optional(),
    rejectOn: z.array(z.enum(["flagged", "rejected"])).optional(),
  })
  .strict();

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
    videoOrientation: z.enum(["vertical", "horizontal", "any"]).optional(),
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

export function parseMediaProcessingSpec(input: unknown) {
  return MediaProcessingSpecSchema.parse(input);
}
