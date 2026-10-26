# Adopt @ttt-productions/upload-core 0.7.10

**What:** A resumable upload classifies only the failures the Storage SDK can deliver; no API change.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/upload-core` 0.7.10.
- **Release:** `./scripts/release-multiple.sh firebase-helpers media-processing-core monitoring-core query-core repo-guards ttt-core upload-core patch`.
- **What changed:** `startResumableUpload`'s failure handler no longer treats a `DOMException` `AbortError` from the upload task as a cancel: the SDK only ever reports a `StorageError` there. A cancel is still `storage/canceled` after this upload asked for it (its signal aborted or `cancel()` was called), and becomes the `AbortError` consumers treat as a user cancel. Behavior for everything the SDK can deliver is unchanged.
- **What the app must change:** Install; nothing else changes.
- **Done when:** The lockfiles name 0.7.10 or later.
