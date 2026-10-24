# Adopt @ttt-productions/upload-core 0.7.9

**What:** A queued upload's controller has no task until it starts.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/upload-core` 0.7.9.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:** `UploadController.task` is `UploadTask | null`: a queued upload's controller carries `null` until its upload starts (it always did at runtime; the type said otherwise).
- **What the app must change:** Install. Null-check any read of `controller.task`.
- **Done when:** The lockfiles name `@ttt-productions/upload-core` 0.7.9 or later, and the gate is green.
