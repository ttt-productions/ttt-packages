# Adopt @ttt-productions/dev-standards 0.0.10

**What:** A new rule that a test double reproduces the real dependency's states, typed module mocks through `import()`, and the shared typed-mock helpers every repo's tests use.
**Severity:** medium
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/dev-standards` 0.0.10.
- **Release:** `./scripts/release-multiple.sh dev-standards firebase-helpers media-processing-core moderation-core monitoring-core notification-core query-core repo-guards ttt-core upload-core patch`.
- **What changed:**
  - New rule `RULE-STD-QUALITY-012` (`rules/quality/core-rules.md`, scope both): a test double — fake, kit, builder, stubbed module, fixture — reproduces the states the real dependency reaches, and only those; a case's trigger is one production can produce, its fixture holds only values the real writers and the schema allow, and its name states its trigger.
  - `RULE-STD-QUALITY-006` adds the module-mock clause: every `vi.mock` / `vi.doMock` names its module through `import('…')` and returns through that module's shared fake or a typed mock helper that takes its type from `importOriginal` (repo-guards 0.1.26's `typedMocks` enforces it).
  - New entry `./testing` (universal): `passThroughModule(importOriginal, overrides)` keeps the real module and replaces the named exports; `stubModule(importOriginal, stubs)` answers only the stubs and never loads the real module. Both take the module type from the factory's own `importOriginal`, so a wrong module, a misspelled export, or a wrong signature fails to compile.
  - Playbooks: `testing-coverage` step 12 (test doubles reproduce the real dependency's states) is new; `codebase-hygiene` step 73 checks the `import('…')` form and the `typedMocks` guard; `react-leak-audit` step 1 runs entryPurity by its new title ("every entry reaches only the runtimes its own runtime allows"); `playbooks/crosswalk.md` maps `RULE-STD-QUALITY-012` to step 12 and `RULE-STD-QUALITY-001` to it too.
- **What the app must change:**
  - Install. Where the app's rulebook routes or cites the quality rules, read `RULE-STD-QUALITY-012` with them (an app addition is needed only where the app has its own test-double specifics).
  - Replace any local typed-mock helper (a `withOverrides` / `passThroughFake` / `moduleStub` copy) with `@ttt-productions/dev-standards/testing`, as the repo-guards 0.1.26 adoption file describes.
- **Done when:** The lockfiles name 0.0.10 or later in every tree that declares dev-standards, no local typed-mock helper copy remains, and the gate is green.
