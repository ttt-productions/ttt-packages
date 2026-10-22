# Adopt @ttt-productions/report-core 0.16.22

**What:** Report queue and submit mutations are session-bound.
**Severity:** low
**Came from:** the ttt-packages shared-standards run (Phase 3 package batch)

- **Package and version:** `@ttt-productions/report-core` 0.16.22.
- **Release:** `./scripts/release-multiple.sh dev-standards firebase-helpers repo-guards query-core chat-schemas report-core notification-core ttt-core upload-ui chat-core chat-react patch`.
- **What changed:** The queue hooks and submit run on query-core's `useSessionMutation`: an answer that arrives after the session ended runs none of their callbacks or cache refreshes. The `@tanstack/react-query` peer floor is `>=5.90.0`. No API change.
- **What the app must change:** Install `@ttt-productions/report-core@latest` with query-core; the fence works once the app mounts `MutationSessionProvider` (query-core's adoption file).
- **Done when:** The lockfiles name `@ttt-productions/report-core` 0.16.22 or later and the gate is green.
