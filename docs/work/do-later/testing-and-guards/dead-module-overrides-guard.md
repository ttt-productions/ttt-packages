# A guard against dead module overrides in tests

**What:** A repo-guards check that fails a `vi.mock` override of a module that nothing the test renders or calls can reach.
**Severity:** low
**Came from:** the shared-standards Phase 3 repair session (ttt-prod scope), while removing `useUploadProcessing` overrides from thirteen ttt-prod tests
**Trigger:** after launch, when DJ turns to improving the test code

This is a write-up of the item as it is known now, not a finished design.

## The gap

A module override that no code under test reaches still typechecks and passes `typedMocks`, and it
never runs. It is noise rather than a false green, but it reads as though the test depends on that
module, and it keeps a hand double alive after the code stopped needing it. Seen in ttt-prod's
`src/__tests__/components/tunes-tracks-section.test.tsx` (the only caller of the overridden tray
hook was itself stubbed) and `src/__tests__/components/work-project-subitem-pagination.test.tsx`
(no rendered path reached the hook). Both overrides were deleted.

## Fix shape (not decided)

Resolve the test file's import graph from its real imports, minus the modules it stubs whole, and
fail when a mocked specifier, or an override key on a pass-through mock, is unreachable from that
graph. This is the expensive part: it needs module resolution across packages and the app's path
aliases, and a dynamic import or a component passed in by prop can make a reachable module look
dead. It may be cheaper as a report script that is run occasionally (like `duplicate-exports.mjs`)
than as a gate check.

A generic repo-guards check (packages-side), adopted by each app through its guard config.

## Done when

The check (or report) exists in repo-guards with its own tests, each app registers it, and every
override it flags is removed or shown to be reachable.
