import type {
    MediaProcessingSpec,
    MediaProcessingResult
  } from "@ttt-productions/media-contracts";
  
  export async function processImage(
    spec: MediaProcessingSpec,
    ctx: {
      inputPath: string;
      outputBasePath: string;
    }
  ): Promise<MediaProcessingResult> {
    // TODO:
    // - move logic from functions/src/helpers/image-processor.ts
    // - apply sharp resize/crop/format per spec.image.variants
    // - write outputs to storage
    // - return MediaProcessingResult.outputs
  
    return {
      ok: true,
      mediaType: "image",
      outputs: [],
      warnings: ["image processing not implemented yet"]
    };
  }
  