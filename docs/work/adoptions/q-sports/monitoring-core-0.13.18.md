# Adopt @ttt-productions/monitoring-core 0.13.18

**What:** No API change; the Sentry adapters load the SDK with no cast.
**Severity:** low
**Came from:** the ttt-prod shared-standards Phase 3 repair session (sixth package release)

- **Package and version:** `@ttt-productions/monitoring-core` 0.13.18.
- **Release:** `./scripts/release-multiple.sh dev-standards monitoring-core repo-guards patch`.
- **What changed:** `SentryAdapter` and `importSentryNode` return the SDK's own `import()` result, which already fits `SentrySdkLike`; the `as Promise<unknown> as Promise<SentrySdkLike>` casts are gone. Behavior is unchanged.
- **What the app must change:** Install; nothing else changes.
- **Done when:** The lockfiles name 0.13.18 or later.
