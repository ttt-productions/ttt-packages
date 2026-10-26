# Adopt @ttt-productions/query-core 0.14.28

**What:** The mutation test builders carry a hook's `onMutate` result and error types and build a failed mutation; an idle infinite read builder.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/query-core` 0.14.28.
- **Release:** `./scripts/release-multiple.sh query-core firebase-helpers repo-guards dev-standards patch`.
- **What changed (`./react/testing`, additive):**
  - `idleMutation`, `pendingMutation`, `idleSessionMutation`, `pendingSessionMutation` are typed `<TData, TVariables, TOnMutateResult = unknown, TError = Error>`, so one stands in for a hook whose `onMutate` returns a result or whose error is not an `Error`. Existing two-argument calls are unchanged.
  - `failedMutation(error, variables, handlers?)` and `failedSessionMutation(…)` (both awaited) build a mutation that failed with the case's error, from a real mutation run.
  - `sessionMutationContext(uid)` is a current session's callback context, for a case's `mutate` handler that calls the component's `onSuccess` / `onError`.
  - `idleInfiniteRead(spec)` is a disabled infinite read that never fetched.
- **What the app must change:** Install `@ttt-productions/query-core@latest` wherever it is declared. Any hand-built mutation double that exists only because the builders could not carry an `onMutate` result type, an error type, or a failed state can move onto the builders.
- **Done when:** The lockfiles name `@ttt-productions/query-core` 0.14.28 or later and the gate is green.
