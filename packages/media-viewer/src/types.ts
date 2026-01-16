import type { SimplifiedMediaType } from "@ttt-productions/media-contracts";

export type MediaViewerType = SimplifiedMediaType | "pdf";

export type MediaViewerFallbackMode = "link" | "none";

export interface MediaViewerBaseProps {
  url: string;

  /** Optional explicit type; otherwise inferred from mime/name/url. */
  type?: MediaViewerType;

  /** Optional hints for inference. */
  mime?: string;
  name?: string;

  /** Wrapper class */
  className?: string;

  /** Media element class */
  mediaClassName?: string;

  /** For images */
  alt?: string;

  /** For link fallback */
  filename?: string;

  /** Called when the underlying media element errors. */
  onError?: (error: unknown) => void;

  /** Generic fallback behavior when type is unknown or render fails. */
  fallbackMode?: MediaViewerFallbackMode;

  /** Link label override */
  fallbackLabel?: string;

  poster?: string;
}
