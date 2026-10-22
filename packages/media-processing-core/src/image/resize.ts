import type { Sharp, Gravity as SharpGravity } from 'sharp';

export type Gravity = 'center' | 'top' | 'bottom' | 'left' | 'right';

export function toSharpPosition(g?: Gravity): SharpGravity {
  switch (g) {
    case 'top':
      return 'north';
    case 'bottom':
      return 'south';
    case 'left':
      return 'west';
    case 'right':
      return 'east';
    case 'center':
    default:
      return 'centre';
  }
}

export function resizeCover(
  pipeline: Sharp,
  width: number,
  height: number,
  position: SharpGravity = 'centre',
): Sharp {
  return pipeline.resize(width, height, {
    fit: 'cover',
    position,
    withoutEnlargement: true,
  });
}

export function resizeInside(pipeline: Sharp, maxWidth?: number, maxHeight?: number): Sharp {
  return pipeline.resize(maxWidth ?? null, maxHeight ?? null, {
    fit: 'inside',
    withoutEnlargement: true,
  });
}

export function computeAspectCropBox(
  width: number,
  height: number,
  targetAspect: number,
): { left: number; top: number; width: number; height: number } {
  const a = width / height;
  let cropW = width;
  let cropH = height;

  if (a > targetAspect) {
    cropW = Math.max(1, Math.floor(height * targetAspect));
  } else {
    cropH = Math.max(1, Math.floor(width / targetAspect));
  }

  const left = Math.max(0, Math.floor((width - cropW) / 2));
  const top = Math.max(0, Math.floor((height - cropH) / 2));

  return { left, top, width: cropW, height: cropH };
}
