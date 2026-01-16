import type { SimplifiedMediaType } from "@ttt-productions/media-contracts";

export type FileCategory = SimplifiedMediaType;

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
  /** Allowed simplified categories */
  acceptTypes: SimplifiedMediaType[];

  /** Max size per type (MB) */
  maxSizeMB: Partial<Record<SimplifiedMediaType, number>>;

  /** Controlled selected file (optional) */
  selectedFile?: File | null;

  /** Called on any change (select/clear/crop/fail). */
  onChange: (payload: FileInputChangePayload) => void;

  /** Optional error callback (no toasts inside package). */
  onError?: (error: FileInputError) => void;

  /** UI/behavior */
  disabled?: boolean;
  isLoading?: boolean;
  buttonLabel?: string;
  className?: string;
  variant?: any; // ButtonProps['variant'] (kept loose to avoid re-export coupling)
  size?: any; // ButtonProps['size']
  uploadProgress?: number | null;

  /** Optional constraints */
  videoMaxDurationSec?: number;
  audioMaxDurationSec?: number;

  /** Optional image crop */
  cropConfig?: CropConfig;

  /** Optional: show “backend will do …” details, like app */
  backendProcessing?: BackendProcessingConfig;

  /** Optional: show details toggle even if only sizes */
  defaultShowDetails?: boolean;
}
