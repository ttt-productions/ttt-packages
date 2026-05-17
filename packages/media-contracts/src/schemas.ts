import { z } from "zod";
import { FileOriginSchema, type FileOrigin } from "./file-origin.js";
import { MentionSchema } from "./short-types.js";
import { DomainEventSchema } from "./domain-events.js";

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

// ---- registry entry (upload contract + optional processing pipeline) ----

export const TTTMediaProcessingByKindSchema = z
  .object({
    image: MediaProcessingSpecSchema.optional(),
    video: MediaProcessingSpecSchema.optional(),
    audio: MediaProcessingSpecSchema.optional(),
  })
  .strict();

export const TTTMediaOriginEntrySchema = MediaProcessingSpecSchema
  .omit({
    image: true,
    video: true,
    audio: true,
    requiredWidth: true,
    requiredHeight: true,
    allowAutoFormat: true,
  })
  .extend({
    processing: TTTMediaProcessingByKindSchema.optional(),
  });

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

// ---- parsers ----

export function parseMediaProcessingSpec(input: unknown) {
  return MediaProcessingSpecSchema.parse(input);
}

export function parseMediaProcessingResult(input: unknown) {
  return MediaProcessingResultSchema.parse(input);
}

// ============================================================================
// Unified upload pipeline (Phase 1.5)
// ----------------------------------------------------------------------------
// PendingMediaSchema is the canonical Zod-strict shape for `pendingMedia/{id}`
// Firestore docs. Discriminated union on `status` — five branches. Used at
// every read trust boundary (Cloud Function handlers, frontend hook).
// ============================================================================

export const ClientContextSchema = z
  .object({
    surface: z.string().min(1),
    targetIds: z.array(z.string().min(1)).optional(),
  })
  .strict();

const PendingMediaBaseShape = {
  id: z.string().min(1),
  userId: z.string().min(1),
  fileOrigin: FileOriginSchema,
  originalFileName: z.string().min(1),
  pendingStoragePath: z.string().min(1),
  targetInfo: z.unknown().optional(),
  textContent: z.string().optional(),
  clientContext: ClientContextSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  processingStartedAt: z.number().optional(),
  terminalAt: z.number().optional(),
} as const;

export const PendingMediaResultSchema = z
  .object({
    events: z.array(DomainEventSchema),
    affected: z
      .array(
        z
          .object({
            collection: z.string().min(1),
            docId: z.string().min(1),
            operation: z.enum(['create', 'update']),
          })
          .strict()
      )
      .optional(),
  })
  .strict();

export const PendingMediaErrorCategorySchema = z.enum([
  'system',
  'rate_limit',
  'validation',
  'kind_mismatch',
  'storage',
  'moderation',
]);

export const PendingMediaPendingSchema = z
  .object({
    ...PendingMediaBaseShape,
    status: z.literal('pending'),
  })
  .strict();

export const PendingMediaProcessingSchema = z
  .object({
    ...PendingMediaBaseShape,
    status: z.literal('processing'),
  })
  .strict();

export const PendingMediaCompletedSchema = z
  .object({
    ...PendingMediaBaseShape,
    status: z.literal('completed'),
    completedAt: z.number(),
    terminalAt: z.number(),
    uploadTrayClearedAt: z.number().optional(),
    uploadTrayClearedBy: z.string().min(1).optional(),
    result: PendingMediaResultSchema,
  })
  .strict();

export const PendingMediaFailedSchema = z
  .object({
    ...PendingMediaBaseShape,
    status: z.literal('failed'),
    failedAt: z.number(),
    terminalAt: z.number(),
    uploadTrayClearedAt: z.number().optional(),
    uploadTrayClearedBy: z.string().min(1).optional(),
    errorCategory: PendingMediaErrorCategorySchema,
    errorMessage: z.string().min(1),
  })
  .strict();

