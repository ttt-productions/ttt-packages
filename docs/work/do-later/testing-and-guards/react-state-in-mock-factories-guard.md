# A guard against React state hooks inside module-mock overrides

**What:** A repo-guards check that fails a `vi.mock` override that fakes a hook's pending or result state with `useState` / `useReducer` instead of running the real hook over a typed spy.
**Severity:** low
**Came from:** the shared-standards Phase 3 repair session (ttt-prod scope), while converting ttt-prod's guided-resolution test
**Trigger:** after launch, when DJ turns to improving the test code

This is a write-up of the item as it is known now, not a finished design.

## The gap

A hand double that keeps its own `React.useState` to imitate a mutation's per-row pending state
typechecks once it is typed against the real hook, and `typedMocks` accepts it. But it moves only
when the test's own state moves, not when the real mutation would. Seen in ttt-prod's
`src/components/admin/work-views/guided-resolution-flow.test.tsx` (`useLinkNciiEvidence`), which
now runs a real per-row `useSessionMutation` over a never-resolving typed spy instead. The untyped
form of the same double is already caught by the type check; this closes the typed form.

## Fix shape (not decided)

An AST check over each `vi.mock` / `vi.doMock` factory body and the override objects it returns:
a call to `useState`, `useReducer`, `React.useState` or `React.useReducer` inside one fails, unless
it is a reviewed entry with its reason. A generic repo-guards check (packages-side), adopted by each
app through its guard config.

## Done when

The check is in repo-guards with its own tests, each app registers it, and every override it flags
runs the real hook over a typed spy or carries a reviewed entry DJ approved.
