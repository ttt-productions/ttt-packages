# A guard against hand-written read retry state in tests

**What:** A repo-guards check that fails a test which writes a read's `retryState` as an object literal instead of taking it from query-core's read builders or the real hook.
**Severity:** low
**Came from:** the shared-standards Phase 3 repair session (ttt-prod scope), after the last callers of ttt-prod's `withRetryState` test helper moved onto the query-core builders
**Trigger:** after launch, when DJ turns to improving the test code

This is a write-up of the item as it is known now, not a finished design.

## The gap

query-core's read builders (`answeredRead`, `failedRead`, `retryingRead`, the infinite set, …)
derive a read's `retryState` the same way the real hooks do, so a test gets only states a real read
can reach. A hand literal (`retryState: { error, isRetrying, isLoading }`) can pick a combination
no real read produces. The type checker accepts it, because the literal has the right shape. ttt-prod
deleted its `withRetryState` helper, which manufactured such literals, and moved its callers onto the
builders. The literal form can still come back, and today only review catches it. Last seen in ttt-prod's
`src/__tests__/components/admin-dispatches-section.test.tsx` and the non-colocated
`src/__tests__/components/admin/safety-case-console-view.test.tsx`, both moved onto the builders in
the repair session.

## Fix shape (not decided)

An AST check over test files: a `retryState` property whose value is an object literal fails. A
value taken from a builder or a real hook result (`failedRead(e).retryState`, `profile.retryState`)
passes. The read-retry derivation's own tests and the failure-seat component's tests are reviewed
entries, since they exercise the shape itself. A generic repo-guards check (packages-side), adopted
by each app through its guard config.

The same check can cover the other way a test builds a read by hand: it constructs a
`QueryObserver` / `InfiniteQueryObserver` itself, or seeds one with `getQueryCache().build(…)
.setState(…)`, outside query-core's testing kit. That is what the non-colocated safety-console test
did before the repair. `QueryClient` itself stays allowed: tests use it for wrappers and spies.

## Done when

The check is in repo-guards with its own tests, each app registers it, and every literal it flags
is moved onto a builder or carries a reviewed entry DJ approved.
