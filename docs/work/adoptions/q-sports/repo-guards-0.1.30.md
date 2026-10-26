# Adopt @ttt-productions/repo-guards 0.1.30

**What:** A new generic guard, `handBuiltReads`: no test builds a read's state by hand — no `retryState` / `ReadRetryState` literal, no result read off a query observer the test constructed, no query cache seeded with `setState`.
**Severity:** medium
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.30.
- **Release:** `./scripts/release-multiple.sh dev-standards query-core repo-guards patch`.
- **What changed:**
  - `generic.handBuiltReads` is a required fact: `{ reviewed }`, a list of anchored entries (`path`,
    `anchor`, `why`) in the same form as `blanketCasts`. The suite fails the config until it is there.
  - "no test builds a read's state by hand" reads test files in the app, functions, scripts and
    worker roots. It flags:
    - a `retryState` property whose value is an object literal;
    - a variable typed `ReadRetryState` initialized with an object literal;
    - `.getCurrentResult()` read off a `QueryObserver` / `InfiniteQueryObserver` the test constructed
      (chained, or through a variable whose nearest declaration is that construction), reported once,
      at the construction;
    - `getQueryCache().build(…).setState(…)`.

    An observer the test subscribes, watching a real query run, passes. A `retryState` taken from a
    builder or a real hook result passes.
  - A reviewed entry excuses exactly the one construct whose source text holds its anchor, and an
    entry that matches nothing is stale.
- **What the app must change:**
  - Declare `generic.handBuiltReads: { reviewed: [] }` in the guard config.
  - Move every read state the guard flags onto `@ttt-productions/query-core/react/testing`'s builders
    (0.14.29 adds `pausedRetryingAnsweredInfiniteRead`) or onto the real hook. A flagged state that no
    real read reaches is a case for the app owner to delete as unreachable.
  - Add a reviewed entry, with its why, only for a test whose subject is that shape itself.
- **Done when:** The guard config declares `handBuiltReads`, the lockfiles name
  `@ttt-productions/repo-guards` 0.1.30 or later, and the guard is green.
