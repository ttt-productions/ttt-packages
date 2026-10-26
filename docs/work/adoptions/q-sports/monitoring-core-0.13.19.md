# Adopt @ttt-productions/monitoring-core 0.13.19

**What:** The browser Sentry SDK is named in one module, like the Node one; no API change.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/monitoring-core` 0.13.19.
- **Release:** `./scripts/release-multiple.sh dev-standards firebase-helpers media-processing-core moderation-core monitoring-core notification-core query-core repo-guards ttt-core upload-core patch`.
- **What changed:** `SentryAdapter` loads `@sentry/nextjs` through `adapters/sentry-browser-sdk` (`importSentryBrowser`), as `SentryNodeAdapter` loads `@sentry/node` through `adapters/sentry-node-sdk`. Nothing exported changed, and behavior is unchanged.
- **What the app must change:** Install; nothing else changes.
- **Done when:** The lockfiles name 0.13.19 or later.
