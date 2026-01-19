import type { MediaProcessingResult, MediaProcessingSpec } from "@ttt-productions/media-contracts";

export interface MediaPipelineProgress {
  phase:
    | "read_input"
    | "moderation_input"
    | "process"
    | "persist_outputs"
    | "moderation_output"
    | "done";
  /** 0..1 when known */
  percent?: number;
  detail?: Record<string, unknown>;
}

export interface ProcessMediaContext {
  inputPath: string;
  outputBasePath: string;
  /** optional mime hint from caller */
  inputMime?: string;
}

export interface ProcessMediaOptions {
  signal?: AbortSignal;
  onProgress?: (p: MediaPipelineProgress) => void;
}

export type ProcessMediaFn = (
  spec: MediaProcessingSpec,
  ctx: ProcessMediaContext,
  opts?: ProcessMediaOptions
) => Promise<MediaProcessingResult>;
