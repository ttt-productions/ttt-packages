# Adopt @ttt-productions/repo-guards 0.1.45

**What:** The callable guards know three factory kinds; `resumable` is gone.
**Severity:** low

- **Package and version:** `@ttt-productions/repo-guards` 0.1.45.
- **Release:** `./scripts/release-multiple.sh q-core query-core repo-guards dev-standards patch`.
- **What changed:** `CallableKind` is `'action' | 'reader' | 'invoker'`; the declarations facts'
  `factories` take those three keys only.
- **What the app must change:** In `src/__tests__/guards/config/callables.ts`, delete the
  `resumable: 'createResumableCallableHook'` entry from the declarations' `factories`.
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.45 or later and the guard
  suite's callable guards run green.
