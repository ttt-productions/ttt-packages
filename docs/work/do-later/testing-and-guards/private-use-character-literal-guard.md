# A guard against a literal private-use character in code

**What:** A repo-guards check that fails a code file holding the literal U+F8FF character (or any Unicode private-use character) instead of its escape.
**Severity:** low
**Came from:** the Q-Sports 2.0 migration's paths step (Q-Sports scope), 2026-11-04, on DJ's yes
**Trigger:** when DJ has time for the nice-to-have guards

This is a write-up of the item as it is known now, not a finished design.

## The gap

A Firestore prefix query ends its range with U+F8FF. Written as the character itself, it is
invisible in an editor and in a diff: `'<=', ''` looks like an empty string. It has turned up twice
in Q-Sports, in `e2e-hosted-dev/helpers/situations/naming.ts` and `casting.ts` (both fixed to
`''`). ttt-prod has one in `src/__tests__/rules/all-work-projects.rules.test.ts`, and its
`docs/work/waiting-to-be-implemented/hosted-harness-upgrades-from-q-sports.md` fixes it.

## Fix shape (not decided)

Scan every code file the guard suite reads for a character in the private-use ranges
(U+E000–U+F8FF, plus the supplementary planes) and fail, naming the file and line and the escape to
write instead. Docs and fixtures that hold such a character on purpose would need a reviewed
allowlist entry with its reason.

A generic repo-guards check (packages-side), adopted by each app through its guard config.

## Done when

The check exists in repo-guards with its own tests, each app registers it, and no code file in
either app holds the literal character.
