# @ttt-productions/media-viewer

Generic media display package.

## Owns

- Image, video, and audio viewer components
- Fallback display behavior for unsupported or missing media
- Media-kind routing using generic media types from `media-schemas`
- Bounded media-recovery state machine (loading → retry → fallback)

## Boundary

The package does not own upload, moderation, or TTT-specific media origins. It does not know about Cloudflare Workers, `x-ttt-deny` headers, Firebase session cookies, or any TTT business concept. All domain-specific behavior is injected via a `MediaDiagnosticAdapter`.

## Sizing contract — the parent owns the size

`MediaPreview` / `MediaViewer` **fill their parent**: the wrapper and the inner media element carry inline `width: 100%; height: 100%` (with `max-width/max-height: 100%` on the element). Consequences for consumers:

- The component always expands to its containing box. To bound it, the **call site must own the size** — wrap it in a container with definite/max dimensions (and `overflow: hidden` where clipping is intended).
- Because inline styles win over classes, `width`/`height` utilities passed via `className` are ignored; only `max-*` utilities take effect, and only reliably on the wrapper. Passing sizing classes instead of providing a sized parent is a consumer bug.
- This fill-the-slot behavior is deliberate (feed cells, cover slots, thumbnails all size the slot, not the media). A surface that has no natural slot (admin/detail panes) must introduce one.

---

## Recovery state machine

When a media element (image/video/audio) fails to load for an asset that the app believes is live, the package runs a bounded recovery cycle driven by an injected diagnostic adapter. The app provides the probe and refresh logic; the package owns the mechanics.

### Diagnostic adapter interface

```ts
import type { MediaDiagnosticAdapter, DiagnosisResult, AssetStatusHint } from "@ttt-productions/media-viewer";

interface MediaDiagnosticAdapter {
  /**
   * Issue a credentialed probe against the URL. Must never throw.
   * Return { kind: "transient" } on network errors.
   */
  probe?: (url: string) => Promise<DiagnosisResult>;

  /** Refresh the media session (called at most once per recovery cycle). */
  refreshSession?: () => Promise<void>;

  /** Refresh a scoped grant for the given URL (called at most once). */
  refreshGrant?: (url: string) => Promise<void>;
}

type DiagnosisResult =
  | { kind: "transient" }   // 404 no-record, 503 authority-unavailable, network err
  | { kind: "auth" }        // 401/403 — refresh session/grant once
  | { kind: "hard" };       // blocked, rejected, no-variant, no-object — no retry
```

### Asset status hint

An optional `AssetStatusHint` lets the app communicate the server-side lifecycle state. When provided, it prevents spurious probes for assets that are still processing:

```ts
type AssetStatusHint =
  | "processing"   // moderation/transcode running — show skeleton, no probe
  | "finalizing"   // activating/publishing — show spinner, no probe
  | "live"         // published and expected to be servable — recovery applies
  | "failed"       // terminal processing failure — immediate hard error
  | "rejected";    // moderation rejection — immediate hard error
```

### Recovery states

| Phase | Description |
|---|---|
| `idle` | No error yet |
| `loading` | Remount in progress (after manual retry) |
| `processing` | App hint: still processing — show skeleton |
| `finalizing` | App hint: activating/publishing — show spinner |
| `loaded` | Element load/decode event fired successfully |
| `transient-retry` | Waiting for next backoff step (includes `attempt` + `nextRetryMs`) |
| `auth-retry` | Refreshing session/grant (happens at most once) |
| `hard-unavailable` | No retry — blocked, rejected, auth exhausted (includes optional `reason`) |
| `max-wait-fallback` | ~120 s budget exhausted — show manual Retry button |

### Backoff schedule

```
2 s → 5 s → 10 s → 20 s → 30 s → 30 s  (then capped at 30 s)
```

Each delay has ±20% jitter. Retries pause while the element is off-screen (IntersectionObserver) or the document is hidden (visibilitychange). Budget resets on manual retry.

### Per-asset dedup

Multiple instances of the same asset URL on-screen share one recovery cycle. The first instance to error becomes the "leader" and drives probes; all other instances receive the same state broadcasts. This prevents thundering-herd probes when the same thumbnail appears in many list items.

---

## Usage

### MediaPreview / MediaViewer with recovery (additive props)

```tsx
import { MediaPreview } from "@ttt-productions/media-viewer/react";
import type { MediaDiagnosticAdapter } from "@ttt-productions/media-viewer";

// App implements the adapter; package remains generic.
const tttAdapter: MediaDiagnosticAdapter = {
  probe: async (url) => {
    try {
      const res = await fetch(url, { method: "HEAD", credentials: "include", cache: "no-store" });
      const deny = res.headers.get("x-ttt-deny");
      if (res.status === 401 || res.status === 403) return { kind: "auth" };
      if (deny && ["blocked", "not-servable", "no-variant", "no-object"].includes(deny))
        return { kind: "hard" };
      return { kind: "transient" };
    } catch {
      return { kind: "transient" };
    }
  },
  refreshSession: async () => { /* re-mint media-session cookie */ },
  refreshGrant: async (url) => { /* re-fetch scoped grant for url */ },
};

<MediaPreview
  url={buildMediaAssetUrl(assetId, "thumb")}
  type="image"
  recoveryAdapter={tttAdapter}
  assetStatusHint={publicationState === "live" ? "live" : "finalizing"}
/>
```

The `recoveryAdapter` and `assetStatusHint` props are **additive and optional**. When omitted, `MediaPreview` behaves exactly as before (load error → static `ErrorFallback`).

### useMediaRecovery hook (advanced)

For custom media rendering outside `MediaPreview`:

