# Adopt @ttt-productions/media-schemas 0.14.13

**What:** zod floor raised; the claim builder's type is pinned by a type test.
**Severity:** medium
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/media-schemas` 0.14.13.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:**
  - Its zod dependency floor rose to `^4.6.7` (GHSA-mrhx-c7xc-m3w5 affects zod below 4.6.6).
  - `decidePendingMediaClaim` keeps its one cast with a constraint comment and a type test; no API change.
- **What the app must change:** Install. Raise the app's own `zod` floor to `^4.6.7` wherever it declares zod.
- **Done when:** The lockfiles name `@ttt-productions/media-schemas` 0.14.13 or later, and the gate is green.
