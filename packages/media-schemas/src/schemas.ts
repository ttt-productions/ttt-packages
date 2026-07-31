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
// (or publicationFailed). See the consuming app's media-serving and
// upload-pipeline design docs (serving authority + publication gating).
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
  "unsupported_codec",
  "kind_mismatch",
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

// The stable ids of the generic supported-format registry (catalog + accept
// projection live in ./format-registry.ts; the enum lives HERE so MediaAcceptSchema
// can reference it without a module cycle). An id's presence never enables a
// format by itself — an origin must select it AND the server inspector must
// prove and accept it.
export const MediaFormatIdSchema = z.enum([
  // images
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "tiff",
  "avif",
  "heic",
  "svg",
  // audio-only containers/codecs
  "mp3",
  "wav",
  "flac",
  // shared A/V containers (semantic kind comes from stream inspection, never the entry)
  "isobmff", // MP4 / M4A / M4V / MOV (QuickTime rides the same box structure)
  "webm", // WebM / Matroska (EBML)
  "ogg",
]);

export const MediaAcceptSchema = z
  .object({
    mimes: z.array(z.string()).optional(),
    kinds: z.array(MediaKindSchema).optional(),
    /** Explicit enabled-format selection (canonical-upload-content-classification):
     *  the picker projects these to `accept` tokens and the server accepts only an
     *  inspected formatId in this list. When absent, legacy kinds/mimes behavior
     *  applies unchanged. */
    formats: z.array(MediaFormatIdSchema).optional(),
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
    // EXPLICIT preserve-original marker. When true, the upload is stored
    // byte-exact and NEVER transcoded/resized (no `processing` branches) — the
    // safety scan still runs, only variant generation is skipped. Used for legal
    // evidence (e.g. ncii-evidence). Distinguishes an intentional no-transcode
    // origin from a forgotten `processing` block (the per-origin test requires
    // EITHER full processing OR this flag).
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

// =============================================================================
// Canonical content classification contracts (generic — no app policy)
// =============================================================================
//
// These are the cross-boundary shapes for the server-owned media inspection
// described in the consuming app's canonical-upload-content-classification
// design. Three distinct facts, three contracts:
//
//   1. ClientMediaClaim  — what the USER DID (untrusted client context). Emitted
//      by @ttt-productions/file-input from the concrete action (picker / camera
//      / recorder), carried through startUpload, never authoritative for bytes.
//   2. MediaInspectionResult — what the immutable BYTES actually contain, as
//      established by the canonical server inspector
//      (@ttt-productions/media-processing-core). The ONLY authority for
//      kind/spec/safety routing.
//   3. safetyPlan — which visual material must be safety-hashed before
//      publication, derived from the inspection (a field of the result).
//
// The schemas here are deliberately BOUNDED: enums, counts, and short strings
// only. Raw probe JSON, filenames, free-form codec strings, and payload bytes
// must never cross a boundary through these shapes.

// ---- client claim ----

/**
 * How the file entered the client. Strength contract (policy lives app-side):
 * `media-recorder` and `camera-capture` are STRONG claims — the application
 * itself requested the capture kind (e.g. `video:false` for an audio
 * recording). `file-picker` is ADVISORY — an inference from browser metadata.
 */
export const ClientMediaClaimSourceSchema = z.enum([
  "file-picker",
  "camera-capture",
  "media-recorder",
]);
export type ClientMediaClaimSource = z.infer<typeof ClientMediaClaimSourceSchema>;

export const ClientMediaClaimSchema = z
  .object({
    /** The semantic kind the action implies. `file` = no narrower inference. */
    kind: MediaKindSchema,
    source: ClientMediaClaimSourceSchema,
  })
  .strict();
export type ClientMediaClaim = z.infer<typeof ClientMediaClaimSchema>;

// ---- inspection result ----

export const MediaInspectionStatusSchema = z.enum([
  /** Complete stream/structure table obtained within bounds — the result is authoritative. */
  "definitive",
  /** Structure could not be completely proven (parse error, timeout, truncation,
   *  auxiliary-only, unlocatable track table). NEVER treated as audio; safety
   *  falls back to the strict visual path and publication is blocked. */
  "indeterminate",
  /** Structurally recognized, but the format/codec is not enabled or not
   *  processable by the runtime (e.g. SVG, HEIC without decoder proof). */
  "unsupported",
  /** Recognized family with invalid structure (bad boxes/VINTs/overflow). */
  "malformed",
]);
export type MediaInspectionStatus = z.infer<typeof MediaInspectionStatusSchema>;

export const MediaSafetyPlanSchema = z.enum([
  /** Single still image: hash the decoded image. */
  "still-image",
  /** Multi-frame image (GIF/animated WebP/AVIF): every extracted frame must be
   *  hashed — hashing frame zero alone must never return clean. */
  "animated-image-frames",
  /** Timed video: extract and hash frames. */
  "video-frames",
  /** Proven audio-only (no timed video, no visual attachments). */
  "audio-only",
  /** Audio plus attached artwork: hash every artwork image, then the audio guard. */
  "audio-plus-artwork",
  /** Ambiguous/indeterminate visual possibility: strict video-path treatment;
   *  publication remains blocked unless a definitive visual scan completes. */
  "strict-video-fallback",
]);
export type MediaSafetyPlan = z.infer<typeof MediaSafetyPlanSchema>;

/** Bounded, normalized codec identifiers. Anything unrecognized is "other" —
 *  raw probe codec strings never cross a boundary. */
export const NormalizedCodecIdSchema = z.enum([
  // video
  "h264",
  "hevc",
  "vp8",
  "vp9",
  "av1",
  "theora",
  "mpeg4",
  "mjpeg",
  // audio
  "aac",
  "alac",
  "opus",
  "vorbis",
  "mp3",
  "flac",
  "pcm",
  "amr",
  // catch-all (bounded)
  "other",
]);
export type NormalizedCodecId = z.infer<typeof NormalizedCodecIdSchema>;

const boundedCount = z.number().int().min(0).max(10_000);

export const MediaInspectionStreamsSchema = z
  .object({
    audio: boundedCount,
    /** Non-attached, timed video streams — ANY of these makes the content video. */
    timedVideo: boundedCount,
    /** Attached-picture/cover-art streams (untrusted flag — each must be proven
     *  a bounded still and separately hashed before audio can be clean). */
    attachedPictures: boundedCount,
    /** Decoded image frames for image-family content (1 = still, >1 = animated). */
    imageFrames: boundedCount,
    /** Subtitle/data/metadata/control/etc — never proof of audio by themselves. */
    auxiliary: boundedCount,
  })
  .strict();
export type MediaInspectionStreams = z.infer<typeof MediaInspectionStreamsSchema>;

export const MediaInspectionResultSchema = z
  .object({
    /** Version of the inspection LOGIC (bump on classification-rule changes). */
    inspectorVersion: z.string().min(1).max(64),
    /** First bounded version line of the probe tool, captured once per process. */
    ffprobeVersion: z.string().min(1).max(120).optional(),
    status: MediaInspectionStatusSchema,
    /** Present only when status === 'definitive'. */
    canonicalKind: MediaKindSchema.optional(),
    /** Registry formatId when the container/format was recognized (advisory for
     *  non-definitive results). */
    formatId: z.string().min(1).max(40).optional(),
    /** Bounded container family label (e.g. 'webm', 'isobmff', 'ogg', 'jpeg'). */
    container: z.string().min(1).max(40),
    streams: MediaInspectionStreamsSchema,
    codecs: z
      .object({
        audio: z.array(NormalizedCodecIdSchema).max(32),
        video: z.array(NormalizedCodecIdSchema).max(32),
      })
      .strict(),
    safetyPlan: MediaSafetyPlanSchema,
    /** Bounded machine reason (e.g. 'ok', 'probe_timeout', 'tracks_incomplete',
     *  'unsupported_codec:theora', 'unrecognized_signature'). */
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
  /** The canonical server content inspection for this input, when the caller
   *  enabled it (canonical-upload-content-classification). */
  inspection: MediaInspectionResultSchema.optional(),
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
