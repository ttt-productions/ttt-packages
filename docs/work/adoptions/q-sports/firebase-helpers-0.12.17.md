# Adopt @ttt-productions/firebase-helpers 0.12.17

**What:** `./client` holds the one Firebase client setup; `./react` holds the consent-gated Analytics pieces.
**Severity:** high
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/firebase-helpers` 0.12.17.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:**
  - `initFirebaseClient(config, options)` now takes, every one optional: `requiredConfigKeys` (config validation), `persistentFirestoreCache` (multi-tab, never under emulators), `appCheck: { siteKey, debugToken }` (reCAPTCHA Enterprise, once per page, skipped under emulators without a debug token, a warning when the site key is missing), `authBootLookupGuard` (installed before Auth starts), `analyticsConfig`, and `emulatorPorts.storageHost`. The handles add `appCheck`, `whenAppCheckReady()` (the first-token wait, fail-open) and `analytics` (a consent-gated handle: `get`, `enable`, `setCollectionEnabled`, `subscribe`). `getFirebaseClient()` / `tryGetFirebaseClient()` read the handles.
  - `./client` also exports `awaitFirstToken`, `installAuthBootLookupGuard`, `runGuardedBootLookup`, `classifyBootLookupFailure` and `getLastBootLookupFailureClass`, and names each export (no `export *`).
  - `./react` adds `useFirebaseAnalyticsHandle`, `useFirebaseAnalyticsEvents`, `FirebaseAnalyticsPageViews` and `FirebaseAnalyticsIdentity`.
  - Internal typing: `stripUndefinedDeep` maps arrays without an `any`; no behaviour change.
  - Design: ttt-packages `docs/packages/firebase-helpers.md` § The Firebase client setup.
- **What the app must change:** Install. Where Q-Sports builds its own Firebase client (app init, App Check, Firestore cache, Analytics, emulator wiring, getters), replace it with `initFirebaseClient` given its own values, keep its module as the thin reader of its env, and move consent-gated Analytics onto the handle and the `./react` pieces. Its tests of the moved code go; a test of its wiring stays.
- **Done when:** The lockfiles name `@ttt-productions/firebase-helpers` 0.12.17 or later and the app holds no second client setup, and the gate is green.
