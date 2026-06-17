# @ttt-productions/media-viewer

Generic media display package.

## Owns

- Image, video, and audio viewer components
- Fallback display behavior for unsupported or missing media
- Media-kind routing using generic media types from `media-schemas`
- Bounded media-recovery state machine (loading → retry → fallback)

## Boundary

The package does not own upload, moderation, or TTT-specific media origins. It does not know about Cloudflare Workers, `x-ttt-deny` headers, Firebase session cookies, or any TTT business concept. All domain-specific behavior is injected via a `MediaDiagnosticAdapter`.

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
