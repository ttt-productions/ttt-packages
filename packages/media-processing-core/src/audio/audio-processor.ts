import type {
    MediaProcessingSpec,
    MediaProcessingResult
  } from "@ttt-productions/media-contracts";
  
  export async function processAudio(
    _spec: MediaProcessingSpec,
    _ctx: {
      inputPath: string;
      outputBasePath: string;
    }
  ): Promise<MediaProcessingResult> {
    // placeholder for future audio pipeline
  
    return {
      ok: true,
      mediaType: "audio",
      outputs: [],
      warnings: ["audio processing not implemented"]
    };
  }
  