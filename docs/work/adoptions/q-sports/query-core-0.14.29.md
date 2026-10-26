# Adopt @ttt-productions/query-core 0.14.29

**What:** The infinite-read test builders hand a case's `getNextPageParam` TanStack's full arguments, and build a refresh retry paused offline; every built retry state counts a paused fetch as retrying.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/query-core` 0.14.29.
- **Release:** `./scripts/release-multiple.sh dev-standards query-core repo-guards patch`.
- **What changed:** `InfiniteReadSpec.getNextPageParam` in `./react/testing` is typed
  `(lastPage, allPages, lastPageParam, allPageParams)`, as TanStack calls it. The builders derive each
  page's param by calling it with the previous page param and every param so far. A two-argument
  function still fits, so no existing test changes.
  - New `pausedRetryingAnsweredInfiniteRead(spec, error)`: a refresh retry over loaded pages waiting for
    the network (`fetchStatus: 'paused'`, the failure kept), its `retryState` retrying.
  - Every builder's `retryState` now reads the result's `isPaused`, as the real read retry state does.
    No existing builder builds a paused state, so no existing value changes.
- **What the app must change:** only the install. A test that hand-builds a paused refresh retry moves onto `pausedRetryingAnsweredInfiniteRead`. Any infinite-read spec that wraps a hook's
  `getNextPageParam` to drop its third argument now passes the hook's own function instead.
- **Done when:** The lockfiles name `@ttt-productions/query-core` 0.14.29 or later, no infinite-read
  spec wraps a hook's cursor function, and the app's suite is green.
