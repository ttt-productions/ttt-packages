import type {
  FileCategory as ContractsFileCategory,
  MediaKind,
  MediaProcessingSpec,
  SimplifiedMediaType,
  VideoOrientation,
  MediaCropSpec,
} from "@ttt-productions/media-contracts";

/** FileCategory is owned by contracts. */
export type FileCategory = ContractsFileCategory;

export interface CropConfig {
  aspectRatio: number;
  aspectRatioDisplay?: string;
  shape: "rect" | "round";
  outputWidth: number;
  outputHeight: number;
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
  revokePreviewUrl?: () => void;
  error?: FileInputError;
}

export interface FileInputProps {
  acceptTypes: SimplifiedMediaType[];
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

  autoFormat?: boolean;
  croppedBlob?: Blob;

  error?: FileInputError;
}

export interface MediaInputProps {
  spec: MediaProcessingSpec;
  cropOverride?: MediaCropSpec;

  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  buttonLabel?: string;

  onChange: (payload: MediaInputChangePayload) => void;
}
