import type {
  MediaOutput,
  MediaProcessingError,
  MediaProcessingResult,
  MediaProcessingSpec,
} from '@ttt-productions/media-schemas';
import sharp from 'sharp';
import type { Sharp, Metadata } from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { safeOutputPathFor } from '../utils/safe-path.js';
import type { ProcessMediaOptions } from '../types.js';
import { applyImageFormat, mimeForImageFormat, pickFormat } from './formats.js';
import {
  computeAspectCropBox,
  resizeCover,
  resizeInside,
  toSharpPosition,
  type Gravity,
} from './resize.js';
import { IMAGE_DEFAULT_OUTPUT_KEY } from '@ttt-productions/media-schemas';

function matchMime(accepted: string, actual: string): boolean {
  const a = accepted.trim().toLowerCase();
  const m = actual.trim().toLowerCase();
  if (!a) return true;
  if (a === '*/*') return true;
  if (a.endsWith('/*')) return m.startsWith(a.slice(0, -1));
  return a === m;
}

function acceptAllowsImage(spec: MediaProcessingSpec): boolean {
  const kinds = spec.accept?.kinds?.filter(Boolean) ?? [];
  return kinds.length === 0 ? true : kinds.includes('image');
}

function acceptAllowsMime(spec: MediaProcessingSpec, actualMime?: string): boolean {
  const mimes = spec.accept?.mimes?.filter(Boolean) ?? [];
  if (mimes.length === 0) return true;
  if (!actualMime) return false;
  return mimes.some((a) => matchMime(a, actualMime));
}

function outputPathFor(base: string, key: string, ext: string): string {
  return safeOutputPathFor(base, key, ext);
}

function aspect(width?: number, height?: number): number | undefined {
  if (!width || !height) return undefined;
  return width / height;
}

