# Adopt @ttt-productions/monitoring-core 0.13.15

**What:** `withScope` is typed.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/monitoring-core` 0.13.15.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:** `withScope(fn)` is `<T>(fn: (scope: ScopeLike) => T) => T`, and `SentrySdkLike.withScope`'s callback scope is `ScopeLike`, no longer `any`.
- **What the app must change:** Install. A caller that used scope methods outside `ScopeLike` gets a type error; use the `ScopeLike` methods.
- **Done when:** The lockfiles name `@ttt-productions/monitoring-core` 0.13.15 or later, and the gate is green.
