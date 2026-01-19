import type {
    MediaProcessingResult,
    MediaProcessingSpec,
    MediaModerationResult,
  } from "@ttt-productions/media-contracts";
import { parseMediaProcessingSpec } from "@ttt-productions/media-contracts";
  import { createTempWorkspace } from "./workspace/temp";
  import { processMedia } from "./process-media";
  import type { MediaIO } from "./io/types";
  import type { ModerationAdapter } from "./moderation/types";
  import { mergeModeration } from "./moderation/merge";
  import path from "node:path";
  import { stat } from "node:fs/promises";
  
  export interface RunPipelineArgs {
    spec: MediaProcessingSpec;
    io: MediaIO;
    outputBaseName?: string;
    moderation?: ModerationAdapter;
  }
  
  function mediaTypeFromSpecKind(kind: MediaProcessingSpec["kind"]): "image" | "video" | "audio" | "other" {
    if (kind === "image") return "image";
    if (kind === "video") return "video";
    if (kind === "audio") return "audio";
    return "other";
  }
  
  function attachProvider(
    m: MediaModerationResult | null | undefined,
    provider?: string
  ): MediaModerationResult | null | undefined {
    if (!m) return m;
    return { ...m, provider: m.provider ?? provider, reviewedAt: m.reviewedAt ?? Date.now() };
  }
  
  export async function runMediaPipeline(args: RunPipelineArgs): Promise<MediaProcessingResult> {
    let { spec, io, outputBaseName = "media", moderation } = args;

    // Runtime contract validation (fast-fail with actionable errors).
    try {
      spec = parseMediaProcessingSpec(spec);
    } catch (e: any) {
      return {
        ok: false,
        mediaType: mediaTypeFromSpecKind(spec.kind),
        error: {
          code: "invalid_spec",
          message: "Invalid MediaProcessingSpec.",
          details: { issues: e?.issues ?? e?.message ?? String(e) },
        },
      };
    }
  
    const ws = await createTempWorkspace("ttt-media-");
  
    try {
      const inputPath = path.join(ws.dir, "input");
      const outputBasePath = path.join(ws.dir, outputBaseName);
  
      await io.input.readToFile(inputPath);
  
      // PRE moderation (original)
      let mIn: MediaModerationResult | null | undefined;
      if (moderation?.moderateInput) {
        mIn = attachProvider(
          await moderation.moderateInput({
            spec,
            kind: spec.kind,
            localPath: inputPath,
            mime: io.input.mime,
          }),
          moderation.provider
        );
  
        if (mIn?.status === "rejected") {
          return {
            ok: false,
            mediaType: mediaTypeFromSpecKind(spec.kind),
            moderation: mIn,
            error: {
              code: "rejected",
              message: "Rejected by moderation.",
              details: { provider: mIn.provider, reasons: mIn.reasons, findings: mIn.findings },
            },
          };
        }
      }
  
      const result = await processMedia(spec, {
        inputPath,
        outputBasePath,
        inputMime: io.input.mime,
      });

      // Output size enforcement (processed outputs)
      if (result.ok && result.outputs?.length) {
        const perFileLimit = spec.maxOutputBytes ?? spec.maxBytes ?? 200 * 1024 * 1024; // 200MB default
        const totalLimit = spec.maxTotalOutputBytes ?? spec.maxOutputBytes ?? spec.maxBytes ?? 400 * 1024 * 1024; // 400MB default

        let total = 0;
        for (const o of result.outputs) {
          if (!o.path) continue;
          const s = await stat(o.path);
          const size = Number(s.size ?? 0);
          total += size;
          if (!o.sizeBytes) o.sizeBytes = size;
          if (size > perFileLimit) {
            return {
              ok: false,
              mediaType: mediaTypeFromSpecKind(spec.kind),
              error: {
                code: "too_large",
                message: "Processed output exceeds allowed size.",
                details: { key: o.key, sizeBytes: size, limitBytes: perFileLimit },
              },
            };
          }
          if (total > totalLimit) {
            return {
              ok: false,
              mediaType: mediaTypeFromSpecKind(spec.kind),
              error: {
                code: "too_large",
                message: "Total processed outputs exceed allowed size.",
                details: { totalBytes: total, limitBytes: totalLimit },
              },
            };
          }
        }
      }
  
      if (!result.ok || !result.outputs?.length) {
        if (mIn) result.moderation = mIn;
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
  
      const merged = mergeModeration(mIn ?? undefined, mOut ?? undefined);
      if (merged) result.moderation = merged;
  
      return result;
    } finally {
      await ws.cleanup();
    }
  }
  