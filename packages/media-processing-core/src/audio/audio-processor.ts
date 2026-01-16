import type { MediaProcessingSpec, MediaProcessingResult } from "@ttt-productions/media-contracts";

export async function processAudio(
  spec: MediaProcessingSpec,
  ctx: { inputPath: string; outputBasePath: string }
): Promise<MediaProcessingResult> {
  return {
    ok: true,
    mediaType: "audio",
    outputs: [],
    warnings: ["audio processing not implemented"]
  };
}
