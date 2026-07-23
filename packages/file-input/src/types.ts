import type {
  FileCategory as ContractsFileCategory,
  MediaKind,
  MediaProcessingSpec,
  MediaOriginSpec,
  SimplifiedMediaType,
  VideoOrientation,
  MediaCropSpec,
  UploadState,
} from "@ttt-productions/media-schemas";

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
  spec: MediaOriginSpec;
  cropOverride?: MediaCropSpec;

  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  buttonLabel?: string;

  /**
   * Extra advisory notes shown in the "Info" affordance alongside the built-in default
   * ("keep your own copy — this isn't a backup/storage service"). Every MediaInput shows that
   * default note; pass surface-specific notes here to append to it. The Info button always renders.
   */
  helpNotes?: string[];

  /** Phase-aware upload state. When provided, drives the upload/processing UI. */
  uploadState?: UploadState | null;
  /**
   * Minimum file size (bytes) before showing a real progress bar.
   * Files smaller than this show an indeterminate spinner during upload instead.
   * Defaults to `DEFAULT_PROGRESS_BAR_MIN_BYTES` (512 KB) when omitted.
   * Pass `Infinity` to always use the spinner. Pass `0` to always use the bar.
   */
  progressBarMinBytes?: number;
  /** Currently selected file. Shows a semantic media label + clear button when set. */
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

  /**
   * Optional guard fired before opening the OS picker / capture UI for ANY
   * action (choose file, take photo, record video, record audio). Return false
   * — or a Promise resolving to false — to abort before the picker/capture
   * opens. Consumers use this to run a precondition (e.g. an email-verification
   * gate) on the click, not after a file has already been selected.
   */
  onBeforeSelect?: () => boolean | Promise<boolean>;

  onChange: (payload: MediaInputChangePayload) => void;
}

/**
 * Imperative handle exposed by {@link MediaInput} via `ref`. Additive — existing
 * ref-less usage is unaffected.
 */
export interface MediaInputHandle {
  /**
   * Programmatically open the canonical selection path, exactly as clicking the
   * trigger button does:
   * - exactly one enabled action → runs that action directly (choose file / photo
   *   / record), honoring `onBeforeSelect`, validation, and crop;
   * - multiple enabled actions → opens the existing choice dropdown.
   *
   * No-op while `disabled` or `isLoading`, or when no action is enabled. Must be
   * called synchronously from a user gesture so the browser file dialog can open.
   * It never bypasses the trigger gates (no hidden-input shortcut).
   */
  openSelection: () => void;
}