export const PendingMediaRejectedSchema = z
  .object({
    ...PendingMediaBaseShape,
    status: z.literal('rejected'),
    rejectedAt: z.number(),
    terminalAt: z.number(),
    uploadTrayClearedAt: z.number().optional(),
    uploadTrayClearedBy: z.string().min(1).optional(),
    rejectionType: z.enum(['text', 'media']),
    errorMessage: z.string().min(1),
    violationId: z.string().min(1).optional(),
    result: PendingMediaResultSchema.optional(),
  })
  .strict();

export const PendingMediaSchema = z.discriminatedUnion('status', [
  PendingMediaPendingSchema,
  PendingMediaProcessingSchema,
  PendingMediaCompletedSchema,
  PendingMediaFailedSchema,
  PendingMediaRejectedSchema,
]);

// ============================================================================
// Pending media archive
// ----------------------------------------------------------------------------
// ArchivedPendingMediaSchema is the canonical Zod-strict shape for
// `pendingMediaArchive/{id}` Firestore docs. Terminal-only discriminated union
// — three branches mirroring the three terminal `pendingMedia` branches plus a
// required `archivedAt` timestamp. Strict parse fails loud if a non-terminal
// doc reaches the archive.
// ============================================================================

export const ArchivedPendingMediaCompletedSchema = z
  .object({
    ...PendingMediaBaseShape,
    status: z.literal('completed'),
    completedAt: z.number(),
    terminalAt: z.number(),
    uploadTrayClearedAt: z.number().optional(),
    uploadTrayClearedBy: z.string().min(1).optional(),
    result: PendingMediaResultSchema,
    archivedAt: z.number(),
  })
  .strict();

export const ArchivedPendingMediaFailedSchema = z
  .object({
    ...PendingMediaBaseShape,
    status: z.literal('failed'),
    failedAt: z.number(),
    terminalAt: z.number(),
    uploadTrayClearedAt: z.number().optional(),
    uploadTrayClearedBy: z.string().min(1).optional(),
    errorCategory: PendingMediaErrorCategorySchema,
    errorMessage: z.string().min(1),
    archivedAt: z.number(),
  })
  .strict();

export const ArchivedPendingMediaRejectedSchema = z
  .object({
    ...PendingMediaBaseShape,
    status: z.literal('rejected'),
    rejectedAt: z.number(),
    terminalAt: z.number(),
    uploadTrayClearedAt: z.number().optional(),
    uploadTrayClearedBy: z.string().min(1).optional(),
    rejectionType: z.enum(['text', 'media']),
    errorMessage: z.string().min(1),
    violationId: z.string().min(1).optional(),
    result: PendingMediaResultSchema.optional(),
    archivedAt: z.number(),
  })
  .strict();

export const ArchivedPendingMediaSchema = z.discriminatedUnion('status', [
  ArchivedPendingMediaCompletedSchema,
  ArchivedPendingMediaFailedSchema,
  ArchivedPendingMediaRejectedSchema,
]);

export type ArchivedPendingMedia = z.infer<typeof ArchivedPendingMediaSchema>;

export function parseArchivedPendingMedia(input: unknown) {
  return ArchivedPendingMediaSchema.parse(input);
}

// ============================================================================
// startUpload callable contracts
// ============================================================================

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

export function parsePendingMedia(input: unknown) {
  return PendingMediaSchema.parse(input);
}

// ============================================================================
// Phase 1.6: per-origin `targetInfo` schemas
// ----------------------------------------------------------------------------
// Each FileOrigin has a strict schema describing its targetInfo shape.
// Read at the trust boundary in processors via `parseTargetInfo`.
// ============================================================================

// profile-picture: no origin-specific fields.
export const ProfilePictureTargetInfoSchema = z.object({}).strict();