```tsx
import { useMediaRecovery } from "@ttt-productions/media-viewer/react";

const { recoveryState, onMediaError, onMediaLoad, manualRetry } = useMediaRecovery({
  url: mediaUrl,
  adapter: tttAdapter,
  statusHint: "live",
  onRemount: () => setRemountKey(k => k + 1),
});
```

Wire `onMediaError` / `onMediaLoad` to the element's `onError` / `onLoad` (or `onLoadedData` for video/audio). Call `manualRetry` from a Retry button in `max-wait-fallback` state.

---

## Canonical audio player (AudioViewer / AudioPlayer / MediaPreview)

The package owns the single audio control surface used by every audio render: play/pause, seek, time readout, mute/volume, and a visualizer panel (oscilloscope `line` or frequency `bars`) with minimize and mode toggles — both persisted to localStorage. Browser-native audio controls are not exposed, so callers cannot accidentally render a different player.

```tsx
import { AudioPlayer } from "@ttt-productions/media-viewer/react";

<AudioPlayer
  url={audioUrl}
  visualizerMode="bars"            // initial mode; a persisted user choice wins
  persistKey="mv-audio-player"     // localStorage key base; null disables persistence
  extraActions={<InkItButton />}   // app-injected buttons at the end of the control row
/>
```

Equivalent forms: `<AudioViewer …/>`, or through the router as `<MediaPreview type="audio" audioVisualizerMode=… audioPersistKey=… audioExtraActions=… />`. All the Playback API props (below) work unchanged.

Mechanics: the Web Audio graph (`createMediaElementSource` → `AnalyserNode` → destination) is created lazily on the first `play` event (autoplay policies suspend fresh `AudioContext`s; a user-gesture play resumes them) and is best-effort — if it fails, playback still works and only the visualizer goes dark. The element source is once-per-element and keyed to the element instance. The draw loop runs only while playing. Requires same-origin (or CORS-clean) audio, or the analyser reads silence.

The shared render engine `startWaveformLoop({ analyser, getCanvas, mode })` (root export, no React) is the ONE waveform implementation — file-input's record dialog consumes it for the live-mic waveform. Chrome styling uses `.mv-player*` semantic classes (see styles) with token fallbacks.

## Playback API (VideoViewer / AudioViewer)

Additive, fully optional playback surface on `VideoViewer` and `AudioViewer`, forwarded by `MediaPreview` / `MediaViewer` for `type="video"` / `type="audio"`. Every field is optional; when all are absent the viewers behave exactly as before. It derives entirely from native media-element events — it adds **no** IntersectionObserver (MEDIA-102). Types are exported from the package root: `MediaPlaybackProps`, `MediaPlaybackControls`.

```tsx
import type { MediaPlaybackControls } from "@ttt-productions/media-viewer";
import { MediaPreview } from "@ttt-productions/media-viewer/react";

const controls = React.useRef<MediaPlaybackControls>(null);

<MediaPreview
  url={url}
  type="video"
  startAtSeconds={resumePosition}
  onEnded={() => advanceToNext()}
  onProgressSample={(t, dur) => persistPosition(t, dur)}
  endOverlay={<NextUpCard onReplay={() => controls.current?.restart()} />}
  playbackControlsRef={controls}
/>
```

| Prop | Contract |
|---|---|
| `onEnded?: () => void` | Fires on the native `ended` event (cursor at duration). With `loop` set, the browser restarts natively and emits **no** `ended` event, so `onEnded` never fires in loop mode. |
| `onProgressSample?: (currentTimeSeconds, durationSeconds) => void` | Periodic position reporting. While playing, fires at most once per `PROGRESS_SAMPLE_INTERVAL_MS` (~5 s) of playback (throttled off `timeupdate`). Also fires once immediately on **pause**, on **seek completion** (`seeked`), and on **ended** — each with the exact position. Never fires while paused (aside from the single pause-flush). `durationSeconds` is `0` until duration is known. |
| `startAtSeconds?: number` | Initial position, applied once the element has metadata (clamped to duration). **Survives the `unloadOnExit` unload/remount cycle:** once playback has started the viewer tracks the live position internally and resumes the remounted element from the LAST KNOWN position — it does not re-apply `startAtSeconds` and does not restart at 0. |
| `endOverlay?: React.ReactNode` | Rendered as an overlay covering the media area when the media has ended; removed when playback restarts (native replay or imperative `restart()`). Only mounted (and only intercepts pointer events) while shown, and layered above the element (`z-index: 2`). It is part of normal document flow, so on native-fullscreen **exit** it reappears over the inline element (it is not injected into the browser's fullscreen layer). |
| `playbackControlsRef?: React.Ref<MediaPlaybackControls>` | Imperative handle: `restart()` seeks to 0, clears the overlay, and plays; `seekTo(seconds)` seeks (clamped to `[0, duration]`). |

The `PROGRESS_SAMPLE_INTERVAL_MS` constant and a low-level `useMediaPlayback` hook (for custom video/audio rendering) are exported from `@ttt-productions/media-viewer/react`.

### Recovery UI classes

The built-in `MediaPreview` recovery overlay uses these CSS classes (all optional to style):

| Class | Phase |
|---|---|
| `.mv-recovery-processing` | processing |
| `.mv-recovery-finalizing` | finalizing |
| `.mv-recovery-retrying` | transient-retry |
| `.mv-recovery-auth` | auth-retry |
| `.mv-recovery-hard` | hard-unavailable |
| `.mv-recovery-max-wait` | max-wait-fallback |
| `.mv-recovery-retry-btn` | Manual Retry button |
| `.mv-recovery-label` | Text label inside any overlay |
