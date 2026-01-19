import type { MediaProcessingResult, MediaProcessingSpec } from "@ttt-productions/media-contracts";
import { processImage } from "./image/image-processor";
import { processVideo } from "./video/video-processor";
import { processAudio } from "./audio/audio-processor";
import type { ProcessMediaContext, ProcessMediaOptions } from "./types";

export type { MediaPipelineProgress, ProcessMediaContext, ProcessMediaOptions } from "./types";

export async function processMedia(
  spec: MediaProcessingSpec,
  ctx: ProcessMediaContext,
  opts?: ProcessMediaOptions
): Promise<MediaProcessingResult> {
  switch (spec.kind) {
    case "image":
      return processImage(spec, ctx, opts);

    case "video":
      return processVideo(spec, ctx, opts);

    case "audio":
      return processAudio(spec, ctx, opts);

    case "generic":
    default:
      return {
        ok: false,
        mediaType: "other",
        error: { code: "processing_failed", message: "Generic processing not implemented yet." },
      };
  }
}
