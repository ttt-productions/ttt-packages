import type { MediaProcessingResult, MediaProcessingSpec, MediaModerationResult } from "@ttt-productions/media-contracts";
import { createTempWorkspace } from "./workspace/temp";
import { processMedia } from "./process-media";
import type { MediaIO } from "./io/types";
import type { ModerationAdapter } from "./moderation/types";
import path from "node:path";

export interface RunPipelineArgs {
  spec: MediaProcessingSpec;
  io: MediaIO;

  /** base filename without extension */
  outputBaseName?: string;

  /** optional moderation hook */
  moderation?: ModerationAdapter;
}

function mediaTypeFromSpecKind(kind: MediaProcessingSpec["kind"]): "image" | "video" | "audio" | "other" {
  if (kind === "image") return "image";
  if (kind === "video") return "video";
  if (kind === "audio") return "audio";
  return "other";
}

function attachProvider(m: MediaModerationResult | null | undefined, provider?: string): MediaModerationResult | null | undefined {
  if (!m) return m;
  return { ...m, provider: m.provider ?? provider, reviewedAt: m.reviewedAt ?? Date.now() };
}

export async function runMediaPipeline(args: RunPipelineArgs): Promise<MediaProcessingResult> {
  const { spec, io, outputBaseName = "media", moderation } = args;

  const ws = await createTempWorkspace("ttt-media-");

  try {
    const inputPath = path.join(ws.dir, "input");
    const outputBasePath = path.join(ws.dir, outputBaseName);

    await io.input.readToFile(inputPath);

    // PRE moderation (original)
    if (moderation?.moderateInput) {
      const m0 = attachProvider(
        await moderation.moderateInput({
          spec,
          kind: spec.kind,
          localPath: inputPath,
          mime: io.input.mime,
        }),
        moderation.provider
      );

      if (m0?.status === "rejected") {
        return {
          ok: false,
          mediaType: mediaTypeFromSpecKind(spec.kind),
          moderation: m0,
          error: {
            code: "rejected",
            message: "Rejected by moderation.",
            details: { provider: m0.provider, reasons: m0.reasons, findings: m0.findings },
          },
        };
      }

      // if flagged/passed, carry it forward (merged later if output moderation exists)
      // we store it on result after processing
      // (no-op here)
    }

    const result = await processMedia(spec, {
      inputPath,
      outputBasePath,
      inputMime: io.input.mime,
    });

    // If processing failed, still return (but attach pre-moderation if we have it)
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

    // POST moderation (processed outputs)
    let mOut: MediaModerationResult | null | undefined;
    if (moderation?.moderateOutput) {
      mOut = attachProvider(
        await moderation.moderateOutput({
          spec,
          kind: spec.kind,
          outputs: (result.outputs ?? [])
            .filter((o) => !!o.path)
            .map((o) => ({ key: o.key, localPath: o.path!, mime: o.mime })),
        }),
        moderation.provider
      );

      if (mOut?.status === "rejected") {
        return {
          ok: false,
          mediaType: result.mediaType,
          moderation: mOut,
          error: {
            code: "rejected",
            message: "Rejected by moderation.",
            details: { provider: mOut.provider, reasons: mOut.reasons, findings: mOut.findings },
          },
        };
      }
    }

    // Attach moderation info if any
    if (mOut) {
      result.moderation = mOut;
    }

    return result;
  } finally {
    await ws.cleanup();
  }
}
