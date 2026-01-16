import type { MediaProcessingSpec, MediaProcessingResult } from "@ttt-productions/media-contracts";

export async function processVideo(
  spec: MediaProcessingSpec,
  ctx: { inputPath: string; outputBasePath: string }
): Promise<MediaProcessingResult> {
  return {
    ok: true,
    mediaType: "video",
    outputs: [],
    warnings: ["video processing not implemented"]
  };
}
