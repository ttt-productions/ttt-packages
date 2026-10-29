# Adopt @ttt-productions/repo-guards 0.1.36

**What:** A read's `retryState` counts as its failure in the hook-default guard only where its failure is actually carried.
**Severity:** low
**Came from:** the ttt-packages shared-package session (Q-Sports scope, ttt-parity)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.36.
- **Release:** `./scripts/release-multiple.sh repo-guards patch`.
- **What changed:**
  - `hookReadDefault` ("a hook never returns a default its consumers cannot tell from data") counted
    any access to a read's `retryState` as carrying its failure, so a hook that defaulted `q.data`
    and handed on only `q.retryState.isLoading` (or `.isRetrying`, `.retry`) passed while its
    consumers could not tell the default from data. A `retryState` now counts only where its `error`
    is read, where it is passed on, returned or spread whole, or where it is destructured with its
    `error`; `error` / `isError` / `status` and `useReadRetryState(q)` count as before.
  - The facts are unchanged. Checked against ttt-prod's `src/hooks` and `src/components`: no
    defaulted read there changes verdict.
- **What the app must change:** Install `@ttt-productions/repo-guards@latest`. Run the guard suite.
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.36 or later and the guard
  suite's `hookReadDefault` check is green.
