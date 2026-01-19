import type { MediaOutput, MediaProcessingResult, MediaProcessingSpec, VideoOrientation } from "@ttt-productions/media-contracts";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { ensureFfmpegAvailable, runFfmpeg } from "./ffmpeg.js";
import { probeVideo } from "./probe.js";
import { safeOutputPathFor } from "../utils/safe-path.js";
import type { ProcessMediaOptions } from "../types.js";

function matchMime(accepted: string, actual: string): boolean {
  const a = accepted.trim().toLowerCase();
  const m = actual.trim().toLowerCase();
  if (!a) return true;
  if (a === "*/*") return true;
  if (a.endsWith("/*")) return m.startsWith(a.slice(0, -1));
  return a === m;
}

function acceptAllowsVideo(spec: MediaProcessingSpec): boolean {
  const kinds = spec.accept?.kinds?.filter(Boolean) ?? [];
  return kinds.length === 0 ? true : kinds.includes("video");
}

function acceptAllowsMime(spec: MediaProcessingSpec, actualMime?: string): boolean {
  const mimes = spec.accept?.mimes?.filter(Boolean) ?? [];
  if (mimes.length === 0) return true; // empty => accept anything
  if (!actualMime) return false;
  return mimes.some((a) => matchMime(a, actualMime));
}

function aspect(width?: number, height?: number): number | undefined {
  if (!width || !height) return undefined;
  return width / height;
}

