# Adopt @ttt-productions/monitoring-core 0.13.16

**What:** The telemetry scrubber drops a null-input branch its types never allowed.
**Severity:** low
**Came from:** the ttt-prod shared-standards Phase 3 repair session (third package release)

- **Package and version:** `@ttt-productions/monitoring-core` 0.13.16.
- **Release:** `./scripts/release-multiple.sh audit-core chat-react chat-schemas dev-standards firebase-helpers media-processing-core media-viewer moderation-core monitoring-core notification-core q-core rate-limit-core repo-guards report-core ttt-core ui-core upload-ui patch`.
- **What changed:** `createTelemetryScrubber`'s hook and `redactEvent` no longer test for a `null` or non-object event: their types take an event object, and the monitoring SDK passes one.
- **What the app must change:** Install. A test that passed `null` through a cast is deleted.
- **Done when:** The lockfiles name 0.13.16 or later.
