export interface MediaSizeOption {
  readonly key: string;
  readonly width: number;
}

export const MEDIA_SIZE_MAX_DENSITY = 2;

export function mediaSizeNeed(drawnWidth: number, pixelRatio: number): number {
  const density = Math.min(Math.max(pixelRatio, 1), MEDIA_SIZE_MAX_DENSITY);
  return Math.ceil(drawnWidth * density);
}

export function pickMediaSize(
  sizes: readonly MediaSizeOption[],
  need: number,
): MediaSizeOption | null {
  if (sizes.length === 0) return null;
  const byWidth = [...sizes].sort((a, b) => a.width - b.width);
  return byWidth.find((size) => size.width >= need) ?? byWidth[byWidth.length - 1] ?? null;
}
