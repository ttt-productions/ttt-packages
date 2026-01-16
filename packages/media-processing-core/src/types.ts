import type {
    MediaProcessingSpec,
    MediaProcessingResult
  } from "@ttt-productions/media-contracts";
  
  export interface ProcessMediaContext {
    inputPath: string;
    outputBasePath: string;
  }
  
  export type ProcessMediaFn = (
    spec: MediaProcessingSpec,
    ctx: ProcessMediaContext
  ) => Promise<MediaProcessingResult>;
  