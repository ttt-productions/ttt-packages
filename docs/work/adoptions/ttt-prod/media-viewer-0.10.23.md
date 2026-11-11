# Adopt @ttt-productions/media-viewer 0.10.23

**What:** MediaPreview draws its own recovery screens from a download state the app hands it, and its Retry is ui-core's Button.
**Severity:** low

- **Package and version:** `@ttt-productions/media-viewer` 0.10.23.
- **Release:** `./scripts/release-multiple.sh auth-core ttt-core q-core media-viewer patch`.
- **What changed:** `MediaPreviewProps` gains `download?: MediaDownloadState` (`pending`,
  `unavailable`, `failed` with `retry` and `retrying`), for an app that fetches the file
  itself. The max-wait Retry button, in both the URL recovery path and the download path, is now
  ui-core's `Button` (outline, small, `pending` while a download retries); the
  `.mv-recovery-retry-btn` class is gone.
- **What the app must change:** Install. An app stylesheet rule on `.mv-recovery-retry-btn` is
  deleted if one exists. Nothing else changes for a caller that does not pass `download`.
- **Done when:** The lockfiles name `@ttt-productions/media-viewer` 0.10.23 or later and no app
  stylesheet names `.mv-recovery-retry-btn`.
