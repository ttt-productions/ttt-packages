import type * as React from 'react';
import type { MediaDiagnosticAdapter, AssetStatusHint } from '../recovery.js';
import type { AudioVisualizerMode } from '../visualizer.js';
import type {
  MediaViewerType,
  FallbackMode,
  MediaPlaybackControls,
  MediaProgressSampleReason,
} from '../types.js';

export type MediaPlaybackProps = {
  /** With `loop` set the browser restarts natively and emits no `ended` event, so `onEnded` never fires. */
  onEnded?: () => void;

  onProgressSample?: (
    currentTimeSeconds: number,
    durationSeconds: number,
    reason: MediaProgressSampleReason,
  ) => void;

  startAtSeconds?: number;

  endOverlay?: React.ReactNode;

  playbackControlsRef?: React.Ref<MediaPlaybackControls>;
};

export type BaseMediaProps = {
  url: string;
  className?: string;
  mediaClassName?: string;
  lazy?: boolean;
  priority?: boolean;
  skeleton?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  onVisibilityChange?: (visible: boolean) => void;
  fallback?: React.ReactNode;
  loadTimeoutMs?: number;
};

export type ImageViewerProps = BaseMediaProps & {
  alt?: string;
  enableZoom?: boolean;
  unloadOnExit?: boolean;
  isCircular?: boolean;
  preventGestures?: boolean;
};

export type VideoViewerProps = BaseMediaProps &
  MediaPlaybackProps & {
    controls?: boolean;
    autoPlay?: boolean;
    muted?: boolean;
    loop?: boolean;
    posterUrl?: string;
    enableFullscreen?: boolean;
    unloadOnExit?: boolean;
    preload?: 'auto' | 'metadata' | 'none';
    autoPlayOnVisible?: boolean;
  };

export type AudioViewerProps = BaseMediaProps &
  MediaPlaybackProps & {
    autoPlay?: boolean;
    loop?: boolean;
    preload?: 'auto' | 'metadata' | 'none';
    onLoadChange?: (isLoading: boolean) => void;

    visualizerMode?: AudioVisualizerMode;
    persistKey?: string | null;
    extraActions?: React.ReactNode;
    /** Web Audio hears only silence from a cross-origin file fetched without CORS, so the visualizer needs this set for one. */
    crossOrigin?: 'anonymous' | 'use-credentials';
  };

export type MediaPreviewProps = {
  url?: string | File | Blob | null;
  urlPending?: boolean;
  alt?: string;
  type?: MediaViewerType | string;
  className?: string;
  unloadOnExit?: boolean;
  isCircular?: boolean;
  enableZoom?: ImageViewerProps['enableZoom'];
  priority?: boolean;
  skeleton?: boolean;
  lazy?: boolean;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  posterUrl?: string;
  preload?: 'auto' | 'metadata' | 'none';
  autoPlayOnVisible?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  onLoadChange?: (isLoading: boolean) => void;

  onEnded?: MediaPlaybackProps['onEnded'];
  onProgressSample?: MediaPlaybackProps['onProgressSample'];
  startAtSeconds?: MediaPlaybackProps['startAtSeconds'];
  endOverlay?: MediaPlaybackProps['endOverlay'];
  playbackControlsRef?: MediaPlaybackProps['playbackControlsRef'];

  audioVisualizerMode?: AudioVisualizerMode;
  audioPersistKey?: string | null;
  audioExtraActions?: React.ReactNode;
  audioCrossOrigin?: AudioViewerProps['crossOrigin'];

  fallbackMode?: FallbackMode;
  fallbackLabel?: string;
  filename?: string;
  mime?: string;
  name?: string;

  recoveryAdapter?: MediaDiagnosticAdapter;

  assetStatusHint?: AssetStatusHint;

  loadTimeoutMs?: number;
};
