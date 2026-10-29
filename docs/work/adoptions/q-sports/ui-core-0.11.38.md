# Adopt @ttt-productions/ui-core 0.11.38

**What:** Every typed box outside the input-format system must carry a length limit; the types refuse one without it.
**Severity:** low
**Came from:** the ttt-prod decided-work-items session (one combined package release)

- **Package and version:** `@ttt-productions/ui-core` 0.11.38.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards ui-core ttt-core file-input firebase-helpers query-core patch`.
- **What changed:**
  - `Input` with `type` `email` / `tel` / `url` / `search` (`LengthBoundInputProps`) and every `textEntry` `Input` or `Textarea` require `maxLength`; `type="number"` (`NumberInputProps`) requires `max`; a `readOnly` box is exempt. Other built-in types are unchanged.
  - `SearchDropdown` requires a `maxLength` prop for its search box.
- **What the app must change:** Install, then run the app's typecheck: it lists every box without a limit. Give each one a constant in the app's own application-data package (an email limit, a search-query limit, an account-id limit, and so on, reusing a constant the server schema already uses for that field), apply the same constant to the server schema for that field, and pass `maxLength` to each `SearchDropdown`.
- **Done when:** The lockfiles name `@ttt-productions/ui-core` 0.11.38 or later, the typecheck is clean with every box reading a constant, and the gate is green.
