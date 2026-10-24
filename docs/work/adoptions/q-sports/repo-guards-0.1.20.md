# Adopt @ttt-productions/repo-guards 0.1.20

**What:** The package is TypeScript throughout; a new guard names every dropdown; guard time limits are named budgets.
**Severity:** medium
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.20.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:**
  - The analyzer, test-paths, import-paths analyzer, seed writer and zod-shape modules are TypeScript (JS checking on). Same entries and export names; `zod-shape` functions return `unknown`, `string | null` or `Record<string, unknown> | null` instead of `any`, `WriteGuardFacts.exceptions` is `WriteGuardException[]`, and the `*GuardFacts` are type aliases.
  - A broken core now fails with a named error (`loadRegistry`: "the core exports no PATH_BUILDERS"; `COLLECTION_SCHEMAS` must be an object).
  - Every guard time limit is a named budget inside the package; no duration changed.
  - `accessibleControls` takes a required new fact, `dropdownTriggers` (the dropdown trigger components, e.g. `['SelectTrigger']`), and builds the guard "every dropdown carries an accessible name": a trigger needs an `aria-label`, an `aria-labelledby`, or an `id` that a label's `htmlFor` in the same file points at.
- **What the app must change:** Install. Add `dropdownTriggers` to the app's `accessibleControls` facts, then name every dropdown the new guard reports (wire it to its visible label where there is one). Narrow any loose use of a `zod-shape` result.
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.20 or later, and the gate is green.
