import type { MediaProcessingResult, MediaProcessingSpec } from "@ttt-productions/media-contracts";
import { processImage } from "./image/image-processor";
import { processVideo } from "./video/video-processor";
import { processAudio } from "./audio/audio-processor";

export interface ProcessMediaContext {
  inputPath: string;
  outputBasePath: string;

  /** optional mime hint from caller */
  inputMime?: string;
}

export async function processMedia(
  spec: MediaProcessingSpec,
  ctx: ProcessMediaContext
): Promise<MediaProcessingResult> {
  switch (spec.kind) {
    case "image":
      return processImage(spec, ctx);

    case "video":
      return processVideo(spec, ctx);

    case "audio":
      return processAudio(spec, ctx);

    case "generic":
    default:
      return {
        ok: false,
        mediaType: "other",
        error: { code: "processing_failed", message: "Generic processing not implemented yet." },
      };
  }
}
