import type * as React from "react";
import type { MediaDiagnosticAdapter, AssetStatusHint } from "./recovery.js";

export type { MediaDiagnosticAdapter, AssetStatusHint, DiagnosisResult, RecoveryState } from "./recovery.js";

export type MediaViewerType = "image" | "video" | "audio" | "other";
export type FallbackMode = "none" | "link";

export type BaseMediaProps = {
  url: string;
  className?: string;
  mediaClassName?: string;
  lazy?: boolean;
  priority?: boolean;
  skeleton?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  fallback?: React.ReactNode;
};

export type ImageViewerProps = BaseMediaProps & {
  alt?: string;
  enableZoom?: boolean;
  unloadOnExit?: boolean;
  isCircular?: boolean;
  preventGestures?: boolean;
};

export type VideoViewerProps = BaseMediaProps & {
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  posterUrl?: string;
  enableFullscreen?: boolean;
  unloadOnExit?: boolean;
  preload?: "auto" | "metadata" | "none";
  autoPlayOnVisible?: boolean;
};

export type AudioViewerProps = BaseMediaProps & {
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  preload?: "auto" | "metadata" | "none";
  onLoadChange?: (isLoading: boolean) => void;
};

export type MediaPreviewProps = {
  url?: string | File | Blob | null;
  alt?: string;
  type?: MediaViewerType | string;
  className?: string;
  unloadOnExit?: boolean;
  isCircular?: boolean;
  priority?: boolean;
  skeleton?: boolean;
  lazy?: boolean;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  posterUrl?: string;
  preload?: "auto" | "metadata" | "none";
  autoPlayOnVisible?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  onLoadChange?: (isLoading: boolean) => void;
  fallbackMode?: FallbackMode;
  fallbackLabel?: string;
  filename?: string;
  mime?: string;
  name?: string;

  // -------------------------------------------------------------------------
  // Recovery adapter (additive, optional — backward-compatible)
  // -------------------------------------------------------------------------
  /**
   * Injected diagnostic adapter. When provided, element load errors for
   * assets the app believes are live will trigger the bounded recovery state
   * machine. When omitted, the existing error fallback behavior is unchanged.
   */
  recoveryAdapter?: MediaDiagnosticAdapter;

  /**
   * Optional app hint about the server-side lifecycle state of the asset.
   * Drives which recovery phase is shown (e.g. processing → skeleton,
   * finalizing → spinner, failed/rejected → hard error immediately).
   */
  assetStatusHint?: AssetStatusHint;
};

/** Back-compat alias */
export type MediaViewerProps = MediaPreviewProps;
