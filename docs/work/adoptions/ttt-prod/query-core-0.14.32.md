# Adopt @ttt-productions/query-core 0.14.32

**What:** The mutation session can read the signed-in uid live from the auth layer, so an action started right after a sign-in is never thrown away as a session that ended.
**Severity:** medium
**Came from:** the ttt-packages shared-package session (Q-Sports scope, ttt-parity Callables and data)

- **Package and version:** `@ttt-productions/query-core` 0.14.32.
- **Release:** `./scripts/release-multiple.sh query-core patch`.
- **What changed:**
  - `MutationSessionProvider` takes `liveSession` (`LiveSessionSource`: `read()` and `subscribe(onChange)`, the pair `useSyncExternalStore` takes) in place of `currentUid`. The source is read at every capture and every `isCurrent()` / `assertCurrent()`, and every change it reports is observed as it happens. `currentUid` still works, for tests.
  - Why: with `currentUid`, the provider learns a new uid only when the render that carries it commits. An action started in the same task as a sign-in (create the account, then call a callable at once) is captured under the old uid, and the commit that follows ends its session: its answer is thrown away and `mutateAsync` rejects as ended, though the call was the new member's. ttt-prod's registration escapes it today only because `/api/register/complete` runs between `createUserWithEmailAndPassword` and `registerUser`.
  - Design: ttt-packages `docs/packages/query-core.md` § `useSessionMutation` › The session.
- **What the app must change:** Install. In `src/app/query-provider.tsx`, `LiveMutationSession` drops its `useSyncExternalStore` and mounts `<MutationSessionProvider liveSession={LIVE_SESSION} unknownOutcome={UNKNOWN_OUTCOME_POLICY}>`, with a module-level `const LIVE_SESSION: LiveSessionSource = { read: liveUid, subscribe: subscribeSession }` (`@/lib/still-signed-in`, `@/lib/session-retirement`). `src/test/utils.tsx` may keep `currentUid`.
- **Done when:** The lockfiles name `@ttt-productions/query-core` 0.14.32 or later, the app's provider takes `liveSession`, and the gate is green.
