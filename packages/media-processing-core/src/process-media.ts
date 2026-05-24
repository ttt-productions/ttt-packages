import type { MediaProcessingResult, MediaProcessingSpec } from "@ttt-productions/media-schemas";
import { processImage } from "./image/image-processor.js";
import { processVideo } from "./video/video-processor.js";
import { processAudio } from "./audio/audio-processor.js";
import type { MediaProcessors, ProcessMediaContext, ProcessMediaOptions } from "./types.js";

export type { MediaPipelineProgress, MediaProcessors, ProcessMediaContext, ProcessMediaOptions } from "./types.js";

export const defaultMediaProcessors: MediaProcessors = {
  image: processImage,
  video: processVideo,
  audio: processAudio,
};

export async function processMedia(
  spec: MediaProcessingSpec,
  ctx: ProcessMediaContext,
  opts?: ProcessMediaOptions,
  processors: MediaProcessors = defaultMediaProcessors
): Promise<MediaProcessingResult> {
  switch (spec.kind) {
    case "image":
      return processors.image(spec, ctx, opts);

    case "video":
      return processors.video(spec, ctx, opts);

    case "audio":
      return processors.audio(spec, ctx, opts);

    case "generic":
    default:
      return {
        ok: false,
        mediaType: "other",
        error: { code: "processing_failed", message: "Generic processing not implemented yet." },
      };
  }
}
