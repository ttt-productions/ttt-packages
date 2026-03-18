import type * as React from "react";

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
  onLoad?: () => void;
  onError?: () => void;
  onLoadChange?: (isLoading: boolean) => void;
  fallbackMode?: FallbackMode;
  fallbackLabel?: string;
  filename?: string;
  mime?: string;
  name?: string;
};

/** Back-compat alias */
export type MediaViewerProps = MediaPreviewProps;