function aspectClose(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

function orientationOf(width?: number, height?: number): VideoOrientation | undefined {
  if (!width || !height) return undefined;
  if (width === height) return "any";
  return height > width ? "vertical" : "horizontal";
}

function orientationOk(required: VideoOrientation | undefined, actual: VideoOrientation | undefined): boolean {
  if (!required || required === "any") return true;
  if (!actual || actual === "any") return true; // treat square/unknown as ok
  return required === actual;
}

function outputPathFor(base: string, key: string, ext: string): string {
  return safeOutputPathFor(base, key, ext);
}

function mimeFromExt(ext: string): string | undefined {
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  return undefined;
}

export async function processVideo(
  spec: MediaProcessingSpec,
  ctx: {
    inputPath: string;
    outputBasePath: string;
    inputMime?: string;
  },
  opts?: ProcessMediaOptions
): Promise<MediaProcessingResult> {
  try {
    if (opts?.signal?.aborted) {
      return { ok: false, mediaType: "video", error: { code: "processing_canceled", message: "Processing canceled." } };
    }
    if (!acceptAllowsVideo(spec)) {
      return {
        ok: false,
        mediaType: "video",
        error: { code: "invalid_mime", message: "Spec does not allow video uploads.", details: { accept: spec.accept } },
      };
    }

    if (!acceptAllowsMime(spec, ctx.inputMime)) {
      return {
        ok: false,
        mediaType: "video",
        error: { code: "invalid_mime", message: "Video mime type is not allowed.", details: { inputMime: ctx.inputMime, accept: spec.accept } },
      };
    }

    const ff = await ensureFfmpegAvailable();
    if (!ff.ok) {
      return {
        ok: false,
        mediaType: "video",
        error: {
          code: "processing_failed",
          message: "ffmpeg is not available.",
          details: { error: String((ff as any).error ?? "unknown") },
        },
      };
    }

    const outDir = path.dirname(ctx.outputBasePath);
    await mkdir(outDir, { recursive: true });

    const probe = await probeVideo(ctx.inputPath);

    if (opts?.signal?.aborted) {
      return { ok: false, mediaType: "video", error: { code: "processing_canceled", message: "Processing canceled." } };
    }

    // duration enforcement
    const maxDur = spec.maxDurationSec ?? spec.video?.maxDurationSec;
    if (maxDur && probe.durationSec && probe.durationSec > maxDur) {
      return {
        ok: false,
        mediaType: "video",
        error: {
          code: "too_long",
          message: "Video is too long.",
          details: { durationSec: probe.durationSec, maxDurationSec: maxDur },
        },
      };
    }

    // uniform enforcement
    const requiredOri = spec.videoOrientation;
    const requiredAspect = spec.requiredAspectRatio;
    const requiredW = spec.requiredWidth;
    const requiredH = spec.requiredHeight;

    const actualOri = orientationOf(probe.width, probe.height);
    const actualAspect = aspect(probe.width, probe.height);

    const okOri = orientationOk(requiredOri, actualOri);
    const tol = spec.aspectRatioTolerance ?? 0.02;
    const okAspect = requiredAspect ? (actualAspect ? aspectClose(actualAspect, requiredAspect, tol) : false) : true;
    const okDims = !requiredW || !requiredH ? true : probe.width === requiredW && probe.height === requiredH;

    const needsAuto = !okOri || !okAspect || !okDims;

    if (needsAuto && !spec.allowAutoFormat) {
      if (!okOri) {
        return {
          ok: false,
          mediaType: "video",
          error: {
            code: "orientation_mismatch",
            message: "Video orientation does not match the required format.",
            details: { requiredOri, actualOri, width: probe.width, height: probe.height },
          },
        };
      }
      if (!okAspect) {
        return {
          ok: false,
          mediaType: "video",
          error: {
            code: "aspect_ratio_mismatch",
            message: "Video aspect ratio does not match the required format.",
            details: { requiredAspectRatio: requiredAspect, aspectRatio: actualAspect, width: probe.width, height: probe.height },
          },
        };
      }
      if (!okDims) {
        return {
          ok: false,
          mediaType: "video",
          error: {
            code: "dimensions_mismatch",
            message: "Video dimensions do not match the required format.",
            details: { requiredWidth: requiredW, requiredHeight: requiredH, width: probe.width, height: probe.height },
          },
        };
      }
    }

    // outputs
    const videoOut = outputPathFor(ctx.outputBasePath, "main", "mp4");
    const posterOut = outputPathFor(ctx.outputBasePath, "poster", "jpg");

    // Build a basic filter graph to enforce size/aspect when auto-format is enabled.
    // - If exact WxH required: scale+crop to WxH
    // - Else if aspect required: crop to aspect then scale to original (or keep)
    // - Else: keep original
    let vf = "";

    if (spec.allowAutoFormat) {
      if (requiredW && requiredH) {
        // scale to cover then crop exactly
        vf = `scale=${requiredW}:${requiredH}:force_original_aspect_ratio=increase,crop=${requiredW}:${requiredH}`;
      } else if (requiredAspect) {
        // crop to aspect ratio while keeping as much as possible
        // cropw/croph depend on input; use expressions
        // If too wide: crop width = ih*ar; else crop height = iw/ar
        vf = `crop='if(gt(iw/ih,${requiredAspect}),ih*${requiredAspect},iw)':'if(gt(iw/ih,${requiredAspect}),ih,iw/${requiredAspect})'`;
      }
    }

    const ffmpegArgs = [
      "-y",
      "-i",
      ctx.inputPath,
      ...(vf ? ["-vf", vf] : []),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      ...(probe.hasAudio ? ["-c:a", "aac", "-b:a", "128k"] : ["-an"]),
      videoOut,
    ];

    const r1 = await runFfmpeg(ffmpegArgs, {
      signal: opts?.signal,
      durationMs: probe.durationSec ? probe.durationSec * 1000 : undefined,
      onProgress: (p) => {
        opts?.onProgress?.({ phase: "process", percent: p.percent, detail: { step: "transcode", outTimeMs: p.outTimeMs } });
      },
      phase: "transcode",
    });
    if (r1.code !== 0) {
      return {
        ok: false,
        mediaType: "video",
        error: {
          code: "processing_failed",
          message: "ffmpeg video transcode failed.",
          details: { stderr: r1.stderr, stdout: r1.stdout },
        },
      };
    }

    // Poster (frame at 1s; fallback to 0 if needed)
    const posterArgs = ["-y", "-ss", "1", "-i", videoOut, "-frames:v", "1", "-q:v", "2", posterOut];
    const r2 = await runFfmpeg(posterArgs, {
      signal: opts?.signal,
      onProgress: (p) => {
        opts?.onProgress?.({ phase: "process", percent: p.percent, detail: { step: "poster", outTimeMs: p.outTimeMs } });
      },
      phase: "poster",
    });
    if (r2.code !== 0) {
      // non-fatal; still succeed with video
    }

    const vs = await stat(videoOut);
    let psSize = 0;
    try {
      const ps = await stat(posterOut);
      psSize = ps.size;
    } catch {}

    const outputs: MediaOutput[] = [
      {
        key: "main",
        url: `file://${videoOut}`,
        path: videoOut,
        mime: mimeFromExt("mp4"),
        sizeBytes: vs.size,
        width: requiredW ?? probe.width,
        height: requiredH ?? probe.height,
        durationSec: probe.durationSec,
      },
    ];

    const warnings: string[] = [];
    if (needsAuto && spec.allowAutoFormat) warnings.push("auto_formatted");
    if (r2.code !== 0) warnings.push("poster_failed");

    if (psSize > 0) {
      outputs.push({
        key: "poster",
        url: `file://${posterOut}`,
        path: posterOut,
        mime: "image/jpeg",
        sizeBytes: psSize,
      });
    }

    return {
      ok: true,
      mediaType: "video",
      outputs,
      meta: {
        mime: ctx.inputMime,
        sizeBytes: undefined,
        width: probe.width,
        height: probe.height,
        durationSec: probe.durationSec,
      },
      warnings: warnings.length ? warnings : undefined,
    };
  } catch (e: any) {
    return {
      ok: false,
      mediaType: "video",
      error: {
        code: "processing_failed",
        message: e?.message ? String(e.message) : "Video processing failed",
        details: { name: e?.name },
      },
    };
  }
}
