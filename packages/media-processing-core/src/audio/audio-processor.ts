import type { MediaOutput, MediaProcessingResult, MediaProcessingSpec } from "@ttt-productions/media-contracts";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { runCmd } from "../video/ffmpeg";
import { probeAudio } from "./probe";

function matchMime(accepted: string, actual: string): boolean {
  const a = accepted.trim().toLowerCase();
  const m = actual.trim().toLowerCase();
  if (!a) return true;
  if (a === "*/*") return true;
  if (a.endsWith("/*")) return m.startsWith(a.slice(0, -1));
  return a === m;
}

function acceptAllowsAudio(spec: MediaProcessingSpec): boolean {
  const kinds = spec.accept?.kinds?.filter(Boolean) ?? [];
  return kinds.length === 0 ? true : kinds.includes("audio");
}

function acceptAllowsMime(spec: MediaProcessingSpec, actualMime?: string): boolean {
  const mimes = spec.accept?.mimes?.filter(Boolean) ?? [];
  if (mimes.length === 0) return true; // empty => accept anything
  if (!actualMime) return false;
  return mimes.some((a) => matchMime(a, actualMime));
}

function outputPathFor(base: string, key: string, ext: string): string {
  return `${base}_${key}.${ext}`;
}

export async function processAudio(
  spec: MediaProcessingSpec,
  ctx: {
    inputPath: string;
    outputBasePath: string;
    inputMime?: string;
  }
): Promise<MediaProcessingResult> {
  try {
    if (!acceptAllowsAudio(spec)) {
      return {
        ok: false,
        mediaType: "audio",
        error: { code: "invalid_mime", message: "Spec does not allow audio uploads.", details: { accept: spec.accept } },
      };
    }

    if (!acceptAllowsMime(spec, ctx.inputMime)) {
      return {
        ok: false,
        mediaType: "audio",
        error: { code: "invalid_mime", message: "Audio mime type is not allowed.", details: { inputMime: ctx.inputMime, accept: spec.accept } },
      };
    }

    const outDir = path.dirname(ctx.outputBasePath);
    await mkdir(outDir, { recursive: true });

    const probe = await probeAudio(ctx.inputPath);

    const maxDur = spec.maxDurationSec ?? spec.audio?.maxDurationSec;
    if (maxDur && probe.durationSec && probe.durationSec > maxDur) {
      return {
        ok: false,
        mediaType: "audio",
        error: {
          code: "too_long",
          message: "Audio is too long.",
          details: { durationSec: probe.durationSec, maxDurationSec: maxDur },
        },
      };
    }

    // Normalize to AAC in m4a (small + widely supported)
    const outPath = outputPathFor(ctx.outputBasePath, "main", "m4a");

    const args = [
      "-y",
      "-i",
      ctx.inputPath,
      "-vn",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      outPath,
    ];

    const r = await runCmd("ffmpeg", args);
    if (r.code !== 0) {
      return {
        ok: false,
        mediaType: "audio",
        error: {
          code: "processing_failed",
          message: "ffmpeg audio transcode failed.",
          details: { stderr: r.stderr?.slice(0, 2000) },
        },
      };
    }

    const s = await stat(outPath);

    const outputs: MediaOutput[] = [
      {
        key: "main",
        url: `file://${outPath}`,
        path: outPath,
        mime: "audio/mp4",
        sizeBytes: s.size,
        durationSec: probe.durationSec,
      },
    ];

    return {
      ok: true,
      mediaType: "audio",
      outputs,
      meta: {
        mime: ctx.inputMime,
        durationSec: probe.durationSec,
      },
    };
  } catch (e: any) {
    return {
      ok: false,
      mediaType: "audio",
      error: {
        code: "processing_failed",
        message: e?.message ? String(e.message) : "Audio processing failed",
        details: { name: e?.name },
      },
    };
  }
}
