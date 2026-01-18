export type SimplifiedMediaType = "image" | "video" | "audio" | "other";

/**
 * Stable, user-facing context category.
 * Feature meaning stays in the app; contracts just carry it.
 */
export type FileCategory =
  | "profile"
  | "post"
  | "message"
  | "comment"
  | "report"
  | "admin"
  | "other";

/**
 * Kinds used by specs and capture UI.
 * "file" means allow any file.
 */
export type MediaKind = "image" | "video" | "audio" | "file";

export type MediaProcessingStatus = "pending" | "processing" | "ready" | "failed" | "rejected";

export type MediaJobStatus = "selecting" | "uploading" | "queued" | "processing" | "ready" | "rejected" | "failed";

export interface MediaJobStatusPayload {
  status: MediaJobStatus;
  progress?: number; // 0..1 (uploading only)
  reasonCode?: string;
  updatedAt?: TimestampLike;
  mediaDocId?: string;
  extra?: Record<string, unknown>;
}

export type MediaErrorCode =
  | "invalid_mime"
  | "too_large"
  | "too_long"
  | "processing_failed"
  | "not_found"
  | "permission_denied"
  | "orientation_mismatch"
  | "aspect_ratio_mismatch"
  | "dimensions_mismatch"
  | "rejected"
  | "unknown";

export type TimestampLike = number | string; // contracts-only (no Firebase Timestamp)

export interface MediaOwnerRef {
  uid: string;
}

export interface MediaThreadRef {
  threadId: string;
}

export type MediaModerationStatus = "passed" | "flagged" | "rejected" | "error";

export interface MediaModerationFinding {
  category?: string;
  label?: string;
  score?: number;
  severity?: string;
  reasons?: string[];
  meta?: Record<string, unknown>;
}

export interface MediaModerationResult {
  status: MediaModerationStatus;
  provider?: string;
  reasons?: string[];
  findings?: MediaModerationFinding[];
  reviewedAt?: TimestampLike;
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

export interface MediaAccept {
  /** If omitted/empty, accept anything. */
  mimes?: string[];

  /** If omitted/empty, accept anything. */
  kinds?: MediaKind[];
}

export interface MediaCropSpec {
  /** e.g. 9/16, 4/5, 1 */
  aspectRatio: number;

  /** final output */
  outputWidth: number;
  outputHeight: number;

  format?: "jpeg" | "png" | "webp" | "avif";
  quality?: number; // 1-100

  /** UI hint only */
  aspectRatioDisplay?: string;
}

export type VideoOrientation = "vertical" | "horizontal" | "any";

export interface MediaClientConstraints {
  /** Capture/record hints; UI-only. */
  allowPick?: boolean;
  allowCapturePhoto?: boolean;
  allowRecordVideo?: boolean;
  allowRecordAudio?: boolean;

  /** Prefered camera on mobile. */
  cameraFacingMode?: "user" | "environment";

  /** Record hints. */
  maxRecordDurationSec?: number;
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
  /** Spec version for forwards/backwards compatibility. */
  specVersion?: 1;

  /** What the backend should do. Keep stable + additive. */
  kind: "image" | "video" | "audio" | "generic";

  /** If omitted/empty -> accept anything. */
  accept?: MediaAccept;

  /** If omitted -> no limit. */
  maxBytes?: number;

  /** If omitted -> no limit. Applies to video/audio. */
  maxDurationSec?: number;

  /** Enforce output aspect ratio (uniform UI). */
  requiredAspectRatio?: number;

  /** Enforce output dimensions (uniform UI). */
  requiredWidth?: number;
  requiredHeight?: number;

  /** Enforce source orientation (video). */
  videoOrientation?: VideoOrientation;

  /** If source doesn't match constraints, allow backend to auto-format. */
  allowAutoFormat?: boolean;

  /** Optional image crop/resize on client + backend. */
  imageCrop?: MediaCropSpec;

  /** UI hints for capture/record */
  client?: MediaClientConstraints;

  /** Image pipeline (sharp etc) */
  image?: {
    variants: ImageVariantSpec[];
    stripMetadata?: boolean;
  };

  video?: {
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

  extra?: Record<string, unknown>;
}

export interface MediaProcessingResult {
  ok: boolean;

  mediaType: SimplifiedMediaType;

  outputs?: MediaOutput[];

  meta?: {
    mime?: string;
    sizeBytes?: number;
    width?: number;
    height?: number;
    durationSec?: number;
  };

  warnings?: string[];

  error?: MediaProcessingError;

  moderation?: MediaModerationResult;
}

export interface ReportPayload {
  reporter: MediaOwnerRef;

  target: {
    mediaId: string;
    owner?: MediaOwnerRef;
    category?: FileCategory;
  };

  reason: string;
  details?: string;

  createdAt?: TimestampLike;

  extra?: Record<string, unknown>;
}
