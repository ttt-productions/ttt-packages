# Adopt @ttt-productions/media-viewer 0.10.24

**What:** MediaPreview tells the app when a picture's spot is in view and which stored size its drawn width needs; the unavailable screen has no Retry.
**Severity:** medium

- **Package and version:** `@ttt-productions/media-viewer` 0.10.24.
- **Release:** `./scripts/release-multiple.sh auth-core q-core media-viewer repo-guards dev-standards patch`.
- **What changed:**
  - `MediaPreviewProps` gains `sizes` (each a `key` and its pixel `width`) and
    `onSizeWanted(key)`. While no file is in hand, `MediaPreview` watches its own box and, once it
    is in view (at once for `priority`), asks for the smallest size at least as wide as the box is
    drawn, counting pixel density up to 2×; a box drawn wider later asks for the next size up, never
    down. Root: `MediaSizeOption`, `mediaSizeNeed`, `pickMediaSize`, `MEDIA_SIZE_MAX_DENSITY`.
  - The recovery overlay's retry is optional; the hard-unavailable screen draws no Retry.
- **What the app must change:** Install. ttt-prod's item
  `docs/work/waiting-to-be-implemented/pictures-download-only-what-shows.md` adopts `sizes` /
  `onSizeWanted` under RULE-STD-MEDIA-103 (dev-standards 0.0.34).
- **Done when:** the lockfiles name `@ttt-productions/media-viewer` 0.10.24 or later.
