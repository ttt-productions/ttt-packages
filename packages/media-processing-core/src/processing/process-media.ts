import type {
    MediaProcessingSpec,
    MediaProcessingResult
  } from "@ttt-productions/media-contracts";
  
  import { processImage } from "../image/image-processor.js";
  import { processVideo } from "../video/video-processor.js";
  import { processAudio } from "../audio/audio-processor.js";
  
  export async function processMedia(
    spec: MediaProcessingSpec,
    ctx: {
      inputPath: string;
      outputBasePath: string;
    }
  ): Promise<MediaProcessingResult> {
    switch (spec.kind) {
      case "image":
        return processImage(spec, ctx);
  
      case "video":
        return processVideo(spec, ctx);
  
      case "audio":
        return processAudio(spec, ctx);
  
      default:
        return {
          ok: false,
          mediaType: "other",
          error: {
            code: "unknown",
            message: "Unsupported media type"
          }
        };
    }
  }
  