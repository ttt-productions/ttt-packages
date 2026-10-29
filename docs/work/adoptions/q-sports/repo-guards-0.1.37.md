# Adopt @ttt-productions/repo-guards 0.1.37

**What:** A Functions codebase cap guard, deploys in passes, and the quiet gate's start/live phases.
**Severity:** low
**Came from:** the ttt-prod decided-work-items session (one combined package release)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.37.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards ui-core ttt-core file-input firebase-helpers query-core patch`.
- **What changed:**
  - The `codebaseManifest` guard adds "no Functions codebase holds more than 55 functions" (`MAX_FUNCTIONS_PER_CODEBASE`, RULE-STD-BACKEND-311).
  - `node/tooling`: `deployFunctionsInPasses` (with `planFunctionsDeployPasses` and `runFunctionsDeployPasses`) deploys non-function targets once, then each codebase on its own with a pause and a per-pass deployed-functions check, ordering moves receiving-codebase first.
  - The quiet gate: a stage may declare `phase: 'start' | 'live'` (default `start`); `--phase start` / `--phase live` runs one phase.
- **What the app must change:** Split any codebase over 55 functions (the guard fails until then). Move the release workflow's backend deploy onto a thin app script calling `deployFunctionsInPasses`. Mark the gate's test-suite stages and its rules/e2e stages `phase: 'live'`, and point `test:quiet` / `test:quiet:live` at `--phase start` / `--phase live`, as RULE-STD-QUALITY-011 now states.
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.37 or later, the guard suite is green, both deploy jobs use the passes, and the gate runs in two phases.
