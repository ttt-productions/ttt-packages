export type MediaViewerType = "image" | "video" | "audio" | "other";
export type FallbackMode = "none" | "link";

export type MediaViewerProps = {
  /** If omitted, inferred from mime/name/url. */
  type?: MediaViewerType;

  /** Required media URL */
  url: string;

  /** Optional hints for inference */
  mime?: string;
  name?: string;

  /** Optional download filename (fallback link) */
  filename?: string;

  /** Wrapper class */
  className?: string;

  /** Media element class */
  mediaClassName?: string;

  /** Accessibility for images */
  alt?: string;

  /** Fallback rendering */
  fallbackMode?: FallbackMode;
  fallbackLabel?: string;

  /** Image */
  enableZoom?: boolean;

  /** Video */
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  posterUrl?: string;
  enableFullscreen?: boolean;

  /** Audio */
  // controls/autoPlay/loop reused
};
