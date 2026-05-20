import type {
  FileCategory as ContractsFileCategory,
  MediaKind,
  MediaProcessingSpec,
  TTTMediaOriginEntry,
  SimplifiedMediaType,
  VideoOrientation,
  MediaCropSpec,
  UploadState,
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
  spec: TTTMediaOriginEntry;
  cropOverride?: MediaCropSpec;

  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  buttonLabel?: string;

  /** Phase-aware upload state. When provided, drives the upload/processing UI. */
  uploadState?: UploadState | null;
  /**
   * Minimum file size (bytes) before showing a real progress bar.
   * Files smaller than this show an indeterminate spinner during upload instead.
   * Defaults to `DEFAULT_PROGRESS_BAR_MIN_BYTES` (512 KB) when omitted.
   * Pass `Infinity` to always use the spinner. Pass `0` to always use the bar.
   */
  progressBarMinBytes?: number;
  /** Currently selected file. Shows filename + clear button when set. */
  selectedFile?: File | null;
  /** Called when user clears the selected file. */
  onClear?: () => void;
  /**
   * Optional cancel callback. When provided AND the upload is in 'preparing' or
   * 'uploading' phase AND `isLoading` is true, an inline X button renders next to
   * the status text. Click invokes onCancel — the consumer is responsible for
   * aborting the underlying upload (e.g. via AbortController.abort()). Never
   * renders during 'finalizing'.
   */
  onCancel?: () => void;

  onChange: (payload: MediaInputChangePayload) => void;
}
