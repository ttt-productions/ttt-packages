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
  StartUploadRequestSchema,
  StartUploadResponseSchema,
  ProfilePictureTargetInfoSchema,
  SkillMediaTargetInfoSchema,
  StreetzTargetInfoSchema,
  JobPostingTargetInfoSchema,
  JobReplyTargetInfoSchema,
  OpportunityPromptTargetInfoSchema,
  OpportunityReplyTargetInfoSchema,
  LibraryCoverSquareTargetInfoSchema,
  LibraryCoverPosterTargetInfoSchema,
  LibraryCoverCinematicTargetInfoSchema,
  ChapterPhotoTargetInfoSchema,
  SongPhotoTargetInfoSchema,
  SongAudioTargetInfoSchema,
  ShowPhotoTargetInfoSchema,
  ShowVideoTargetInfoSchema,
  ChatAttachmentTargetInfoSchema,
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

// ---- Phase 1.6: per-origin targetInfo types ----

export type ProfilePictureTargetInfo = z.infer<typeof ProfilePictureTargetInfoSchema>;
export type SkillMediaTargetInfo = z.infer<typeof SkillMediaTargetInfoSchema>;
export type StreetzTargetInfo = z.infer<typeof StreetzTargetInfoSchema>;
export type JobPostingTargetInfo = z.infer<typeof JobPostingTargetInfoSchema>;
export type JobReplyTargetInfo = z.infer<typeof JobReplyTargetInfoSchema>;
export type OpportunityPromptTargetInfo = z.infer<typeof OpportunityPromptTargetInfoSchema>;
export type OpportunityReplyTargetInfo = z.infer<typeof OpportunityReplyTargetInfoSchema>;
export type LibraryCoverSquareTargetInfo = z.infer<typeof LibraryCoverSquareTargetInfoSchema>;
export type LibraryCoverPosterTargetInfo = z.infer<typeof LibraryCoverPosterTargetInfoSchema>;
export type LibraryCoverCinematicTargetInfo = z.infer<typeof LibraryCoverCinematicTargetInfoSchema>;
export type ChapterPhotoTargetInfo = z.infer<typeof ChapterPhotoTargetInfoSchema>;
export type SongPhotoTargetInfo = z.infer<typeof SongPhotoTargetInfoSchema>;
export type SongAudioTargetInfo = z.infer<typeof SongAudioTargetInfoSchema>;
export type ShowPhotoTargetInfo = z.infer<typeof ShowPhotoTargetInfoSchema>;
export type ShowVideoTargetInfo = z.infer<typeof ShowVideoTargetInfoSchema>;
export type ChatAttachmentTargetInfo = z.infer<typeof ChatAttachmentTargetInfoSchema>;

// Mapped type: given a FileOrigin literal, returns its targetInfo shape.
export type TargetInfoFor<O extends import('./file-origin.js').FileOrigin> =
  O extends 'profile-picture' ? ProfilePictureTargetInfo
  : O extends 'skill-media' ? SkillMediaTargetInfo
  : O extends 'streetz' ? StreetzTargetInfo
  : O extends 'job-posting' ? JobPostingTargetInfo
  : O extends 'job-reply' ? JobReplyTargetInfo
  : O extends 'opportunity-prompt' ? OpportunityPromptTargetInfo
  : O extends 'opportunity-reply' ? OpportunityReplyTargetInfo
  : O extends 'library-cover-square' ? LibraryCoverSquareTargetInfo
  : O extends 'library-cover-poster' ? LibraryCoverPosterTargetInfo
  : O extends 'library-cover-cinematic' ? LibraryCoverCinematicTargetInfo
  : O extends 'chapter-photo' ? ChapterPhotoTargetInfo
  : O extends 'song-photo' ? SongPhotoTargetInfo
  : O extends 'song-audio' ? SongAudioTargetInfo
  : O extends 'show-photo' ? ShowPhotoTargetInfo
  : O extends 'show-video' ? ShowVideoTargetInfo
  : O extends 'chat-attachment' ? ChatAttachmentTargetInfo
  : never;
