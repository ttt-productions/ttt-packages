# Adopt @ttt-productions/query-core 0.14.35

**What:** The resumable callable factory is deleted.
**Severity:** low

- **Package and version:** `@ttt-productions/query-core` 0.14.35.
- **Release:** `./scripts/release-multiple.sh q-core query-core repo-guards dev-standards patch`.
- **What changed:** `createCallables` returns three kinds — action, reader, invoker.
  `createResumableCallableHook`, `MAX_RESUMABLE_CALLS` and `ResumableOutcome` are gone; no app
  calls them.
- **What the app must change:** only the install. Adopt `repo-guards-0.1.45.md` in the same pass,
  since its guard config's factory facts lose the `resumable` key.
- **Done when:** The lockfiles name `@ttt-productions/query-core` 0.14.35 or later and the app
  typechecks.
