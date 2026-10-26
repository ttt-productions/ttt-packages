# Adopt @ttt-productions/query-core 0.14.27

**What:** Test builders ship for every read, infinite-read, paginated-read, and mutation state, with one shared provider wrapper for hook tests; a subscribe-mode batch lookup re-opens a denied listener on the standard backoff.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/query-core` 0.14.27.
- **Release:** `./scripts/release-multiple.sh dev-standards firebase-helpers media-processing-core moderation-core monitoring-core notification-core query-core repo-guards ttt-core upload-core patch`.
- **What changed:**
  - New entry `./react/testing`, each builder a real TanStack observer result carrying the `retryState` `useReadRetryState` would derive: the reads `answeredRead`, `idleRead`, `loadingRead`, `failedRead`, `retryingRead`, `fetchingRead`, `answeredThenFailedRead`, `retryingAnsweredRead`; the infinite reads `infiniteRead`, `loadingInfiniteRead`, `failedInfiniteRead`, `retryingInfiniteRead`, `fetchingInfiniteRead`, `answeredThenFailedInfiniteRead`, `retryingAnsweredInfiniteRead`, `fetchingNextPageRead`, `nextPageFailedRead`, `retryingNextPageRead`; the paginated reads `answeredPaginatedRead`, `loadingPaginatedRead`, `failedPaginatedRead`, `retryingPaginatedRead`, `fetchingPaginatedRead`, `answeredThenFailedPaginatedRead`, `retryingAnsweredPaginatedRead`; the mutations `idleMutation`, `pendingMutation`, `idleSessionMutation`, `pendingSessionMutation`; and `firestoreTestWrapper(db, { queryClient? })` → `{ queryClient, Wrapper }` (a `QueryClientProvider` around a `FirestoreProvider`; its default client, `testQueryClient()`, never retries a read and never collects a cached one during a case).
  - `useBatchFirestoreDocs` in subscribe mode: a listener that ends `permission-denied` is re-opened on `RESUBSCRIBE_DELAYS_MS`, the backoff `useFirestoreDoc` uses; the id reads `failed` meanwhile, and the re-opened listener's first snapshot answers it. Any other listener error still stands until the listener's last subscriber leaves.
  - `useReadRetryState` behaves exactly as before; `ReadRetrySource` and `ReadRetryState` are still exported from `./react`.
- **What the app must change:** Install. A test that hand-builds a query result or a `retryState` moves onto the builders, and a hook test's local `QueryClientProvider` + `FirestoreProvider` wrapper onto `firestoreTestWrapper`. A subscribe-mode lookup on a collection whose reads can be denied and then granted now recovers on its own; no code change is needed for it.
- **Done when:** The lockfiles name `@ttt-productions/query-core` 0.14.27 or later, and the gate is green.
