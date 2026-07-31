import type {
    MediaProcessingResult,
    MediaProcessingSpec,
    MediaModerationResult,
    MediaInspectionResult,
    MediaProcessingError,
  } from "@ttt-productions/media-schemas";
import { parseMediaProcessingSpec } from "@ttt-productions/media-schemas";
  import { createTempWorkspace } from "./workspace/temp.js";
  import { processMedia } from "./process-media.js";
  import { inspectMedia, type InspectMediaDeps } from "./inspection/inspect-media.js";
  import type { MediaIO } from "./io/types.js";
  import type { ModerationAdapter } from "./moderation/types.js";
  import { mergeModeration } from "./moderation/merge.js";
  import path from "node:path";
  import { stat } from "node:fs/promises";

  export interface RunPipelineArgs {
    spec: MediaProcessingSpec;
    io: MediaIO;
    outputBaseName?: string;
    moderation?: ModerationAdapter;
  signal?: AbortSignal;
  onProgress?: (p: import("./types.js").MediaPipelineProgress) => void;
  /**
   * CANONICAL INSPECTION SEAM (canonical-upload-content-classification).
   * When present, the pipeline runs `inspectMedia` on the just-downloaded temp
   * input — BEFORE moderation and processing — and calls this policy hook with
   * the bounded result. The hook either:
   *   - returns `{ spec }` — the caller's policy adapter selected the
   *     processing spec FROM the inspection (the byte-derived kind, never the
   *     client MIME); the pipeline continues with that spec; or
   *   - returns `{ reject }` — a typed terminal (`kind_mismatch`,
   *     `unsupported_format`, `unsupported_codec`, …); the pipeline stops
   *     before any transcode/moderation work.
   * The inspection result rides the returned `MediaProcessingResult.inspection`
   * either way, so the finalizer hands the SAME object to the safety gate —
   * one authority, no re-detection. Callers that omit the hook get the
   * pre-existing behavior unchanged.
   */
  resolveAfterInspection?: (
    inspection: MediaInspectionResult,
  ) => Promise<{ spec: MediaProcessingSpec } | { reject: MediaProcessingError }> | ({ spec: MediaProcessingSpec } | { reject: MediaProcessingError });
  /** Inspection tool overrides (tests). */
  inspectionDeps?: InspectMediaDeps;
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
    let { spec } = args;
    const { io, outputBaseName = "media", moderation, signal, onProgress, resolveAfterInspection } = args;
    // Carried onto every return path once produced — the finalizer must hand the
    // SAME inspection object to the safety gate (one classification authority).
    let inspection: MediaInspectionResult | undefined;
    const withInspection = (r: MediaProcessingResult): MediaProcessingResult =>
      inspection ? { ...r, inspection } : r;

    if (signal?.aborted) {
      return {
        ok: false,
        mediaType: mediaTypeFromSpecKind(spec.kind),
        error: { code: "processing_canceled", message: "Processing canceled." },
      };
    }

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
  
    const ws = await createTempWorkspace();
  
    try {
      const inputPath = path.join(ws.dir, "input");
      const outputBasePath = path.join(ws.dir, outputBaseName);
  
      if (signal?.aborted) {
        return { ok: false, mediaType: mediaTypeFromSpecKind(spec.kind), error: { code: "processing_canceled", message: "Processing canceled." } };
      }
      onProgress?.({ phase: "read_input", percent: 0 });
      await io.input.readToFile(inputPath);
      onProgress?.({ phase: "read_input", percent: 1 });

      // CANONICAL INSPECTION (before moderation and processing): classify the
      // just-downloaded bytes structurally and let the caller's policy adapter
      // pick the spec from the result. See RunPipelineArgs.resolveAfterInspection.
      if (resolveAfterInspection) {
        inspection = await inspectMedia({
          localPath: inputPath,
          ...(signal ? { signal } : {}),
          ...(args.inspectionDeps ? { deps: args.inspectionDeps } : {}),
        });
        const resolution = await resolveAfterInspection(inspection);
        if ("reject" in resolution) {
          return withInspection({
            ok: false,
            mediaType: mediaTypeFromSpecKind(spec.kind),
            error: resolution.reject,
          });
        }
        try {
          spec = parseMediaProcessingSpec(resolution.spec);
        } catch (e: any) {
          return withInspection({
            ok: false,
            mediaType: mediaTypeFromSpecKind(spec.kind),
            error: {
              code: "invalid_spec",
              message: "Invalid MediaProcessingSpec from resolveAfterInspection.",
              details: { issues: e?.issues ?? e?.message ?? String(e) },
            },
          });
        }
      }

      // PRE moderation (original)
      let mIn: MediaModerationResult | null | undefined;
      if (moderation?.moderateInput) {
        onProgress?.({ phase: "moderation_input", percent: 0 });
        mIn = attachProvider(
          await moderation.moderateInput({
            spec,
            kind: spec.kind,
            localPath: inputPath,
            mime: io.input.mime,
          }),
          moderation.provider
        );
        onProgress?.({ phase: "moderation_input", percent: 1 });
  
        // Fail closed on both "rejected" (policy violation) and "error" (the
        // moderation check itself did not complete — quota/outage/API failure).
        // A non-passing check must NEVER fall through to transcode + persist:
        // published bytes must always have been scanned. An "error" is a system
        // failure, not a content rejection, so it returns the distinct,
        // retryable `processing_failed` code AND carries `moderation` (status
        // "error") on the result — callers route that to their retryable
        // moderation lane and land the row failed rather than publishing it.
        if (mIn?.status === "rejected" || mIn?.status === "error") {
          return withInspection({
            ok: false,
            mediaType: mediaTypeFromSpecKind(spec.kind),
            moderation: mIn,
            error:
              mIn.status === "error"
                ? {
                    code: "processing_failed",
                    message: "Moderation check did not complete.",
                    details: { provider: mIn.provider, reason: "moderation_error" },
                  }
                : {
                    code: "rejected",
                    message: "Rejected by moderation.",
                    details: { provider: mIn.provider, reasons: mIn.reasons, findings: mIn.findings },
                  },
          });
        }
      }
  
      const result = await processMedia(spec, {
        inputPath,
        outputBasePath,
        inputMime: io.input.mime,
      }, { signal, onProgress });

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
            return withInspection({
              ok: false,
              mediaType: mediaTypeFromSpecKind(spec.kind),
              error: {
                code: "too_large",
                message: "Processed output exceeds allowed size.",
                details: { key: o.key, sizeBytes: size, limitBytes: perFileLimit },
              },
            });
          }
          if (total > totalLimit) {
            return withInspection({
              ok: false,
              mediaType: mediaTypeFromSpecKind(spec.kind),
              error: {
                code: "too_large",
                message: "Total processed outputs exceed allowed size.",
                details: { totalBytes: total, limitBytes: totalLimit },
              },
            });
          }
        }
      }
  
      if (!result.ok || !result.outputs?.length) {
        if (mIn) result.moderation = mIn;
        onProgress?.({ phase: "done", percent: result.ok ? 1 : 0 });
        return withInspection(result);
      }
  
      // POST moderation (processed outputs) — runs on the LOCAL output paths
      // BEFORE any final persistence, so rejected output never reaches the
      // final store (R2 / emulator). Ordering is load-bearing — see
      // the consuming app's media-serving design docs.
      let mOut: MediaModerationResult | null | undefined;
      if (moderation?.moderateOutput) {
        onProgress?.({ phase: "moderation_output", percent: 0 });
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
        onProgress?.({ phase: "moderation_output", percent: 1 });

        // Same fail-closed posture as the input check: block both "rejected"
        // and "error" before any persistence, so an incomplete check can never
        // publish unscanned output. Ordering is load-bearing — see the
        // consuming app's media-serving design docs.
        if (mOut?.status === "rejected" || mOut?.status === "error") {
          return withInspection({
            ok: false,
            mediaType: result.mediaType,
            moderation: mOut,
            error:
              mOut.status === "error"
                ? {
                    code: "processing_failed",
                    message: "Moderation check did not complete.",
                    details: { provider: mOut.provider, reason: "moderation_error" },
                  }
                : {
                    code: "rejected",
                    message: "Rejected by moderation.",
                    details: { provider: mOut.provider, reasons: mOut.reasons, findings: mOut.findings },
                  },
          });
        }
      }

      // Persist outputs — only after input AND output moderation both passed.
      onProgress?.({ phase: "persist_outputs", percent: 0 });
      const totalOut = result.outputs.length;
      let outIdx = 0;
      for (const out of result.outputs) {
        if (signal?.aborted) {
          return withInspection({ ok: false, mediaType: result.mediaType, error: { code: "processing_canceled", message: "Processing canceled." } });
        }
        onProgress?.({ phase: "persist_outputs", percent: totalOut ? outIdx / totalOut : 0, detail: { key: out.key } });
        if (!out.path) continue;
        const persisted = await io.output.writeFromFile(out.path, out.key);
        if (persisted.url) out.url = persisted.url;
        if (persisted.path) out.path = persisted.path;
        outIdx += 1;
      }
      onProgress?.({ phase: "persist_outputs", percent: 1 });

      const merged = mergeModeration(mIn ?? undefined, mOut ?? undefined);
      if (merged) result.moderation = merged;

      onProgress?.({ phase: "done", percent: 1 });
  
      return withInspection(result);
    } finally {
      await ws.cleanup();
    }
  }
  