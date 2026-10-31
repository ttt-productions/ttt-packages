# Adopt @ttt-productions/dev-standards 0.0.19

**What:** A labelled region whose text scrolls may take keyboard focus.
**Severity:** low
**Came from:** a Q-Sports session (the 2.0 migration, section 4f)

- **Package and version:** `@ttt-productions/dev-standards` 0.0.19.
- **Release:** `./scripts/release-multiple.sh q-core dev-standards patch`.
- **What changed:** the app ESLint base's `jsx-a11y/no-noninteractive-tabindex` also allows
  `role="region"`, and RULE-STD-FRONTEND-203 says a labelled region whose text scrolls takes focus so
  a keyboard can scroll it (`tabIndex={0}`, `role="region"`, an `aria-label`).
- **What the app must change:** Install. ttt-prod's scrolling text boxes take no focus today, so a
  keyboard cannot scroll them; the TTT item for this (Q-Sports `TTT_ITEMS.md`) gives each one the
  labelled, focusable region.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.19 or later.
