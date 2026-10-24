# Adopt @ttt-productions/realtime-core 0.1.6

**What:** zod floor raised for a security advisory.
**Severity:** medium
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/realtime-core` 0.1.6.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:** Its zod dependency floor rose to `^4.6.7` (GHSA-mrhx-c7xc-m3w5 affects zod below 4.6.6).
- **What the app must change:** Install. Raise the app's own `zod` floor to `^4.6.7` wherever it declares zod.
- **Done when:** The lockfiles name `@ttt-productions/realtime-core` 0.1.6 or later, and the gate is green.
