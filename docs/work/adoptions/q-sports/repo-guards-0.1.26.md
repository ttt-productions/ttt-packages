# Adopt @ttt-productions/repo-guards 0.1.26

**What:** A new generic guard, `typedMocks`: every module mock is typed against the module it replaces, and no test overrides an export the app lists as one whose real behavior every test needs.
**Severity:** medium
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.26.
- **Release:** `./scripts/release-multiple.sh firebase-helpers media-processing-core monitoring-core query-core repo-guards ttt-core upload-core patch`.
- **What changed:** `generic.typedMocks` is a required fact: `importAliases`, `fakes` (the same shared-fake list `sharedFakes` takes), `typedHelpers` (each an owner file and the typed mock helpers it exports), and `forbiddenOverrides` (each a module, the exports no test overrides, and why). It registers two guards: "every module mock is typed against the module it replaces" (a `vi.mock` / `vi.doMock` factory returns through a listed shared fake or typed helper; a mock with no factory passes) and "no test overrides an export whose real behavior every test needs". `entryPurity` takes a new required fact, `testRunnerSegment` (`'testing'`): an entry whose last subpath segment it names (`./<runtime>/testing`) runs only inside the test runner, so "every universal and Node entry loads under plain Node" never loads it, while its runtime segment still binds its purity.
- **What the app must change:** If the guard config declares `entryPurity` facts rather than `{ absent }`, add `testRunnerSegment: 'testing'`. Declare `generic.typedMocks` in the guard config (the suite fails the config until it is there). Each untyped factory the first guard reports moves onto a shared fake or a typed helper; list any export the app wants the real one of in every test under `forbiddenOverrides`, or declare it `[]`.
- **Done when:** The guard config declares `typedMocks`, the lockfiles name `@ttt-productions/repo-guards` 0.1.26 or later, and both guards are green.
