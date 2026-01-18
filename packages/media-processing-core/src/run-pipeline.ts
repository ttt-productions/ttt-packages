import type { MediaProcessingResult, MediaProcessingSpec } from "@ttt-productions/media-contracts";
import { createTempWorkspace } from "./workspace/temp";
import { processMedia } from "./process-media";
import type { MediaIO } from "./io/types";
import path from "node:path";

export interface RunPipelineArgs {
  spec: MediaProcessingSpec;
  io: MediaIO;

  /** base filename without extension */
  outputBaseName?: string;
}

export async function runMediaPipeline(args: RunPipelineArgs): Promise<MediaProcessingResult> {
  const { spec, io, outputBaseName = "media" } = args;

  const ws = await createTempWorkspace("ttt-media-");

  try {
    const inputPath = path.join(ws.dir, "input");
    const outputBasePath = path.join(ws.dir, outputBaseName);

    await io.input.readToFile(inputPath);

    const result = await processMedia(spec, {
      inputPath,
      outputBasePath,
      inputMime: io.input.mime,
    });

    if (!result.ok || !result.outputs?.length) {
      return result;
    }

    // Persist outputs
    for (const out of result.outputs) {
      if (!out.path) continue;
      const persisted = await io.output.writeFromFile(out.path, out.key);
      if (persisted.url) out.url = persisted.url;
      if (persisted.path) out.path = persisted.path;
    }

    return result;
  } finally {
    await ws.cleanup();
  }
}
