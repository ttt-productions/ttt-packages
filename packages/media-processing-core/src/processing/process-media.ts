import type {
    MediaProcessingSpec,
    MediaProcessingResult
  } from "@ttt-productions/media-contracts";
  
  import { processImage } from "../image/image-processor";
  import { processVideo } from "../video/video-processor";
  import { processAudio } from "../audio/audio-processor";
  
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
  