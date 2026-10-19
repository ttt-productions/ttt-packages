# Quality (QUALITY)

Tests, gates, lint, monitoring seams, and docs upkeep — effectively every implementation task.
Format and IDs: [README.md](README.md).

### QUALITY-001 — Behavior changes ship with their tests

**Rule.** A behavior change adds or updates the focused tests that prove it; a defect fix ships a
regression test that fails before the fix. A test proves the rule, never the code's current output:
its expected values come from what the behavior must be, so it fails whenever the behavior is wrong.
Every review checks each new or changed test against the rule it claims to prove.

**Why.** A test that asserts whatever the code returns passes on the very bug it exists to catch.

**Prohibits.**
- A behavior change with no covering test; a fix without a failing-first test.
- An expected value copied from output; loosening or skipping an assertion to go green.
- Mocking away the logic under test, or a mock that behaves differently from the real dependency on
  the path under test (BACKEND-104).
- Hiding a failure behind a try/catch, retry, or longer timeout.

**References.** ENG-007, ENG-009.

### QUALITY-002 — Verify at the cost of the fix; one full gate

**Rule.** Run focused checks while editing (`npx vitest run <file>`, or `test:quiet --only <stage>`),
then exactly ONE full gate (`npm run test:quiet`) after the complete change set lands. Never two
full gates at once.

**Why.** A one-file fix does not need a repo-wide gate first; concurrent gates corrupt each other.

**Prohibits.**
- A broad gate as the first check on a single-file change; calling work verified before the final gate.

**References.** ENG-007.

### QUALITY-006 — Lint: justified disables only; one enforced format

**Rule.** A `eslint-disable-next-line` is permitted only for a narrow intentional case and carries
its reason on the line; it is preferred over weakening the rule. A real violation is fixed at its
source. Every package code file, source and tests, is in the one format Prettier writes from the
root `.prettierrc.json`; `test:quiet`'s format stage writes that format and then checks it, the
release preflight and `test:all` only check (a release never publishes formatting nobody
committed), and a check fails a file that is not formatted; and
`eslint-config-prettier` keeps ESLint out of formatting. A file is formatted by running Prettier,
never reflowed by hand.

**Why.** A reasonless suppression silences the next real violation on that line. Without one
enforced format, every edit carries layout churn and line lengths drift with whoever wrote the file.

**Prohibits.**
- A reasonless `eslint-disable-next-line`, or one used to dodge a real fix.
- Suppressing `exhaustive-deps` instead of fixing at the source.
- An unformatted package code file; a `prettier-ignore` without its reason; an ESLint formatting
  rule that fights Prettier.

**References.** The root `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`.

### QUALITY-007 — Guard tests enforce ownership and boundaries, never inventories

**Rule.** Structural guard tests (the boundary suite under `test/`) enforce a forbidden boundary or
single-owner rule against the current clean baseline, every allowlist entry carrying a one-line
justification, so a new regression fails the build. A guard never mirrors an exhaustive list of
today's files, exports, or packages.

**Why.** An inventory-mirror breaks on every legitimate addition and audits nothing.

**Prohibits.**
- A guard asserting an exact list of files, exports, or packages; an unjustified allowlist entry.
- Loosening a guard instead of fixing the regression it caught.

**References.** ENG-002, ENG-005.

### QUALITY-102 — Generic packages stay monitoring-agnostic

**Rule.** No generic package imports `@sentry/*`, a cloud runtime's params module, or app config. A
package that must report failures exposes an `onError`-style callback seam, and the app binds its
monitoring there once.

**Why.** Monitoring bound inside a generic package couples it to one vendor and one app's config.

**Prohibits.**
- Package source importing Sentry, a runtime params module, or app config.

**References.** ARCH-201; `docs/packages/monitoring-core.md`.

### QUALITY-103 — No duplicate captures or error surfaces where a wrapper owns them

**Rule.** Where a package wrapper owns a failure's capture and its user-facing surface, nothing
around it adds a second capture or a second surface for the same failure.

**Why.** Double capture doubles noise; a double surface confuses the user.

**Prohibits.**
- Re-capturing or re-surfacing a failure the owning wrapper already handles.

**References.** QUALITY-102.

### QUALITY-106 — Telemetry carries diagnostics, never request content

**Rule.** The telemetry content policy is ONE mechanism, monitoring-core's
`createTelemetryContentPolicy`, built by each app from its own allowlist: no request data, no traces,
no breadcrumbs, and only allowlisted diagnostic fields. A package never sends a stored document,
user-authored text, a file name, a storage path, or an error's free text as telemetry.

**Why.** Default integrations attach the whole request; only an allowlist keeps free text out.

**Prohibits.**
- A second copy of the content-policy mechanism; a package capture carrying user content.

**References.** `docs/packages/monitoring-core.md`.

### QUALITY-201 — Docs match the current implementation

**Rule.** A package doc (`docs/packages/*.md`) or design doc (`docs/design/*.md`) always reflects the
code today; a behavior change updates it in the same work. When a doc and the code disagree, surface
it (ENG-008). One behavior has one statement.

**Why.** A doc that lags the code becomes misinformation the next reader trusts.

**Prohibits.**
- A behavior change with a stale doc; a doc describing an export or flow the code no longer has.

**References.** ENG-007, ENG-008.

### QUALITY-202 — No drift-prone inventories in permanent docs

**Rule.** Package docs, design docs, and playbooks do not maintain exhaustive living inventories of
current exports, files, or paths. Prefer a durable rule, a small example, or a grep or guard check.

**Why.** An inventory drifts the moment code changes.

**Prohibits.**
- A table that restates a code list solely to enumerate it.

**References.** QUALITY-007.

### QUALITY-203 — New or changed patterns update the owning playbook step

**Rule.** Work that introduces or changes a package pattern updates the owning `docs/playbooks/`
step in the same change, or adds one. An exact-list Expected derives from a named script, guard, or
constant, never a hand-synced list.

**Why.** A pattern with no audit step drifts silently.

**Prohibits.**
- A new pattern with no audit step; an exact-list Expected with nothing behind it.

**References.** `docs/playbooks/README.md`; QUALITY-202.
