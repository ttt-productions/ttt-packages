# Adopt @ttt-productions/moderation-core 0.8.5

**What:** A moderation check that could not run is reported apart from a flag.
**Severity:** high
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/moderation-core` 0.8.5.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:**
  - `MediaModerationResult` is a union: a checked result `{ checked: true, safe, reason?, scores }`, or a check that did not complete `{ checked: false, safe: false, reason: 'Content moderation check did not complete', scores }`.
  - `moderateImage` reports `checked: false` when SafeSearch returns no annotation; `moderateVideo` when the analysis returns no checked frames or carries an error. Before, both read as a flag (`safe: false`, "Content moderation check failed"). `safe` stays `false` on an unchecked result, so a consumer reading only `safe` still fails closed.
- **What the app must change:** Install. Wherever the app maps a moderation result to an upload outcome, map `checked: false` to its retryable failed-upload outcome (no content violation, no flag message, no appeal) before reading `safe`; test both paths for image and video.
- **Done when:** The lockfiles name `@ttt-productions/moderation-core` 0.8.5 or later, and the gate is green.
