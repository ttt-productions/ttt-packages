// sharp resize helpers extracted from the image-processor
import type { Sharp, Gravity as SharpGravity } from "sharp";

/** Logical crop/resize gravity, mapped to sharp positions by toSharpPosition. */
export type Gravity = "center" | "top" | "bottom" | "left" | "right";

/** Map a logical gravity to a sharp position string. Defaults to centre. */
export function toSharpPosition(g?: Gravity): SharpGravity {
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

/**
 * Cover-resize to an exact width/height (crop to fill), never enlarging beyond
 * the source. Used for explicit crops and required-size normalization.
 */
export function resizeCover(
  pipeline: Sharp,
  width: number,
  height: number,
  position: SharpGravity = "centre"
): Sharp {
  return pipeline.resize(width, height, {
    fit: "cover",
    position,
    withoutEnlargement: true,
  });
}

/**
 * Fit-inside resize bounded by maxWidth/maxHeight (preserves aspect ratio),
 * never enlarging beyond the source. Either bound may be omitted.
 */
export function resizeInside(
  pipeline: Sharp,
  maxWidth?: number,
  maxHeight?: number
): Sharp {
  return pipeline.resize(maxWidth ?? null, maxHeight ?? null, {
    fit: "inside",
    withoutEnlargement: true,
  });
}

/**
 * Compute a centered crop box that brings (width x height) to targetAspect,
 * shrinking only the longer dimension. Returns sharp .extract() coordinates.
 */
export function computeAspectCropBox(
  width: number,
  height: number,
  targetAspect: number
): { left: number; top: number; width: number; height: number } {
  const a = width / height;
  let cropW = width;
  let cropH = height;

  if (a > targetAspect) {
    // too wide -> reduce width
    cropW = Math.max(1, Math.floor(height * targetAspect));
  } else {
    // too tall -> reduce height
    cropH = Math.max(1, Math.floor(width / targetAspect));
  }

  const left = Math.max(0, Math.floor((width - cropW) / 2));
  const top = Math.max(0, Math.floor((height - cropH) / 2));

  return { left, top, width: cropW, height: cropH };
}
