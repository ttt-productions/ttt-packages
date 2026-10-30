export const PICTURE_ASPECT_KEYS = ['square', 'landscape', 'classic', 'banner'] as const;
export type PictureAspect = (typeof PICTURE_ASPECT_KEYS)[number];

export interface PictureAspectRatio {
  readonly width: number;
  readonly height: number;
}

export const PICTURE_ASPECT_RATIOS = {
  square: { width: 1, height: 1 },
  landscape: { width: 16, height: 9 },
  classic: { width: 4, height: 3 },
  banner: { width: 3, height: 1 },
} as const satisfies Record<PictureAspect, PictureAspectRatio>;

export function pictureAspectRatio(aspect: PictureAspect): number {
  const { width, height } = PICTURE_ASPECT_RATIOS[aspect];
  return width / height;
}
