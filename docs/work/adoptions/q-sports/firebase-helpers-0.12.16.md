# Adopt @ttt-productions/firebase-helpers 0.12.16

**What:** BREAKING: `createCallables` moves to query-core `./react`.
**Severity:** high
**Came from:** the ttt-packages shared-standards run (Phase 3 package batch)

- **Package and version:** `@ttt-productions/firebase-helpers` 0.12.16.
- **Release:** `./scripts/release-multiple.sh dev-standards firebase-helpers repo-guards query-core chat-schemas report-core notification-core ttt-core upload-ui chat-core chat-react patch`.
- **What changed:** BREAKING: `createCallables`, `MAX_RESUMABLE_CALLS` and their types leave `firebase-helpers/react`; they live in `@ttt-productions/query-core/react`, built on its session-aware mutation owner. `./client` keeps `callCallable` and now exports `isRecoveredFallbackReport`. The `@tanstack/react-query` peer is dropped.
- **What the app must change:** Install `@ttt-productions/firebase-helpers@latest` together with query-core, and import `createCallables` and its types from `@ttt-productions/query-core/react` (query-core's adoption file).
- **Done when:** The lockfiles name `@ttt-productions/firebase-helpers` 0.12.16 or later, nothing imports `createCallables` from firebase-helpers, and the gate is green.
