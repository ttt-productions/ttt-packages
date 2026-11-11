# Adopt @ttt-productions/upload-core 0.7.11

**What:** upload-core's unused local-storage upload-session adapter is gone.
**Severity:** low

- **Package and version:** `@ttt-productions/upload-core` 0.7.11.
- **Release:** `./scripts/release-multiple.sh dev-standards storage-core firebase-helpers
  ui-core repo-guards theme-core consent-core query-core app-config-core notification-core
  sweep-core auth-core q-core media-viewer file-input upload-core patch`.
- **What changed:** `createLocalStorageUploadSessionPersistence` is removed from `./browser`. Upload
  session persistence stays an adapter the app supplies through `setUploadSessionPersistence`
  (`docs/packages/upload-core.md`).
- **What the app must change:** the install. ttt-prod does not call the removed adapter.
- **Done when:** the lockfile names `@ttt-productions/upload-core` 0.7.11 or later.
