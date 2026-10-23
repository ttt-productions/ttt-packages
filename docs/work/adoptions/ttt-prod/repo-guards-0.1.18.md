# Adopt @ttt-productions/repo-guards 0.1.18

**What:** The read-state branch guard reads a failure compared with null as one test.
**Severity:** medium
**Came from:** the ttt-packages shared-standards run (found wiring the guard in ttt-prod)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.18.
- **Release:** `./scripts/release-multiple.sh repo-guards patch`.
- **What changed:** In `readStateBranches`, the failure-branch half treats a failure compared with `null` or `undefined` as one test:
  - `failure !== null` (or `!= null`) is a failure branch, and it counts as conjoined with the same read's no-data check through the `&&` chain around the comparison.
  - `failure === null` (or `== null`) is a test that nothing failed, never a failure branch.
  - Before this release, a correctly conjoined `read.data === undefined && read.retryState.error !== null` was flagged, and so was a loading branch on `read.retryState.error === null`.
- **What the app must change:** Install `@ttt-productions/repo-guards@latest`. Remove any `readStateBranches` failure-branch exception that only covered those two shapes; the guard reports it stale.
- **Done when:**
  - The lockfile names `@ttt-productions/repo-guards` 0.1.18 or later.
  - The guard suite runs with no exception left for those shapes.
