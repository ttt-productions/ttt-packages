export type SimplifiedMediaType = "image" | "video" | "audio" | "other";

export type FileCategory =
  | "profile"
  | "post"
  | "message"
  | "comment"
  | "report"
  | "admin"
  | "other";

export type MediaProcessingStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "rejected";

export type MediaErrorCode =
  | "invalid_mime"
  | "too_large"
  | "too_long"
  | "processing_failed"
  | "not_found"
  | "permission_denied"
  | "unknown";

export type TimestampLike = number | string; // contracts-only (no Firebase Timestamp)

export interface MediaOwnerRef {
  uid: string;
}

export interface MediaThreadRef {
  threadId: string;
}

export interface PendingMediaDoc {
  /** Stable id (doc id) */
  id: string;

  owner: MediaOwnerRef;

  /** Optional thread/message context */
  thread?: MediaThreadRef;

  /** Where/why this upload exists (feature-level meaning stays in app) */
  category?: FileCategory;

  /** Client-provided metadata */
  originalName?: string;
  mime?: string;
  sizeBytes?: number;

  /** Simplified bucket used by viewers/validation */
  mediaType: SimplifiedMediaType;

  /** Storage pointers (paths are app-defined) */
  originalPath?: string;
  originalUrl?: string;

  /** Backend processing state */
  status: MediaProcessingStatus;

  /** Processing spec used (if any) */
  spec?: MediaProcessingSpec;

  /** Processing result (if any) */
  result?: MediaProcessingResult;

  /** Error (if failed/rejected) */
  error?: MediaProcessingError;

  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface MediaProcessingError {
  code: MediaErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ImageVariantSpec {
  /** e.g. "thumb", "sm", "md", "lg", "original" */
  key: string;

  /** Max bounds; backend decides exact output */
  maxWidth?: number;
  maxHeight?: number;

  /** Optional exact crop output */
  crop?: {
    width: number;
    height: number;
    /** center by default */
    gravity?: "center" | "top" | "bottom" | "left" | "right";
  };

  /** Optional format preference */
  format?: "jpeg" | "png" | "webp" | "avif";
  quality?: number; // 1-100
}

export interface MediaProcessingSpec {
  /** What the backend should do. Keep stable + additive. */
  kind: "image" | "video" | "audio" | "generic";

  /** Image pipeline (sharp etc) */
  image?: {
    variants: ImageVariantSpec[];
    /** If true, allow stripping EXIF/metadata */
    stripMetadata?: boolean;
  };

  /** Video/audio pipeline (may be stubbed initially) */
  video?: {
    /** Optional maximum duration allowed (seconds) */
    maxDurationSec?: number;
  };

  audio?: {
    maxDurationSec?: number;
  };
}

export interface MediaOutput {
  key: string;
  url: string;
  path?: string;

  mime?: string;
  sizeBytes?: number;

  width?: number;
  height?: number;

  durationSec?: number;

  /** Backend may provide more */
  extra?: Record<string, unknown>;
}

export interface MediaProcessingResult {
  ok: boolean;

  /** Mirrors simplified type; useful for viewers */
  mediaType: SimplifiedMediaType;

  /** Canonical outputs (variants, transcoded files, etc.) */
  outputs?: MediaOutput[];

  /** Useful metadata surfaced by backend */
  meta?: {
    mime?: string;
    sizeBytes?: number;
    width?: number;
    height?: number;
    durationSec?: number;
  };

  /** Non-fatal notes */
  warnings?: string[];

  /** If !ok */
  error?: MediaProcessingError;
}

export interface ReportPayload {
  /** Who is reporting */
  reporter: MediaOwnerRef;

  /** What they are reporting */
  target: {
    mediaId: string;
    owner?: MediaOwnerRef;
    category?: FileCategory;
  };

  reason: string;
  details?: string;

  createdAt?: TimestampLike;

  /** Additive room for future */
  extra?: Record<string, unknown>;
}
