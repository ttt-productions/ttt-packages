# Adopt @ttt-productions/repo-guards 0.1.20

**What:** The package is TypeScript throughout; new guards name every dropdown and every discarded promise rejection; guard time limits are named budgets.
**Severity:** medium
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.20.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:**
  - The analyzer, test-paths, import-paths analyzer, seed writer and zod-shape modules are TypeScript (JS checking on). Same entries and export names; `zod-shape` functions return `unknown`, `string | null` or `Record<string, unknown> | null` instead of `any`, `WriteGuardFacts.exceptions` is `WriteGuardException[]`, and the `*GuardFacts` are type aliases.
  - A broken core now fails with a named error (`loadRegistry`: "the core exports no PATH_BUILDERS"; `COLLECTION_SCHEMAS` must be an object).
  - Every guard time limit is a named budget inside the package; no duration changed.
  - `accessibleControls` takes a required new fact, `dropdownTriggers` (the dropdown trigger components, e.g. `['SelectTrigger']`), and builds the guard "every dropdown carries an accessible name": a trigger needs an `aria-label`, an `aria-labelledby`, or an `id` that a label's `htmlFor` in the same file points at.
  - One shared alias-target facts check; the factories drop their type-impossible checks. Every guard that takes `importAliases` (`importPaths`, `firestoreWrites`, `adminActionSurface`, `isolatedRoots`, `sharedFakes`, `testTimeouts`, and `partialMocks`' `sharedFakes.importAliases`) refuses an alias with no target folder.
  - A statement label (and a `break` / `continue` label) is not a value reference: a type-only import whose name appears only as a label stays type-only for the import-path and cycle guards.
  - A new required generic guard, `swallowedRejections` ("no promise rejection is discarded without a reason"), with facts `{ reviewed: [{ path, why }] }`. It reads every code root, source and tests, and fails a `.catch()` whose handler does nothing (an empty body, or one returning `undefined`, `void 0` or `null`) unless a comment on the line above its statement, on its line, or inside the handler says why. A reviewed entry whose file no longer discards one is stale.
  - Internal typing: the fact checks read facts lists without an `any`.
- **What the app must change:** Install. Add `dropdownTriggers` to the app's `accessibleControls` facts, then name every dropdown the new guard reports (wire it to its visible label where there is one). Narrow any loose use of a `zod-shape` result. Every `importAliases` entry in the app's guard config names a target folder. Add `swallowedRejections: { reviewed: [] }` to the guard config's generic facts, then give every `.catch()` it reports real handling or a one-line reason comment.
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.20 or later, and the gate is green.
