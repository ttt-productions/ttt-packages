import type { SimplifiedMediaType } from "@ttt-productions/media-contracts";
import type * as React from "react";

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

  /** Called when the underlying media element loads successfully. */
  onLoad?: (ev: unknown) => void;

  /** Accessible label for the underlying media element. */
  ariaLabel?: string;

  /** Show a simple loading indicator until the media is ready. Defaults to true. */
  showLoading?: boolean;

  /** Optional custom loading UI. */
  loadingFallback?: React.ReactNode;

  /** Optional retry label for transient failures. */
  retryLabel?: string;

  /** Generic fallback behavior when type is unknown or render fails. */
  fallbackMode?: MediaViewerFallbackMode;

  /** Link label override */
  fallbackLabel?: string;

  poster?: string;

  /** Optional captions/subtitle tracks for video. */
  tracks?: Array<{
    src: string;
    kind?: "subtitles" | "captions" | "descriptions" | "chapters" | "metadata";
    srcLang?: string;
    label?: string;
    default?: boolean;
  }>;

  /** Show a download/open link alongside the media. */
  showDownload?: boolean;
  downloadLabel?: string;

  /** Enable simple image zoom toggle (CSS scale). */
  enableImageZoom?: boolean;

  /** Enable fullscreen button (where supported). */
  enableFullscreen?: boolean;
}
