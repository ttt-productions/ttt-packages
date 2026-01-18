import type { MediaOutput, MediaProcessingResult, MediaProcessingSpec } from "@ttt-productions/media-contracts";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

type Gravity = "center" | "top" | "bottom" | "left" | "right";

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
  return `${base}_${key}.${ext}`;
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

export async function processImage(
  spec: MediaProcessingSpec,
  ctx: {
    inputPath: string;
    outputBasePath: string;
  }
): Promise<MediaProcessingResult> {
  try {
    const variants =
      spec.image?.variants?.length
        ? spec.image.variants
        : [{ key: "original" as const }];

    const outDir = path.dirname(ctx.outputBasePath);
    await mkdir(outDir, { recursive: true });

    const input = sharp(ctx.inputPath, { failOn: "none" });
    const inputMeta = await input.metadata();

    const outputs: MediaOutput[] = [];

    for (const v of variants) {
      const { ext, format } = pickFormat(v.format);
      const outPath = outputPathFor(ctx.outputBasePath, v.key, ext);

      let p = sharp(ctx.inputPath, { failOn: "none" });

      // sharp strips metadata by default. Only keep metadata if explicitly requested.
      if (spec.image?.stripMetadata === false) {
        p = p.withMetadata({ orientation: inputMeta.orientation });
      }

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
