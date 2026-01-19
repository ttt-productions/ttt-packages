import type { MediaOutput, MediaProcessingResult, MediaProcessingSpec } from "@ttt-productions/media-contracts";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { safeOutputPathFor } from "../utils/safe-path";

type Gravity = "center" | "top" | "bottom" | "left" | "right";

function matchMime(accepted: string, actual: string): boolean {
  const a = accepted.trim().toLowerCase();
  const m = actual.trim().toLowerCase();
  if (!a) return true;
  if (a === "*/*") return true;
  if (a.endsWith("/*")) return m.startsWith(a.slice(0, -1));
  return a === m;
}

function acceptAllowsImage(spec: MediaProcessingSpec): boolean {
  const kinds = spec.accept?.kinds?.filter(Boolean) ?? [];
  return kinds.length === 0 ? true : kinds.includes("image");
}

function acceptAllowsMime(spec: MediaProcessingSpec, actualMime?: string): boolean {
  const mimes = spec.accept?.mimes?.filter(Boolean) ?? [];
  if (mimes.length === 0) return true; // empty => accept anything
  if (!actualMime) return false;
  return mimes.some((a) => matchMime(a, actualMime));
}


function toSharpPosition(g?: Gravity): sharp.Gravity {
  switch (g) {
    case "top":
      return "north";
    case "bottom":
      return "south";
    case "left":
      return "west";
    case "right":
      return "east";
    case "center":
    default:
      return "centre";
  }
}

function pickFormat(fmt?: string): { ext: string; format: "jpeg" | "png" | "webp" | "avif" } {
  switch ((fmt ?? "jpeg").toLowerCase()) {
    case "png":
      return { ext: "png", format: "png" };
    case "webp":
      return { ext: "webp", format: "webp" };
    case "avif":
      return { ext: "avif", format: "avif" };
    case "jpg":
    case "jpeg":
    default:
      return { ext: "jpg", format: "jpeg" };
  }
}

function outputPathFor(base: string, key: string, ext: string): string {
  return safeOutputPathFor(base, key, ext);
}

function mimeForImageFormat(fmt?: string): string | undefined {
  if (!fmt) return undefined;
  const f = fmt.toLowerCase();
  if (f === "jpg") return "image/jpeg";
  if (f === "jpeg") return "image/jpeg";
  if (f === "png") return "image/png";
  if (f === "webp") return "image/webp";
  if (f === "avif") return "image/avif";
  return `image/${f}`;
}

function aspect(width?: number, height?: number): number | undefined {
  if (!width || !height) return undefined;
  return width / height;
}

function aspectClose(a: number, b: number, tolerance = 0.02): boolean {
  return Math.abs(a - b) <= tolerance;
}

/**
 * Build a "normalized base" pipeline that enforces spec-level uniformity:
 * - if imageCrop exists -> always crop to outputWidth/outputHeight
 * - else if requiredWidth/requiredHeight exist -> crop/resize to those
 * - else if requiredAspectRatio exists -> center-crop to that aspect (no scaling unless needed later)
 *
 * If the source violates constraints and we cannot/should not auto-fix, returns a rejection error.
 */
async function buildBase(
  spec: MediaProcessingSpec,
  inputPath: string
): Promise<
  | { ok: true; base: sharp.Sharp; inputMeta: sharp.Metadata }
  | { ok: false; error: MediaProcessingResult["error"] }