function aspectClose(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

async function buildBase(
  spec: MediaProcessingSpec,
  inputPath: string,
): Promise<
  { ok: true; base: Sharp; inputMeta: Metadata } | { ok: false; error: MediaProcessingError }
> {
  const input = sharp(inputPath, { failOn: 'none' });
  const meta = await input.metadata();

  if (!meta.width || !meta.height || meta.width <= 0 || meta.height <= 0) {
    return {
      ok: false,
      error: {
        code: 'processing_failed',
        message: 'Unable to read valid image dimensions. File may be corrupt.',
        details: { width: meta.width, height: meta.height, format: meta.format, path: inputPath },
      },
    };
  }

  if (!meta.format) {
    return {
      ok: false,
      error: {
        code: 'unsupported_format',
        message: 'Unable to determine image format. File may be corrupt.',
        details: { path: inputPath },
      },
    };
  }

  if (!acceptAllowsImage(spec)) {
    return {
      ok: false,
      error: {
        code: 'invalid_mime',
        message: 'Spec does not allow image uploads.',
        details: { accept: spec.accept },
      },
    };
  }

  const detectedMime = mimeForImageFormat(meta.format);
  if (!acceptAllowsMime(spec, detectedMime)) {
    return {
      ok: false,
      error: {
        code: 'invalid_mime',
        message: 'Image mime type is not allowed.',
        details: { detectedMime, accept: spec.accept },
      },
    };
  }

  const w = meta.width ?? undefined;
  const h = meta.height ?? undefined;

  if (!w || !h) {
    if (spec.requiredWidth || spec.requiredHeight || spec.requiredAspectRatio) {
      if (!spec.allowAutoFormat && !spec.imageCrop) {
        return {
          ok: false,
          error: {
            code: 'dimensions_mismatch',
            message: 'Unable to read image dimensions for validation.',
            details: { width: w, height: h },
          },
        };
      }
    }
  }

  let base = sharp(inputPath);

  if (spec.image?.stripMetadata === false) {
    base = base.withMetadata({ orientation: meta.orientation });
  }

  const crop = spec.imageCrop;
  if (crop) {
    base = resizeCover(base, crop.outputWidth, crop.outputHeight);
    return { ok: true, base, inputMeta: meta };
  }

  const reqW = spec.requiredWidth;
  const reqH = spec.requiredHeight;
  if (reqW && reqH) {
    const canFix = spec.allowAutoFormat === true;
    if (!canFix && w && h && (w !== reqW || h !== reqH)) {
      return {
        ok: false,
        error: {
          code: 'dimensions_mismatch',
          message: 'Image dimensions do not match the required format.',
          details: { requiredWidth: reqW, requiredHeight: reqH, width: w, height: h },
        },
      };
    }

    base = resizeCover(base, reqW, reqH);

    return { ok: true, base, inputMeta: meta };
  }

  const reqAspect = spec.requiredAspectRatio;
  if (reqAspect && w && h) {
    const a = aspect(w, h);
    const tol = spec.aspectRatioTolerance ?? 0.02;
    if (a && !aspectClose(a, reqAspect, tol)) {
      if (!spec.allowAutoFormat) {
        return {
          ok: false,
          error: {
            code: 'aspect_ratio_mismatch',
            message: 'Image aspect ratio does not match the required format.',
            details: { requiredAspectRatio: reqAspect, aspectRatio: a, width: w, height: h },
          },
        };
      }

      base = base.extract(computeAspectCropBox(w, h, reqAspect));
    }
  }

  return { ok: true, base, inputMeta: meta };
}

export async function processImage(
  spec: MediaProcessingSpec,
  ctx: {
    inputPath: string;
    outputBasePath: string;
  },
  opts?: ProcessMediaOptions,
): Promise<MediaProcessingResult> {
  const tempFiles: string[] = [];

  try {
    if (opts?.signal?.aborted) {
      return {
        ok: false,
        mediaType: 'image',
        error: { code: 'processing_canceled', message: 'Processing canceled.' },
      };
    }

    const variants = spec.image?.variants?.length
      ? spec.image.variants
      : [{ key: IMAGE_DEFAULT_OUTPUT_KEY }];

    const outDir = path.dirname(ctx.outputBasePath);
    await mkdir(outDir, { recursive: true });

    const baseRes = await buildBase(spec, ctx.inputPath);
    if (!baseRes.ok) {
      return { ok: false, mediaType: 'image', error: baseRes.error };
    }

    const { base, inputMeta } = baseRes;

    const outputs: MediaOutput[] = [];
    const totalVariants = variants.length || 1;
    let idx = 0;

    for (const v of variants) {
      idx += 1;

      if (opts?.signal?.aborted) {
        return {
          ok: false,
          mediaType: 'image',
          error: { code: 'processing_canceled', message: 'Processing canceled.' },
        };
      }

      opts?.onProgress?.({
        phase: 'process',
        percent: (idx - 1) / totalVariants,
        detail: { step: 'image_variant', key: v.key },
      });

      const { ext, format } = pickFormat(v.format);
      const outPath = outputPathFor(ctx.outputBasePath, v.key, ext);
      tempFiles.push(outPath);

      let p = base.clone();

      if (v.crop) {
        p = resizeCover(
          p,
          v.crop.width,
          v.crop.height,
          toSharpPosition((v.crop.gravity as Gravity) ?? 'center'),
        );
      } else if (v.maxWidth || v.maxHeight) {
        p = resizeInside(p, v.maxWidth, v.maxHeight);
      }

      p = applyImageFormat(p, format, v.quality);

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

    tempFiles.length = 0;

    return {
      ok: true,
      mediaType: 'image',
      outputs,
      meta: {
        mime: mimeForImageFormat(inputMeta.format),
        width: inputMeta.width,
        height: inputMeta.height,
      },
    };
  } catch (e) {
    const fault = e as { message?: unknown; name?: unknown } | null | undefined;
    return {
      ok: false,
      mediaType: 'image',
      error: {
        code: 'processing_failed',
        message: fault?.message ? String(fault.message) : 'Image processing failed',
        details: { name: fault?.name },
      },
    };
  } finally {
    if (tempFiles.length) {
      const { rm } = await import('node:fs/promises');
      await Promise.all(tempFiles.map((f) => rm(f, { force: true }).catch(() => {})));
    }
  }
}
