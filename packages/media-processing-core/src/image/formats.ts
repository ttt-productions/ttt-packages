// shared image format / quality presets
import type { Sharp } from "sharp";

/** Output image formats the processor can emit. */
export type ImageOutputFormat = "jpeg" | "png" | "webp" | "avif";

/**
 * Map a requested format string (case-insensitive) to its sharp format id and
 * file extension. Unknown or missing formats fall back to jpeg.
 */
export function pickFormat(fmt?: string): { ext: string; format: ImageOutputFormat } {
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

/** Map an image format string to its MIME type. */
export function mimeForImageFormat(fmt?: string): string | undefined {
  if (!fmt) return undefined;
  const f = fmt.toLowerCase();
  if (f === "jpg") return "image/jpeg";
  if (f === "jpeg") return "image/jpeg";
  if (f === "png") return "image/png";
  if (f === "webp") return "image/webp";
  if (f === "avif") return "image/avif";
  return `image/${f}`;
}

/**
 * Apply the chosen output format (and optional quality) to a sharp pipeline.
 * png is lossless so quality is ignored; jpeg/webp/avif honor quality when set,
 * otherwise sharp's per-format defaults apply.
 */
export function applyImageFormat(
  pipeline: Sharp,
  format: ImageOutputFormat,
  quality?: number
): Sharp {
  const q = typeof quality === "number" ? quality : undefined;
  switch (format) {
    case "png":
      return pipeline.png();
    case "webp":
      return pipeline.webp(q ? { quality: q } : undefined);
    case "avif":
      return pipeline.avif(q ? { quality: q } : undefined);
    case "jpeg":
    default:
      return pipeline.jpeg(q ? { quality: q } : undefined);
  }
}
