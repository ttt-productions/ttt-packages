# Adopt @ttt-productions/dev-standards 0.0.30

**What:** New rule RULE-STD-FRONTEND-112: a control runs a mutation with `await mutateAsync`, never `.mutate`.
**Severity:** medium
**Came from:** the Q-Sports one-mutation-call-style ttt-packages session

- **Package and version:** `@ttt-productions/dev-standards` 0.0.30.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards patch`.
- **What changed:**
  - RULE-STD-FRONTEND-112 in `rules/frontend/data-and-callable-access.md`: a control runs its server
    action with `await mutation.mutateAsync(…)` and does its after-steps on the following lines; app
    code never touches a mutation's `mutate`, and no callback is handed to a press. The hook's own
    `onSuccess` / `onError` stay in the hook; outside a `ConsequenceDialog` confirm the call sits in
    a `try` whose `catch` is empty with a comment when the hook reported the failure, holds the call
    site's own surface (skipping an abort) when it has one, and `finally` holds what ran in
    `onSettled`; inside an `onConfirm` the rejection propagates. Enforced by repo-guards'
    `mutationCallStyle` (`repo-guards-0.1.47.md`).
  - New codebase-hygiene step 123 runs the guard; the crosswalk lists the rule, the step, and the
    guard; step 65's click-fired command reads `mutateAsync` only.
- **What the app must change:** the install. The conversion itself is ttt-prod's item
  `docs/work/waiting-to-be-implemented/one-mutation-call-style.md`.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.30 or later.
