import type { MediaProcessingResult, MediaProcessingSpec } from '@ttt-productions/media-schemas';

export interface MediaPipelineProgress {
  phase:
    | 'read_input'
    | 'moderation_input'
    | 'process'
    | 'persist_outputs'
    | 'moderation_output'
    | 'done';
  percent?: number;
  detail?: Record<string, unknown>;
}

export interface ProcessMediaContext {
  inputPath: string;
  outputBasePath: string;
  inputMime?: string;
}

export interface ProcessMediaOptions {
  signal?: AbortSignal;
  onProgress?: (p: MediaPipelineProgress) => void;
}

export type ProcessMediaFn = (
  spec: MediaProcessingSpec,
  ctx: ProcessMediaContext,
  opts?: ProcessMediaOptions,
) => Promise<MediaProcessingResult>;

export interface MediaProcessors {
  image: ProcessMediaFn;
  video: ProcessMediaFn;
  audio: ProcessMediaFn;
}
