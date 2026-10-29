# Adopt @ttt-productions/repo-guards 0.1.35

**What:** A read's `retryState` counts as its failure in the hook-default and surface-default guards.
**Severity:** low
**Came from:** the ttt-packages shared-package session (Q-Sports scope, ttt-parity)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.35.
- **Release:** `./scripts/release-multiple.sh repo-guards patch`.
- **What changed:**
  - `hookReadDefault` ("a hook never returns a default its consumers cannot tell from data") counted
    a defaulted read as carrying its failure only through `error` / `isError` / `status` or a
    `useReadRetryState` call on it, so a hook that carries the failure on the read's own
    `retryState` (`read.retryState.error`, or `const { data = [], retryState } = useRead()`) was
    flagged. `retryState` now counts, as it already did in the read-state branch guard.
  - `defaultedReadBinding` ("a render surface that defaults a read binds its failure") counts a bound
    `retryState` by itself, so `heldFailureFields: ['retryState']` is no longer needed.
  - The facts are unchanged. Nothing that passed before is flagged now.
- **What the app must change:** Install `@ttt-productions/repo-guards@latest`. In
  `src/__tests__/guards/config/frontend-reads.ts`, `defaultedReadBinding.heldFailureFields` becomes
  `[]` (`retryState` is now built in). Run the guard suite.
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.35 or later, the config no
  longer lists `retryState`, and the guard suite is green.
