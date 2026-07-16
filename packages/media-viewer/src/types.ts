import type * as React from "react";
import type { MediaDiagnosticAdapter, AssetStatusHint } from "./recovery.js";
import type { AudioVisualizerMode } from "./visualizer.js";

export type { MediaDiagnosticAdapter, AssetStatusHint, DiagnosisResult, RecoveryState } from "./recovery.js";
export type { AudioVisualizerMode } from "./visualizer.js";

export type MediaViewerType = "image" | "video" | "audio" | "other";
export type FallbackMode = "none" | "link";

/**
 * Imperative playback controls, exposed via the `playbackControlsRef` prop on
 * `VideoViewer` / `AudioViewer` (and forwarded by `MediaPreview` for
 * video/audio). Obtain via `React.useRef<MediaPlaybackControls>(null)`.
 */
export type MediaPlaybackControls = {
  /** Seek to 0 and play from the start. Clears any end-overlay. */
  restart(): void;
  /** Seek to the given position (seconds), clamped to [0, duration]. */
  seekTo(seconds: number): void;
};

/**
 * Additive, fully optional playback API shared by `VideoViewer` and
 * `AudioViewer`. Every field is optional; when all are absent the viewers
 * behave exactly as before.
 */
export type MediaPlaybackProps = {
  /**
   * Fires when the media element ends (native `ended` event) with the play
   * cursor at duration. NOTE: when `loop` is set the browser restarts natively
   * and emits no `ended` event, so `onEnded` never fires in that mode.
   */
  onEnded?: () => void;

  /**
   * Periodic playback-position reporting. Contract:
   * - While playing, fires at most once every ~5 seconds of playback
   *   (throttled off `timeupdate`).
   * - Fires once immediately on pause, on seek completion (`seeked`), and on
   *   ended — each carrying the exact position at that moment.
   * - Never fires while paused (aside from the single pause-flush above).
   * `durationSeconds` is `0` until the element's duration is known.
   */
  onProgressSample?: (currentTimeSeconds: number, durationSeconds: number) => void;

  /**
   * Initial playback position (seconds), applied once the element has metadata.
   * Survives the `unloadOnExit` unload/remount cycle: once playback has started
   * the viewer tracks the live position internally and resumes from the LAST
   * KNOWN position on remount — it does not re-apply this prop and does not
   * restart at 0.
   */
  startAtSeconds?: number;

  /**
   * Rendered as an overlay covering the media area when the media has ended.
   * Removed when playback restarts (native replay or imperative `restart()`).
   * The overlay only intercepts pointer events while shown and renders above
   * the element. In a native-fullscreen exit state the overlay reappears over
   * the inline element (it is part of normal document flow, not the fullscreen
   * layer).
   */
  endOverlay?: React.ReactNode;

  /** Imperative controls handle — see {@link MediaPlaybackControls}. */
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
  fallback?: React.ReactNode;
  /**
   * Load-watchdog budget in ms (default LOAD_WATCHDOG_MS). A visible, loading
   * element that produces neither a load/metadata nor an error event within
   * this budget synthesizes an error so the asset resolves to a bounded
   * terminal state instead of an eternal skeleton. `0` disables.
   */
  loadTimeoutMs?: number;
};

export type ImageViewerProps = BaseMediaProps & {
  alt?: string;
  enableZoom?: boolean;
  unloadOnExit?: boolean;
  isCircular?: boolean;
  preventGestures?: boolean;
};

export type VideoViewerProps = BaseMediaProps & MediaPlaybackProps & {
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

export type AudioViewerProps = BaseMediaProps & MediaPlaybackProps & {
  autoPlay?: boolean;
  loop?: boolean;
  preload?: "auto" | "metadata" | "none";
  onLoadChange?: (isLoading: boolean) => void;

  // AudioViewer always uses the package-owned control surface. Native browser
  // audio controls are intentionally not part of the public contract.
  /** Initial visualizer mode ("line" oscilloscope | "bars" EQ). A persisted user choice wins. */
  visualizerMode?: AudioVisualizerMode;
  /** localStorage key base for the minimize/mode prefs. `null` disables persistence. */
  persistKey?: string | null;
  /** App-injected action buttons rendered at the end of the player control row. */
  extraActions?: React.ReactNode;
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
  /** Video controls only. Audio always renders the canonical package-owned controls. */
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

  // -------------------------------------------------------------------------
  // Playback API (additive, optional) — forwarded to the video/audio viewer.
  // Ignored for image/other types. See MediaPlaybackProps for the contract.
  // -------------------------------------------------------------------------
  onEnded?: MediaPlaybackProps["onEnded"];
  onProgressSample?: MediaPlaybackProps["onProgressSample"];
  startAtSeconds?: MediaPlaybackProps["startAtSeconds"];
  endOverlay?: MediaPlaybackProps["endOverlay"];
  playbackControlsRef?: MediaPlaybackProps["playbackControlsRef"];

  // Audio always uses the package-owned player. These props customize that
  // single control surface and are ignored for every other media type.
  audioVisualizerMode?: AudioVisualizerMode;
  audioPersistKey?: string | null;
  audioExtraActions?: React.ReactNode;

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

  /** Load-watchdog budget forwarded to the underlying viewer — see BaseMediaProps. */
  loadTimeoutMs?: number;
};

/** Back-compat alias */
export type MediaViewerProps = MediaPreviewProps;
