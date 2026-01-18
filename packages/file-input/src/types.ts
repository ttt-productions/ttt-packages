import type {
  FileCategory as ContractsFileCategory,
  MediaKind,
  MediaProcessingSpec,
  SimplifiedMediaType,
  VideoOrientation,
  MediaCropSpec,
} from "@ttt-productions/media-contracts";

/**
 * Back-compat: file-input previously exported FileCategory incorrectly.
 * It now matches contracts FileCategory.
 */
export type FileCategory = ContractsFileCategory;

export interface CropConfig {
  aspectRatio: number;
  aspectRatioDisplay?: string;
  shape: "rect" | "round";
  outputWidth: number;
  outputHeight: number;
}

export interface BackendProcessingConfig {
  image?: {
    maxWidth: number;
    maxHeight: number;
    aspectRatio?: string;
    quality?: number;
  };
  video?: {
    maxWidth: number;
    maxHeight: number;
    aspectRatio?: string;
    codec?: string;
  };
  audio?: {
    bitrate?: string;
    codec?: string;
  };
}

export type FileInputErrorCode =
  | "invalid_type"
  | "too_large"
  | "too_long"
  | "orientation_mismatch"
  | "aspect_ratio_mismatch"
  | "dimensions_mismatch"
  | "read_failed"
  | "crop_failed"
  | "unknown";

export interface FileInputError {
  code: FileInputErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface FileInputChangePayload {
  type: SimplifiedMediaType;
  file?: File;
  blob?: Blob;
  previewUrl?: string;
  error?: FileInputError;
}

export interface FileInputProps {
  /**
   * Allowed simplified categories.
   * If empty -> accept anything.
   */
  acceptTypes: SimplifiedMediaType[];

  /** Max size per type (MB). If missing -> no limit for that type. */
  maxSizeMB: Partial<Record<SimplifiedMediaType, number>>;

  selectedFile?: File | null;

  onChange: (payload: FileInputChangePayload) => void;

  onError?: (error: FileInputError) => void;

  disabled?: boolean;
  isLoading?: boolean;
  buttonLabel?: string;
  className?: string;
  variant?: any;
  size?: any;
  uploadProgress?: number | null;

  videoMaxDurationSec?: number;
  audioMaxDurationSec?: number;

  cropConfig?: CropConfig;

  backendProcessing?: BackendProcessingConfig;

  defaultShowDetails?: boolean;
}

/** Used by MediaInput (spec-driven selection/capture/record). */
export interface SelectedMediaMeta {
  kind: MediaKind;
  mime?: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSec?: number;
  orientation?: VideoOrientation;
  aspectRatio?: number;
}

export interface MediaInputChangePayload {
  spec: MediaProcessingSpec;
  file?: File;
  previewUrl?: string;
  meta?: SelectedMediaMeta;

  /** If true, backend is expected to auto-format to match spec. */
  autoFormat?: boolean;

  /** Client-side crop applied (image only). */
  croppedBlob?: Blob;

  error?: FileInputError;
}

export interface MediaInputProps {
  spec: MediaProcessingSpec;

  /** Optional override for crop UI (if you don't want to use spec.imageCrop). */
  cropOverride?: MediaCropSpec;

  disabled?: boolean;
  isLoading?: boolean;
  className?: string;

  buttonLabel?: string;

  onChange: (payload: MediaInputChangePayload) => void;
}
