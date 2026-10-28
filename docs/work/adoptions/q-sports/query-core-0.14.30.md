# Adopt @ttt-productions/query-core 0.14.30

**What:** A mutation can declare the reads it re-reads when its outcome is unknown (a callable deadline), so a commit that lands after the deadline still reaches the screen.
**Severity:** medium
**Came from:** the ttt-packages callable-deadline session (ttt-prod scope)

- **Package and version:** `@ttt-productions/query-core` 0.14.30.
- **Release:** `./scripts/release-multiple.sh firebase-helpers query-core ttt-core patch`.
- **What changed (`./react`):**
  - `SessionMutationOptions` takes `unknownOutcomeReads(variables) => QueryKey[]`: the keys the
    mutation's success path writes. The callable actions of `createCallables` take it too.
  - `MutationSessionProvider` takes `unknownOutcome` (`UnknownOutcomePolicy`):
    `isUnknownOutcome(error)`, `rereadAfterMs` (delays after the failure; `0` re-reads at once), and
    `reread(queryClient, keys)`, which the app implements in its cache-invalidation owner.
  - On a failure the policy classes as unknown, the declared keys are re-read at each delay while the
    session that started the action lasts. Without a policy nothing changes.
- **What the app must change:** the install. To close the stale-after-deadline gap: pass
  `unknownOutcome` to `MutationSessionProvider` (predicate `isCallableDeadlineError` from
  firebase-helpers 0.12.22; a re-read schedule that covers the server's request timeout after the
  client deadline; `reread` in the domain-event registry, skipping infinite lists), and give every
  callable-backed mutation whose success path writes cached reads its `unknownOutcomeReads`.
- **Done when:** the lockfiles name `@ttt-productions/query-core` 0.14.30 or later, the provider
  carries the policy, every callable-backed mutation declares its reads, and the gate is green.
