# Adopt @ttt-productions/repo-guards 0.1.56

**What:** the quiet gate prints the end of a failed step's output, and names a file whose hook failed truthfully.
**Severity:** low

- **Package and version:** `@ttt-productions/repo-guards` 0.1.56.
- **Release:** `./scripts/release-multiple.sh repo-guards patch`
- **What changed:**
  - A failed step prints the last 4,000 characters of its output, with a line saying how many
    earlier characters are in its file, where it printed the first 4,000 before.
  - A test file that failed with no failed test is reported as "Failed outside a test (while
    loading, or in a beforeAll/afterAll hook)", and the stage line counts it as "failed outside a
    test", where both said "failed to load" before.
  - New, optional, and unused by an app until it wants them: a command step's `repair`, a Vitest
    step's `npmScript`, and the config's `flags`.
- **What the app must change:** the install. Any app doc or test that quotes "Failed to load" from
  the gate's output takes the new wording.
- **Done when:** The lockfile names `@ttt-productions/repo-guards` 0.1.56 or later.
