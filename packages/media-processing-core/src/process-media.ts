import type { MediaProcessingResult, MediaProcessingSpec } from "@ttt-productions/media-contracts";
import { processImage } from "./image/image-processor";

export interface ProcessMediaContext {
  inputPath: string;
  outputBasePath: string;
}

export async function processMedia(
  spec: MediaProcessingSpec,
  ctx: ProcessMediaContext
): Promise<MediaProcessingResult> {
  switch (spec.kind) {
    case "image":
      return processImage(spec, ctx);

    case "video":
    case "audio":
      return {
        ok: false,
        mediaType: spec.kind,
        error: {
          code: "processing_failed",
          message: `${spec.kind} processing not implemented yet.`,
        },
      };

    case "generic":
    default:
      return {
        ok: false,
        mediaType: "other",
        error: {
          code: "processing_failed",
          message: "Generic processing not implemented yet.",
        },
      };
  }
}