// skill-media: skillId + skillType + originalFileName (originalFileName
// duplicates the base pendingMedia field; kept for backward compat with
// the current writer in createSkill.ts. Phase 1.8 may remove the duplicate.)
export const SkillMediaTargetInfoSchema = z
  .object({
    skillId: z.string().min(1),
    skillType: z.enum(['image', 'video', 'audio', 'other']),
    originalFileName: z.string().min(1),
  })
  .strict();

// streetz: mentions array of structured Mention objects. Writer always sends mentions ?? [].
export const StreetzTargetInfoSchema = z
  .object({
    mentions: z.array(MentionSchema),
  })
  .strict();

// job-posting: full job creation payload. The processor looks up the project
// doc at finalize time to build the canonical ShortProject — frontend only
// sends projectId.
export const JobPostingTargetInfoSchema = z
  .object({
    jobId: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    requiredProfessions: z.array(z.string()),
    sharesOffered: z.number(),
    projectId: z.string().min(1),
    createdBy: z.object({ uid: z.string().min(1) }).strict(),
  })
  .strict();

// job-reply: jobId + replyText. The processor looks up projectId from the
// job doc at finalize time — frontend stays dumb. Mirrors job-posting.
export const JobReplyTargetInfoSchema = z
  .object({
    jobId: z.string().min(1),
    replyText: z.string(),
  })
  .strict();

// opportunity-prompt: full opportunity creation payload. Optional fields
// are conditional on `type` — schema marks them optional rather than
// introducing a nested discriminator. A future cleanup could tighten this.
export const OpportunityPromptTargetInfoSchema = z
  .object({
    opportunityId: z.string().min(1),
    type: z.enum(['ProjectInput', 'SponsoredProjects', 'SystemInput']),
    title: z.string().min(1),
    description: z.string(),
    openTill: z.number(),
    createdBy: z.object({ uid: z.string().min(1) }).strict(),
    projectId: z.string().min(1).optional(),
    sharesOffered: z.number().optional(),
    projectAmountUSD: z.number().optional(),
  })
  .strict();

// opportunity-reply: opportunityId only.
export const OpportunityReplyTargetInfoSchema = z
  .object({
    opportunityId: z.string().min(1),
  })
  .strict();

// library-cover-* (square / poster / cinematic): same shape for all three.
// docPath + fields. Was flat targetDocPath / targetFields before Phase 1.6.
const LibraryCoverTargetInfoShape = z
  .object({
    docPath: z.string().min(1),
    fields: z.record(z.string()),
  })
  .strict();

export const LibraryCoverSquareTargetInfoSchema = LibraryCoverTargetInfoShape;
export const LibraryCoverPosterTargetInfoSchema = LibraryCoverTargetInfoShape;
export const LibraryCoverCinematicTargetInfoSchema = LibraryCoverTargetInfoShape;

// chapter-photo, song-photo, song-audio, show-photo, show-video:
// same shape — docPath + fields with a single `full` key.
const SubItemTargetInfoShape = z
  .object({
    docPath: z.string().min(1),
    fields: z.object({ full: z.string().min(1) }).strict(),
  })
  .strict();

export const ChapterPhotoTargetInfoSchema = SubItemTargetInfoShape;
export const SongPhotoTargetInfoSchema = SubItemTargetInfoShape;
export const SongAudioTargetInfoSchema = SubItemTargetInfoShape;
export const ShowPhotoTargetInfoSchema = SubItemTargetInfoShape;
export const ShowVideoTargetInfoSchema = SubItemTargetInfoShape;

// chat-attachment: discriminated by threadKind. Carries the routing
// information the processor needs to build the message-doc path AFTER
// moderation passes. Caption text lives in pendingMedia.textContent at
// the top level (canonical home for upload caption text — same as streetz).
// The processor reads textContent + targetInfo to call runSendChatMessage.
const ChatReplyToSchema = z
  .object({
    messageId: z.string().min(1),
    senderId: z.string().min(1),
    messagePreview: z.string(),
  })
  .strict();

