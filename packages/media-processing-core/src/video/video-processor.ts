import type {
    MediaProcessingSpec,
    MediaProcessingResult
  } from "@ttt-productions/media-contracts";
  
  export async function processVideo(
    _spec: MediaProcessingSpec,
    _ctx: {
      inputPath: string;
      outputBasePath: string;
    }
  ): Promise<MediaProcessingResult> {
    // placeholder for future ffmpeg-based pipeline
  
    return {
      ok: true,
      mediaType: "video",
      outputs: [],
      warnings: ["video processing not implemented"]
    };
  }
  