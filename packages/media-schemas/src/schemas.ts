import { z } from 'zod';

export const TimestampLikeSchema = z.union([z.number(), z.string()]);

export const SimplifiedMediaTypeSchema = z.enum(['image', 'video', 'audio', 'other']);

export const FileCategorySchema = z.enum([
  'profile',
  'post',
  'message',
  'comment',
  'report',
  'admin',
  'other',
]);

export const MediaKindSchema = z.enum(['image', 'video', 'audio', 'file']);

export const MediaProcessingStatusSchema = z.enum([
  'pending',
  'processing',
  'ready',
  'failed',
  'rejected',
]);

export const MediaPublicationStateSchema = z.enum([
  'notStarted',
  'activating',
  'publishing',
  'live',
  'publicationFailed',
]);
export type MediaPublicationState = z.infer<typeof MediaPublicationStateSchema>;

export const MediaJobStatusSchema = z.enum([
  'selecting',
  'uploading',
  'queued',
  'processing',
  'ready',
  'rejected',
  'failed',
]);

export const MediaErrorCodeSchema = z.enum([
  'invalid_mime',
  'too_large',
  'too_long',
  'upload_failed',
  'upload_canceled',
  'upload_timeout',
  'network_error',
  'quota_exceeded',
  'invalid_spec',
  'unsupported_format',
  'unsupported_codec',
  'kind_mismatch',
  'processing_failed',
  'processing_canceled',
  'not_found',
  'permission_denied',
  'orientation_mismatch',
  'aspect_ratio_mismatch',
  'dimensions_mismatch',
  'rejected',
  'unknown',
]);

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

// The format-id enum lives here, not in ./format-registry.ts, so MediaAcceptSchema avoids a module cycle.
export const MediaFormatIdSchema = z.enum([
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'tiff',
  'avif',
  'heic',
  'svg',
  'mp3',
  'wav',
  'flac',
  'isobmff',
  'webm',
  'ogg',
]);

export const MediaAcceptSchema = z
  .object({
    mimes: z.array(z.string()).optional(),
    kinds: z.array(MediaKindSchema).optional(),
    formats: z.array(MediaFormatIdSchema).optional(),
  })
  .strict();

export const MediaCropSpecSchema = z
  .object({
    aspectRatio: z.number().positive(),
    outputWidth: z.number().int().positive(),
    outputHeight: z.number().int().positive(),
    shape: z.enum(['rect', 'round']).optional(),
    format: z.enum(['jpeg', 'png', 'webp', 'avif']).optional(),
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
        gravity: z.enum(['center', 'top', 'bottom', 'left', 'right']).optional(),
      })
      .strict()
      .optional(),
    format: z.enum(['jpeg', 'png', 'webp', 'avif']).optional(),
    quality: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export const MediaClientConstraintsSchema = z
  .object({
    allowPick: z.boolean().optional(),
    allowCapturePhoto: z.boolean().optional(),
    allowRecordVideo: z.boolean().optional(),
    allowRecordAudio: z.boolean().optional(),
    cameraFacingMode: z.enum(['user', 'environment']).optional(),
    maxRecordDurationSec: z.number().positive().optional(),
  })
  .strict();

export const MediaModerationStatusSchema = z.enum(['passed', 'flagged', 'rejected', 'error']);

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
    stage: z.enum(['input', 'output', 'both']).optional(),
    rejectOn: z.array(z.enum(['flagged', 'rejected'])).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const VideoOrientationSchema = z.enum(['vertical', 'horizontal', 'any']);