export const ChatAttachmentTargetInfoSchema = z.discriminatedUnion('threadKind', [
  z
    .object({
      threadKind: z.literal('projectChannel'),
      projectId: z.string().min(1),
      channelId: z.string().min(1),
      replyTo: ChatReplyToSchema.optional(),
    })
    .strict(),
  z
    .object({
      threadKind: z.literal('projectInvite'),
      inviteId: z.string().min(1),
      replyTo: ChatReplyToSchema.optional(),
    })
    .strict(),
  z
    .object({
      threadKind: z.literal('adminSupport'),
      adminMessageId: z.string().min(1),
      isUserReply: z.boolean(),
      replyTo: ChatReplyToSchema.optional(),
    })
    .strict(),
]);

// project-file: projectId only. The processor looks up the project doc
// at finalize time and builds the canonical ProjectFile entry from
// PendingMedia metadata (originalFileName, size, type, userId, completedAt)
// before pushing it into the project doc's `files` array via arrayUnion.
export const ProjectFileTargetInfoSchema = z
  .object({
    projectId: z.string().min(1),
  })
  .strict();

// ============================================================================
// parseTargetInfo: the only public path for narrowing targetInfo by origin.
// ============================================================================

function assertNever(x: never): never {
  throw new Error(`Unexpected fileOrigin: ${String(x)}`);
}

export function parseTargetInfo<O extends FileOrigin>(
  fileOrigin: O,
  raw: unknown
): import('./types.js').TargetInfoFor<O> {
  switch (fileOrigin) {
    case 'profile-picture': return ProfilePictureTargetInfoSchema.parse(raw) as import('./types.js').TargetInfoFor<O>;
    case 'skill-media': return SkillMediaTargetInfoSchema.parse(raw) as import('./types.js').TargetInfoFor<O>;
    case 'streetz': return StreetzTargetInfoSchema.parse(raw) as import('./types.js').TargetInfoFor<O>;
    case 'job-posting': return JobPostingTargetInfoSchema.parse(raw) as import('./types.js').TargetInfoFor<O>;
    case 'job-reply': return JobReplyTargetInfoSchema.parse(raw) as import('./types.js').TargetInfoFor<O>;
    case 'opportunity-prompt': return OpportunityPromptTargetInfoSchema.parse(raw) as import('./types.js').TargetInfoFor<O>;
    case 'opportunity-reply': return OpportunityReplyTargetInfoSchema.parse(raw) as import('./types.js').TargetInfoFor<O>;
    case 'library-cover-square': return LibraryCoverSquareTargetInfoSchema.parse(raw) as import('./types.js').TargetInfoFor<O>;
    case 'library-cover-poster': return LibraryCoverPosterTargetInfoSchema.parse(raw) as import('./types.js').TargetInfoFor<O>;
    case 'library-cover-cinematic': return LibraryCoverCinematicTargetInfoSchema.parse(raw) as import('./types.js').TargetInfoFor<O>;
    case 'chapter-photo': return ChapterPhotoTargetInfoSchema.parse(raw) as import('./types.js').TargetInfoFor<O>;
    case 'song-photo': return SongPhotoTargetInfoSchema.parse(raw) as import('./types.js').TargetInfoFor<O>;
    case 'song-audio': return SongAudioTargetInfoSchema.parse(raw) as import('./types.js').TargetInfoFor<O>;
    case 'show-photo': return ShowPhotoTargetInfoSchema.parse(raw) as import('./types.js').TargetInfoFor<O>;
    case 'show-video': return ShowVideoTargetInfoSchema.parse(raw) as import('./types.js').TargetInfoFor<O>;
    case 'chat-attachment': return ChatAttachmentTargetInfoSchema.parse(raw) as import('./types.js').TargetInfoFor<O>;
    case 'project-file': return ProjectFileTargetInfoSchema.parse(raw) as import('./types.js').TargetInfoFor<O>;
    default: return assertNever(fileOrigin);
  }
}
