# Adopt @ttt-productions/repo-guards 0.1.47

**What:** A new guard fails any use of a mutation's `mutate` in app code.
**Severity:** medium
**Came from:** the Q-Sports one-mutation-call-style ttt-packages session

- **Package and version:** `@ttt-productions/repo-guards` 0.1.47.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards patch`.
- **What changed:** New generic guard `mutationCallStyle` ("a control runs a mutation only through
  await mutateAsync", RULE-STD-FRONTEND-112), facts `{}`, every app runs it, no reviewed list. In app
  code (tests and test helpers left out) it flags `x.mutate` called or passed as a value,
  `x['mutate']`, and a destructured `mutate` binding (`const { mutate } = …`,
  `{ mutate: alias }`, a destructured parameter). `mutateAsync`, a `mutate:` key in an object
  literal, type positions, strings, and comments pass.
- **What the app must change:** `src/__tests__/guards/config/frontend-actions.ts`: add
  `'mutationCallStyle'` to the facts `Pick` and `mutationCallStyle: {}`. The suite then names every
  site; converting them is ttt-prod's item
  `docs/work/waiting-to-be-implemented/one-mutation-call-style.md`, done in the same change as this
  adoption.
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.47 or later, and
  "a control runs a mutation only through await mutateAsync" passes in ttt-prod's guard suite.
