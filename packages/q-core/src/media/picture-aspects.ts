// The shapes a picture is cropped to. Every picture kind has one: the browser's crop, the server's
// processing, and every display of that kind all use it, from this one declaration, so a picture and
// the frame it is shown in can never disagree.

export const PICTURE_ASPECT_KEYS = ['square', 'landscape', 'classic', 'banner'] as const;
export type PictureAspect = (typeof PICTURE_ASPECT_KEYS)[number];

export interface PictureAspectRatio {
  readonly width: number;
  readonly height: number;
}

/** Each shape as whole numbers, width to height — the form a CSS `aspect-ratio` and "16:9" take. */
export const PICTURE_ASPECT_RATIOS = {
  square: { width: 1, height: 1 },
  landscape: { width: 16, height: 9 },
  classic: { width: 4, height: 3 },
  banner: { width: 3, height: 1 },
} as const satisfies Record<PictureAspect, PictureAspectRatio>;

/** The shape as one number, width over height — the form a crop or processing spec takes. */
export function pictureAspectRatio(aspect: PictureAspect): number {
  const { width, height } = PICTURE_ASPECT_RATIOS[aspect];
  return width / height;
}
