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
 * Why a progress sample was emitted. `periodic` is a throttled position report
 * during playback and is safe for a consumer to coalesce or drop; the other
 * three mark an exact moment the user's position changed and should be
 * committed as-is.
 */
export type MediaProgressSampleReason = "periodic" | "pause" | "seeked" | "ended";
