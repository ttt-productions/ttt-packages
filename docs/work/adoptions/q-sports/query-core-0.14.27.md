# Adopt @ttt-productions/query-core 0.14.27

**What:** Test builders ship for every read, infinite-read, and mutation state, each a real TanStack observer result with the retry state the read retry hook would derive.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/query-core` 0.14.27.
- **Release:** `./scripts/release-multiple.sh firebase-helpers media-processing-core monitoring-core query-core repo-guards ttt-core upload-core patch`.
- **What changed:** New entry `./react/testing`: `answeredRead`, `idleRead`, `loadingRead`, `failedRead`, `retryingRead`, `fetchingRead`, `answeredThenFailedRead`, `retryingAnsweredRead`, the infinite builders (`infiniteRead`, `loadingInfiniteRead`, `failedInfiniteRead`, `fetchingNextPageRead`, `nextPageFailedRead`), the paginated builders (`answeredPaginatedRead`, `loadingPaginatedRead`, `failedPaginatedRead`, `retryingPaginatedRead`, `answeredThenFailedPaginatedRead`), and `idleMutation`, `pendingMutation`, `idleSessionMutation`, `pendingSessionMutation`. `useReadRetryState` behaves exactly as before; `ReadRetrySource` and `ReadRetryState` are still exported from `./react`.
- **What the app must change:** Install only. A test that hand-builds a query result or a `retryState` can move onto the builders.
- **Done when:** The lockfiles name `@ttt-productions/query-core` 0.14.27 or later, and the gate is green.
