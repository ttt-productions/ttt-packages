# Adopt @ttt-productions/repo-guards 0.1.55

**What:** the quiet gate now saves every step's full output to a folder the app's gate config must name.
**Severity:** medium

- **Package and version:** `@ttt-productions/repo-guards` 0.1.55.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards patch`
- **What changed:** `runQuietGate`'s `QuietGateConfig` has a new required field, `logDir`: the
  absolute path of the folder the gate writes into. Every step that runs writes its whole stdout
  and stderr to `<logDir>/<stem>.log` (the stem is the step's label, lower-cased, other characters
  turned into `-`), and a Vitest or Playwright step also writes its JSON report to
  `<logDir>/<stem>.json`. A step replaces only its own files, so the folder holds each step's
  latest run. A failed step's printed block ends with its file path. No colour code is written
  when stdout is not a terminal. Two step labels that give the same stem fail the second step.
- **What the app must change:** a gate config with no `logDir` is refused (exit 2) before any stage
  runs, so this is not install-only.
  - `scripts/test-quiet.mjs`: the gate config passes `logDir`, the absolute path of
    `.logs/test-quiet` under the repo root.
  - `.gitignore` covers `.logs/`.
  - `CLAUDE.md` § Tests names the folder as where a failed stage's output is read.
- **Done when:** the lockfile names `@ttt-productions/repo-guards` 0.1.55 or later, `npm run
  test:quiet` runs and leaves each stage's output in `.logs/test-quiet/`.
