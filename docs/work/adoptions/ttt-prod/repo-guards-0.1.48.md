# Adopt @ttt-productions/repo-guards 0.1.48

**What:** A new guard fails a stylesheet class that restyles what a ui-core part already sets.
**Severity:** medium
**Came from:** the Q-Sports UI-area ttt-packages session

- **Package and version:** `@ttt-productions/repo-guards` 0.1.48.
- **Release:** `./scripts/release-multiple.sh dev-standards theme-core ui-core repo-guards patch`.
- **What changed:** New generic guard `partRestyling` ("a stylesheet class never restyles what a
  ui-core part already sets", RULE-STD-FRONTEND-008). It reads each part's built-in classes from the
  installed ui module (cva variants resolved from the call site's literal props; a prop passed as an
  expression is judged in every value), resolves what each Tailwind utility sets (breakpoints
  included), and fails a class from a sheet below the utilities layer that sets one of those
  properties to another value. Facts: `{ entryStylesheet, uiModule, exceptions }`, each exception
  `{ path, part, className, why }`. The root entry also exports the helpers it is built from.
- **What the app must change:** `src/__tests__/guards/config/ui.ts`: add `'partRestyling'` to the
  facts `Pick` and `partRestyling: { entryStylesheet: 'src/app/styles/globals.css', uiModule:
  '@ttt-productions/ui-core/react', exceptions: [] }`. The suite then lists every site; fixing them is
  ttt-prod's item `docs/work/waiting-to-be-implemented/ui-core-parts-onto-variants.md` — a variant
  or a call-site Tailwind utility, never an exception.
- **Done when:** The lockfile names `@ttt-productions/repo-guards` 0.1.48 or later, and the guard
  passes in ttt-prod's guard suite.
