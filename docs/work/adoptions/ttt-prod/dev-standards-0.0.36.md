# Adopt @ttt-productions/dev-standards 0.0.36

**What:** the rules and the Normal Test Flow now say a gate failure is read from the gate's saved output and diagnosed by a focused rerun, never by a second full run.
**Severity:** low

- **Package and version:** `@ttt-productions/dev-standards` 0.0.36.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards patch`
- **What changed:** text only.
  - RULE-STD-QUALITY-002: a failed full gate run is diagnosed from the output it saved and a focused
    rerun of what failed; the full phase runs again once the fix is in.
  - RULE-STD-QUALITY-011: the gate keeps each step's full output on disk and names the file beside
    a failure.
  - `development-preferences.md` § Verify, then say so: a run's output goes to a file the session
    reads; no `tail` / `head`, no run repeated only to see its output.
  - `claude/CLAUDE.base.md` Test Flow step 3 and the testing-coverage playbook's step 1 say the
    same.
- **What the app must change:** the install. Any app text that restates the old wording of those
  two rules or of Test Flow step 3 is brought in line.
- **Done when:** The lockfile names `@ttt-productions/dev-standards` 0.0.36 or later.