> {
  const input = sharp(inputPath);
  const meta = await input.metadata();

  if (!meta || !meta.width || !meta.height) {
    return {
      ok: false,
      error: {
        code: "processing_failed",
        message: "Failed to read image metadata.",
      },
    };
  }

  if (!acceptAllowsImage(spec)) {
    return {
      ok: false,
      error: {
        code: "invalid_mime",
        message: "Spec does not allow image uploads.",
        details: { accept: spec.accept },
      },
    };
  }
  
  const detectedMime = mimeForImageFormat(meta.format);
  if (!acceptAllowsMime(spec, detectedMime)) {
    return {
      ok: false,
      error: {
        code: "invalid_mime",
        message: "Image mime type is not allowed.",
        details: { detectedMime, accept: spec.accept },
      },
    };
  }

  const w = meta.width ?? undefined;
  const h = meta.height ?? undefined;

  if (!w || !h) {
    // Can't validate/crop reliably without dimensions.
    // We'll still proceed unless strict dims/aspect are required without crop/auto.
    if (spec.requiredWidth || spec.requiredHeight || spec.requiredAspectRatio) {
      if (!spec.allowAutoFormat && !spec.imageCrop) {
        return {
          ok: false,
          error: {
            code: "dimensions_mismatch",
            message: "Unable to read image dimensions for validation.",
            details: { width: w, height: h },
          },
        };
      }
    }
  }

  // Start from raw input each time; callers can clone as needed.
  let base = sharp(inputPath);

  // Keep metadata only if explicitly requested.
  if (spec.image?.stripMetadata === false) {
    base = base.withMetadata({ orientation: meta.orientation });
  }

  // 1) Explicit crop spec (most strict)
  const crop = spec.imageCrop;
  if (crop) {
    base = base.resize(crop.outputWidth, crop.outputHeight, {
      fit: "cover",
      position: "centre",
      withoutEnlargement: true,
    });
    return { ok: true, base, inputMeta: meta };
  }

  // 2) Exact required size -> auto crop/resize only if allowAutoFormat OR the request is inherently "uniform"
  const reqW = spec.requiredWidth;
  const reqH = spec.requiredHeight;
  if (reqW && reqH) {
    const canFix = spec.allowAutoFormat === true;
    // If not allowed to auto-fix, require exact match
    if (!canFix && w && h && (w !== reqW || h !== reqH)) {
      return {
        ok: false,
        error: {
          code: "dimensions_mismatch",
          message: "Image dimensions do not match the required format.",
          details: { requiredWidth: reqW, requiredHeight: reqH, width: w, height: h },
        },
      };
    }

    // Auto-fix path (or exact already): enforce normalized base
    base = base.resize(reqW, reqH, {
      fit: "cover",
      position: "centre",
      withoutEnlargement: true,
    });

    return { ok: true, base, inputMeta: meta };
  }

  // 3) Aspect ratio requirement (no exact size)
  const reqAspect = spec.requiredAspectRatio;
  if (reqAspect && w && h) {
    const a = aspect(w, h);
    if (a && !aspectClose(a, reqAspect)) {
      if (!spec.allowAutoFormat) {
        return {
          ok: false,
          error: {
            code: "aspect_ratio_mismatch",
            message: "Image aspect ratio does not match the required format.",
            details: { requiredAspectRatio: reqAspect, aspectRatio: a, width: w, height: h },
          },
        };
      }

      // Auto center-crop to required aspect ratio (no forced scale yet)
      // Compute a crop box that matches reqAspect and fits within original dimensions.
      let cropW = w;
      let cropH = h;

      if (a > reqAspect) {
        // too wide -> reduce width
        cropW = Math.max(1, Math.floor(h * reqAspect));
      } else {
        // too tall -> reduce height
        cropH = Math.max(1, Math.floor(w / reqAspect));
      }

      const left = Math.max(0, Math.floor((w - cropW) / 2));
      const top = Math.max(0, Math.floor((h - cropH) / 2));

      base = base.extract({ left, top, width: cropW, height: cropH });
    }
  }

  return { ok: true, base, inputMeta: meta };
}

export async function processImage(
  spec: MediaProcessingSpec,
  ctx: {
    inputPath: string;
    outputBasePath: string;
  }
): Promise<MediaProcessingResult> {
  try {
    const variants =
      spec.image?.variants?.length ? spec.image.variants : [{ key: "original" as const }];

    const outDir = path.dirname(ctx.outputBasePath);
    await mkdir(outDir, { recursive: true });

    const baseRes = await buildBase(spec, ctx.inputPath);
    if (!baseRes.ok) {
      return { ok: false, mediaType: "image", error: baseRes.error };
    }

    const { base, inputMeta } = baseRes;

    const outputs: MediaOutput[] = [];

    for (const v of variants) {
      const { ext, format } = pickFormat(v.format);
      const outPath = outputPathFor(ctx.outputBasePath, v.key, ext);

      // Clone from normalized base so each variant is consistent
      let p = base.clone();

      if (v.crop) {
        p = p.resize(v.crop.width, v.crop.height, {
          fit: "cover",
          position: toSharpPosition((v.crop.gravity as Gravity) ?? "center"),
          withoutEnlargement: true,
        });
      } else if (v.maxWidth || v.maxHeight) {
        p = p.resize(v.maxWidth ?? null, v.maxHeight ?? null, {
          fit: "inside",
          withoutEnlargement: true,
        });
      }

      const q = typeof v.quality === "number" ? v.quality : undefined;

      switch (format) {
        case "png":
          p = p.png();
          break;
        case "webp":
          p = p.webp(q ? { quality: q } : undefined);
          break;
        case "avif":
          p = p.avif(q ? { quality: q } : undefined);
          break;
        case "jpeg":
        default:
          p = p.jpeg(q ? { quality: q } : undefined);
          break;
      }

      const info = await p.toFile(outPath);

      outputs.push({
        key: v.key,
        url: `file://${outPath}`,
        path: outPath,
        mime: mimeForImageFormat(info.format),
        sizeBytes: info.size,
        width: info.width,
        height: info.height,
      });
    }

    return {
      ok: true,
      mediaType: "image",
      outputs,
      meta: {
        mime: mimeForImageFormat(inputMeta.format),
        width: inputMeta.width,
        height: inputMeta.height,
      },
    };
  } catch (e: any) {
    return {
      ok: false,
      mediaType: "image",
      error: {
        code: "processing_failed",
        message: e?.message ? String(e.message) : "Image processing failed",
        details: { name: e?.name },
      },
    };
  }
}
