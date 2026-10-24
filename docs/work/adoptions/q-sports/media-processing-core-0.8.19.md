# Adopt @ttt-productions/media-processing-core 0.8.19

**What:** zod floor raised; failure paths typed.
**Severity:** medium
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/media-processing-core` 0.8.19.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:**
  - Its zod dependency floor rose to `^4.6.7` (GHSA-mrhx-c7xc-m3w5 affects zod below 4.6.6).
  - Internal typing: `catch` clauses typed without `any`, the R2 `duplex` option typed without a cast, ffprobe's JSON output read through a typed shape; no behaviour change.
  - Each temp-file cleanup that discards its failure carries its reason.
- **What the app must change:** Install. Raise the app's own `zod` floor to `^4.6.7` wherever it declares zod.
- **Done when:** The lockfiles name `@ttt-productions/media-processing-core` 0.8.19 or later, and the gate is green.
