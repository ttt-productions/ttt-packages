# Adopt @ttt-productions/consent-core 0.0.4

**What:** The consent store is built on storage-core's device-preference store; consent-core no longer declares theme-core.
**Severity:** low

- **Package and version:** `@ttt-productions/consent-core` 0.0.4.
- **Release:** `./scripts/release-multiple.sh dev-standards storage-core firebase-helpers
  ui-core repo-guards theme-core consent-core query-core app-config-core notification-core
  sweep-core auth-core q-core media-viewer file-input upload-core patch`.
- **What changed:** `createConsentStore` builds on `createDevicePreferenceStore` from
  `@ttt-productions/storage-core/react` instead of theme-core's. Its API, its stored values and its
  cross-tab behaviour are unchanged. The optional peer `@ttt-productions/theme-core` is replaced by
  `@ttt-productions/storage-core` (`docs/packages/consent-core.md`).
- **What the app must change:** the install, with `@ttt-productions/storage-core` 0.0.2 or later
  among ttt-prod's dependencies.
- **Done when:** the lockfile names `@ttt-productions/consent-core` 0.0.4 or later, and the cookie
  consent banner still records and applies a choice in every open tab.
