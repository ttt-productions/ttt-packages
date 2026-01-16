import type { MediaProcessingSpec, MediaProcessingResult } from "@ttt-productions/media-contracts";

export async function processImage(
  spec: MediaProcessingSpec,
  ctx: { inputPath: string; outputBasePath: string }
): Promise<MediaProcessingResult> {
  // TODO: extract sharp pipeline from functions/src/helpers/image-processor.ts
  return {
    ok: true,
    mediaType: "image",
    outputs: [],
    warnings: ["image processing stub"]
  };
}
