# Adopt @ttt-productions/file-input 0.11.21

**What:** The selected-file label in `FileInput` and `MediaInput` clips through ui-core's `ClippedText`.
**Severity:** low

- **Package and version:** `@ttt-productions/file-input` 0.11.21.
- **Release:** `./scripts/release-multiple.sh dev-standards storage-core firebase-helpers
  ui-core repo-guards theme-core consent-core query-core app-config-core notification-core
  sweep-core auth-core q-core media-viewer file-input upload-core patch`.
- **What changed:** the "Image selected" / "Audio selected" label beside the clear button, in both
  `FileInput` and `MediaInput`, renders through `ClippedText` instead of a hand-placed Tailwind
  `truncate`: one line with an ellipsis, the whole label as its title. Nothing else changes.
- **What the app must change:** the install, with ui-core 0.11.44 or later (the first with `ClippedText`).
- **Done when:** the lockfile names `@ttt-productions/file-input` 0.11.21 or later.