export const MediaProcessingSpecSchema = z
  .object({
    specVersion: z.union([z.literal(1), z.literal(2)]).optional(),
    kind: z.enum(['image', 'video', 'audio', 'generic']),
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
        preset: z
          .enum([
            'ultrafast',
            'superfast',
            'veryfast',
            'faster',
            'fast',
            'medium',
            'slow',
            'slower',
            'veryslow',
          ])
          .optional(),
        crf: z.number().int().min(1).max(51).optional(),
        scaleMode: z.enum(['crop', 'fit']).optional(),
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

export const MediaProcessingByKindSchema = z
  .object({
    image: MediaProcessingSpecSchema.optional(),
    video: MediaProcessingSpecSchema.optional(),
    audio: MediaProcessingSpecSchema.optional(),
  })
  .strict();

export const MediaOriginSpecSchema = MediaProcessingSpecSchema.omit({
  image: true,
  video: true,
  audio: true,
  requiredWidth: true,
  requiredHeight: true,
  allowAutoFormat: true,
}).extend({
  processing: MediaProcessingByKindSchema.optional(),
  preserveOriginal: z.boolean().optional(),
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

export const ClientMediaClaimSourceSchema = z.enum([
  'file-picker',
  'camera-capture',
  'media-recorder',
]);
export type ClientMediaClaimSource = z.infer<typeof ClientMediaClaimSourceSchema>;

export const ClientMediaClaimSchema = z
  .object({
    kind: MediaKindSchema,
    source: ClientMediaClaimSourceSchema,
  })
  .strict();
export type ClientMediaClaim = z.infer<typeof ClientMediaClaimSchema>;

export const MediaInspectionStatusSchema = z.enum([
  'definitive',
  'indeterminate',
  'unsupported',
  'malformed',
]);
export type MediaInspectionStatus = z.infer<typeof MediaInspectionStatusSchema>;

export const MediaSafetyPlanSchema = z.enum([
  'still-image',
  'animated-image-frames',
  'video-frames',
  'audio-only',
  'audio-plus-artwork',
  'strict-video-fallback',
]);
export type MediaSafetyPlan = z.infer<typeof MediaSafetyPlanSchema>;

export const NormalizedCodecIdSchema = z.enum([
  'h264',
  'hevc',
  'vp8',
  'vp9',
  'av1',
  'theora',
  'mpeg4',
  'mjpeg',
  'aac',
  'alac',
  'opus',
  'vorbis',
  'mp3',
  'flac',
  'pcm',
  'amr',
  'other',
]);
export type NormalizedCodecId = z.infer<typeof NormalizedCodecIdSchema>;

const boundedCount = z.number().int().min(0).max(10_000);

export const MediaInspectionStreamsSchema = z
  .object({
    audio: boundedCount,
    timedVideo: boundedCount,
    attachedPictures: boundedCount,
    imageFrames: boundedCount,
    auxiliary: boundedCount,
  })
  .strict();
export type MediaInspectionStreams = z.infer<typeof MediaInspectionStreamsSchema>;

export const MediaInspectionResultSchema = z
  .object({
    inspectorVersion: z.string().min(1).max(64),
    ffprobeVersion: z.string().min(1).max(120).optional(),
    status: MediaInspectionStatusSchema,
    canonicalKind: MediaKindSchema.optional(),
    formatId: z.string().min(1).max(40).optional(),
    container: z.string().min(1).max(40),
    streams: MediaInspectionStreamsSchema,
    codecs: z
      .object({
        audio: z.array(NormalizedCodecIdSchema).max(32),
        video: z.array(NormalizedCodecIdSchema).max(32),
      })
      .strict(),
    safetyPlan: MediaSafetyPlanSchema,
    durationSec: z.number().positive().optional(),
    reasonCode: z.string().min(1).max(80),
  })
  .strict();
export type MediaInspectionResult = z.infer<typeof MediaInspectionResultSchema>;

const mediaProcessingResultSharedShape = {
  mediaType: SimplifiedMediaTypeSchema,
  outputs: z.array(MediaOutputSchema).optional(),
  meta: MediaProcessingResultMetaSchema.optional(),
  warnings: z.array(z.string()).optional(),
  moderation: MediaModerationResultSchema.optional(),
  inspection: MediaInspectionResultSchema.optional(),
};

export const MediaProcessingResultSchema = z.discriminatedUnion('ok', [
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

export function parseMediaProcessingSpec(input: unknown) {
  return MediaProcessingSpecSchema.parse(input);
}

export function parseMediaProcessingResult(input: unknown) {
  return MediaProcessingResultSchema.parse(input);
}

export const ClientContextSchema = z
  .object({
    surface: z.string().min(1),
    targetIds: z
      .array(
        z
          .string()
          .min(1)
          .refine((id) => id === id.trim()),
      )
      .optional(),
  })
  .strict();
