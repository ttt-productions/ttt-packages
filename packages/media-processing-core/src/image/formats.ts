import type { Sharp } from 'sharp';

export type ImageOutputFormat = 'jpeg' | 'png' | 'webp' | 'avif';

export function pickFormat(fmt?: string): { ext: string; format: ImageOutputFormat } {
  switch ((fmt ?? 'jpeg').toLowerCase()) {
    case 'png':
      return { ext: 'png', format: 'png' };
    case 'webp':
      return { ext: 'webp', format: 'webp' };
    case 'avif':
      return { ext: 'avif', format: 'avif' };
    case 'jpg':
    case 'jpeg':
    default:
      return { ext: 'jpg', format: 'jpeg' };
  }
}

export function mimeForImageFormat(fmt?: string): string | undefined {
  if (!fmt) return undefined;
  const f = fmt.toLowerCase();
  if (f === 'jpg') return 'image/jpeg';
  if (f === 'jpeg') return 'image/jpeg';
  if (f === 'png') return 'image/png';
  if (f === 'webp') return 'image/webp';
  if (f === 'avif') return 'image/avif';
  return `image/${f}`;
}

export function applyImageFormat(
  pipeline: Sharp,
  format: ImageOutputFormat,
  quality?: number,
): Sharp {
  const q = typeof quality === 'number' ? quality : undefined;
  switch (format) {
    case 'png':
      return pipeline.png();
    case 'webp':
      return pipeline.webp(q ? { quality: q } : undefined);
    case 'avif':
      return pipeline.avif(q ? { quality: q } : undefined);
    case 'jpeg':
    default:
      return pipeline.jpeg(q ? { quality: q } : undefined);
  }
}
