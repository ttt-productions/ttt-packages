# Adopt @ttt-productions/theme-core 0.12.17

**What:** theme-core drops its `!important` patches and the unused `.form-select-trigger`.
**Severity:** low

- **Package and version:** `@ttt-productions/theme-core` 0.12.17.
- **Release:** `./scripts/release-multiple.sh dev-standards theme-core ui-core repo-guards patch`.
- **What changed:** `.app-dropdown-item` (and its hover/focus), `.help-dialog-title` and
  `.help-dialog-body` no longer use `!important`: nothing they set is set by the part they sit on.
  `.form-select-trigger`, which no app used, is gone. Recipe values are unchanged; ui-core's variants
  carry them.
- **What the app must change:** the install. A call-site Tailwind colour utility on a
  `DropdownMenuItem` or a help dialog title now applies where the patch beat it; check
  `common-help-component.tsx` and the menus look as before.
- **Done when:** The lockfile names `@ttt-productions/theme-core` 0.12.17 or later.
