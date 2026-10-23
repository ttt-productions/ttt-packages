# Adopt @ttt-productions/query-core 0.14.25

**What:** The session fence now covers callbacks that await, and code after `await mutateAsync()`.
**Severity:** high
**Came from:** the ttt-packages shared-standards run (follow-up batch found during adoption)

- **Package and version:** `@ttt-productions/query-core` 0.14.25.
- **Release:** `./scripts/release-multiple.sh query-core chat-schemas ttt-core chat-core chat-react patch`.
- **What changed:** `useSessionMutation`'s `mutateAsync` also rejects with `MutationSessionEndedError` (no `cause`) when the session ends while the hook's awaited `onSuccess` / `onSettled` runs, so `await mutateAsync(); next()` never continues into another session. Every callback — the hook-level `onMutate` / `onSuccess` / `onError` / `onSettled` and the per-call ones — receives the captured session as `context.session`; the callable kinds of `createCallables` hand their callbacks the same session. New exported types: `SessionMutationResult`, `SessionMutateOptions`. `createCallables` and the Firestore mutation hooks return `SessionMutationResult`.
- **What the app must change:** Install `@ttt-productions/query-core@latest` wherever it is declared. A callback that awaits re-checks `context.session.isCurrent()` before a later toast or cache write; a chain after `await mutateAsync()` relies on the rejection. No second session check beside the owner.
- **Done when:** The lockfiles name `@ttt-productions/query-core` 0.14.25 or later, every multi-step mutation chain re-checks the owner's session after each await, and the gate is green.
