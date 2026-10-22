# Quality — testing & verification (RULE-STD-QUALITY-001–099)

Format, scopes, and rule IDs: [../README.md](../README.md).

Read this file in full for any implementation task — effectively every task that changes code. These rules sharpen RULE-STD-ENG-007 (behavior, tests, and docs move together) and RULE-STD-ENG-009 (fail truthfully) for testing, gates, lint, and structural guards. The two topic files are read only when the work touches their topic:

- [reliability-and-observability.md](reliability-and-observability.md) (100s) — error handling, monitoring, alerting, or a durable-retry / failure path.
- [documentation-and-drift.md](documentation-and-drift.md) (200s) — a design doc, package doc, playbook, runbook, or a rules folder.

Command how-to — npm scripts, ports, worker counts — lives in the repo's `CLAUDE.md`; these rules state the requirement and cite commands by name.

### RULE-STD-QUALITY-001 — Behavior changes ship with their tests
**Scope.** both

**Rule.** A behavior change adds or updates the focused tests that prove it; a defect fix ships a regression test that fails before the fix and would have caught the bug. In an app, every new callable that performs a sensitive action ships a test asserting exactly one audit event of the expected shape on the success path, plus a `{ result: 'failure' }` event on the failure paths it chooses to log.

A test proves the business rule, never the code's current output: its expected values come from what the behavior must be — the engineering rule, the design, or the recorded decision — so it fails whenever the behavior is wrong. A test is never written or bent to make a run green. Every review agent — above all one an orchestrator spawns — checks each new or changed test against the business rule it claims to prove and reports a test written to pass.

**Why.** Tests that lag the code stop being safety equipment; an unreproduced fix is one refactor away from silently regressing. A test that asserts whatever the code returns passes on the very bug it exists to catch, so a green gate over it is a false success (RULE-STD-ENG-009).

**Prohibits.**
- Shipping a flow, utility, component, or callable change with no test covering the new behavior.
- Fixing a bug without a test that fails before the fix.
- A sensitive-action callable with no exactly-one-audit-event assertion.
- An expected value copied from the code's output instead of derived from the business rule; a test that cannot fail.
- Loosening, deleting, or skipping an assertion, or editing an expected value, to turn a red test green without proving the new value is the correct behavior.
- Mocking away the logic under test, or a mock that behaves differently from the real dependency on the path the test proves (RULE-STD-BACKEND-104's merge-set mock is the canonical example).
- Hiding a failure inside the test: wrapping the assertion in a try/catch, or adding a retry or a longer timeout until it passes.
- A review that passes a test without checking it against the business rule it claims to prove.

**References.** RULE-STD-ENG-007, RULE-STD-ENG-009; RULE-STD-BACKEND-202, RULE-STD-BACKEND-104.

### RULE-STD-QUALITY-002 — Verify at the cost of the fix; one full gate
**Scope.** both

**Rule.** Verification is proportional to blast radius: run focused checks while editing — a single-file `npx vitest run <file>`, or a targeted `test:quiet --only <stage>` — then run exactly ONE full gate (`test:quiet`, RULE-STD-QUALITY-011) after the complete change set lands. Never run multiple full gates concurrently, and never run a full gate against a build a later edit invalidated (RULE-STD-QUALITY-008).

**Why.** A one-file fix does not need a repo-wide gate to prove it; concurrent full gates share ports, build output, and emulators and corrupt each other's results.

**Prohibits.**
- A broad gate as the first check on a single-file change.
- Two full gates, or a gate plus a `dev:e2e` build, racing on the same ports/emulators.
- Calling work verified before the single final `test:quiet` is green.

**References.** RULE-STD-ENG-007, RULE-STD-ENG-009; RULE-STD-QUALITY-008, RULE-STD-QUALITY-011.

### RULE-STD-QUALITY-003 — E2E is green only at zero failures AND zero retry-passes
**Scope.** apps

**Rule.** An E2E gate is green only with zero failures and zero tests that passed through a retry. A final exit code of zero does not make a retry-pass acceptable, and a retry-pass must never be dismissed as generic timing noise. A flake is a real bug. `test:quiet` appends every retry-pass to the app's flaky log (date + spec + test); every non-media retry is a release blocker that must be investigated and fixed before handoff, and a repeated flake is stronger evidence of a defect. Treat a first-attempt failure followed by a retry pass as a possible real first-user failure: investigate shared seeded data, cross-test writes, state leakage, order dependence, first-load behavior, stale caches, backend initialization, and missing commit/render synchronization. Resource-heavy media processing may be classified as machine contention ONLY when artifacts prove that cause under genuine resource load — never by assumption on an idle machine. After a fix, rerun the focused test from clean seeded state, then run the full E2E gate until it reports zero retries.

**Why.** A retry-pass hides the exact failure a real first user will hit; a repeated flake is stronger evidence of a defect, not weaker.

**Prohibits.**
- Accepting a suite whose exit code is zero but which contains a retry-pass.
- Dismissing a retry as timing/contention without artifacts proving that cause under genuine load.
- Declaring E2E complete while `test:quiet:e2e` reports any flaky test.

**References.** RULE-STD-QUALITY-008, RULE-STD-QUALITY-011.

### RULE-STD-QUALITY-004 — E2E tests use the established fixtures and web-first assertions
**Scope.** apps

**Rule.** Tests use the established role fixtures, seed model, and query-cache helpers; assertions are web-first (`getByRole` over CSS selectors, `expect(locator)` which auto-retries) with no `page.waitForTimeout()`. URLs come from the config `baseURL` — zero hardcoded URLs in specs — and each test covers one behavior (multiple related `expect()` calls are fine). A spec runs on the data the seed model provides: it never reseeds or clears emulator data. The UI-login helper is called only in the auth-setup project and the auth specs that exercise login/logout themselves — never in a regular spec. Admin specs, and any lifecycle or build-on-each-other specs, declare `test.describe.configure({ mode: 'serial' })`.

**Why.** Role fixtures and web-first assertions survive markup and timing changes; a non-web-first assertion (`expect(await locator.textContent())`) does not retry, and parallel admin sessions hang the Auth emulator on concurrent same-admin token validation.

**Prohibits.**
- `page.waitForTimeout()`; a non-retrying assertion where a web-first one exists.
- The UI-login helper outside auth setup / the auth specs; CSS selectors where a role query works.
- A hardcoded URL in a spec where `baseURL` covers it.
- A spec that reseeds or clears emulator data.
- Parallel admin specs (missing serial mode).

**References.** RULE-STD-QUALITY-003, RULE-STD-QUALITY-008.

### RULE-STD-QUALITY-006 — Lint and format: zero suppression in apps, reasoned disables in packages; one enforced format
**Scope.** both

**Rule.** The lint half is split by scope; the format half is the same for both. **Apps** are zero suppression: no `eslint-disable` comment anywhere in the linted trees — source, Functions, E2E, scripts, and config. When a rule fires, fix the root cause, and solve a genuine false positive structurally — rename, refactor, or scope the rule — never by suppressing the line; external-authority state pruning uses the sanctioned render-phase adjustment, not a suppressed effect. A `warn`-level finding is a finding to fix, and a rule is never turned off, nor `ignores` widened, to pass failing code. New app code also follows the conventions the lint config forces, listed below. **Packages** permit an `eslint-disable-next-line` only for a narrow intentional case, carrying its reason on the line; it is preferred over weakening the rule, and a real violation is fixed at its source.

Every code file — source, tests, scripts, and config — is in the one format Prettier writes from the shared Prettier config (this package's `config/prettier.json`); `test:quiet`'s format stage writes that format and then checks it, a check-only run (a package release preflight, `test:all`) only checks, so a release never publishes formatting nobody committed, and the check fails a file that is not formatted; `eslint-config-prettier` keeps ESLint out of formatting. A file is formatted by running Prettier, never reflowed by hand.

**Why.** A suppression silences the next real violation of that rule on that line: apps chose zero suppression, and a package's reasonless disable does the same damage. A rule switched off or an ignore widened to get past failing code is the same suppression at file scale. Without one enforced format, every edit carries layout churn and line lengths drift with whoever wrote the file.

**Prohibits.**
- Any `eslint-disable` comment in an app; a reasonless `eslint-disable-next-line` in a package, or one used to dodge a real fix.
- Leaving a `warn`-level finding unfixed; turning a rule off or widening `ignores` to pass failing code.
- Re-registering `eslint-plugin-react-hooks` in an app (`eslint-config-next` already registers it; flat config errors on redefinition).
- Unaliased Lucide icons that collide with HTML/Next built-ins (`Image`/`Link`/`File` → import as `ImageIcon`/`LinkIcon`/`FileIcon`).
- A Playwright fixture callback parameter named `use` (collides with React's `use`; name it `provide`).
- An anonymous React wrapper component returned from a test helper (assign `displayName`).
- Straight `'`/`"` in JSX text content (use `&apos;`/`&quot;`).
- Suppressing `exhaustive-deps` instead of fixing at the source (destructure the stable `mutate`; memoize a derived dep; destructure the specific prop fields used).
- An unformatted code file; a `prettier-ignore` without its reason; an ESLint formatting rule that fights Prettier.

**References.** RULE-STD-ENG-008; this package's `node/eslint` bases and `config/prettier.json`; each repo's ESLint config and `.prettierignore`.

### RULE-STD-QUALITY-007 — Guard tests enforce ownership and boundaries, never inventories
**Scope.** both

**Rule.** Structural guard tests (the repo-guards suite each repo runs in its gate — an app's guard suite, ttt-packages' boundary suite) enforce a forbidden boundary or single-owner rule against the current clean baseline — every allowlist entry carrying a one-line justification — so that a NEW regression fails the build. A guard must not mirror an exhaustive list of today's files, exports, packages, or domains: an inventory-mirror breaks on every legitimate addition and audits nothing.

**Why.** A brittle inventory-mirror is churn, not enforcement; the value is catching the next violation, not counting the current files.

**Prohibits.**
- A guard asserting an exact count or list of files, exports, packages, or domains.
- An allowlist entry without a justification.
- Loosening a real guard rather than fixing the regression it caught.

**References.** RULE-STD-ENG-002, RULE-STD-ENG-005.

### RULE-STD-QUALITY-008 — Rules and E2E run against a fresh dev:e2e
**Scope.** apps

**Rule.** The rules and E2E stages count only when run against a fresh `dev:e2e` (the production `next build` + `next start`, NOT `dev:local`) started after the final app-code edit. An app-code or Functions change after the server started invalidates the running build: stop the stack (`dev:kill`), get the repository `test:quiet` green, then start a fresh `dev:e2e` before rerunning rules/E2E. Test-file-only changes do not require a restart. Who starts and stops the stack is owned by the entry files (the shared `CLAUDE` base § The Normal `<APP_NAME>` Flows — `dev:e2e` is agent-operated within the Test Flow; `dev:local` is user-owned, always); the two servers are mutually exclusive (shared ports and `.next`).

**Why.** `dev:e2e` serves a prebuilt bundle with no hot reload — running E2E against a stale build tests code that no longer exists; `dev:local`'s `next dev` OOM-crashes under a full E2E run.

**Prohibits.**
- Running rules/E2E against a `dev:e2e` started before the last app-code edit.
- Starting `dev:local` for the user, or running both servers at once.
- Counting a rules/E2E result from a server the change already invalidated.

**References.** [../../claude/CLAUDE.base.md](../../claude/CLAUDE.base.md) § The Normal `<APP_NAME>` Flows; RULE-STD-QUALITY-002, RULE-STD-QUALITY-011.

### RULE-STD-QUALITY-009 — A test loads the code it tests when its file loads
**Scope.** both

**Rule.** A test imports the code it tests at the top of its file — a static import, or a top-level `await import()` — never inside a case, a hook, or a helper they call, and never resets the module registry. A case that needs other state gets it without a reload: an environment the code reads at load is set in `vi.hoisted` before the import, per-instance state is cleared through the module's test-only `__reset…()` seam, and a flag the code reads once is read when it is called instead. A file whose fresh module per case is itself what it proves is a reviewed entry with its why, and an entry whose file no longer does is stale. The repo-guards `testCaseModuleLoads` guard enforces it.

**Why.** A module's first load pulls its whole graph; inside a case that cold load is timed as the case's own work, so a file's first case was slow for nothing it did and, under the full parallel run, crossed its timeout.

**Prohibits.**
- A dynamic `import()` of the repo's own code inside a case, a hook, or a helper they call.
- `vi.resetModules()` outside a reviewed entry.
- A reviewed entry whose file no longer loads a module per case.

**References.** RULE-STD-QUALITY-001, RULE-STD-QUALITY-007; the repo's guard config (the guard's facts and its reviewed entries).

### RULE-STD-QUALITY-010 — A test's time limit names a budget
**Scope.** both

**Rule.** Every test runs on the runner's default limit, and every Testing Library wait on its default. A case that does real heavy work — an ffmpeg encode, a long keystroke-by-keystroke flow, a maximum-size file through an emulator — names a budget exported by its tree's timeout file, as the test's or `describe`'s `timeout` option and in the waits inside it; a new tier is added to that file, never written in place. A case that is slow only because it waits out a real timer — a retry delay, a debounce — runs on the fake clock and steps the timer instead of taking a budget. The repo-guards `testTimeouts` guard enforces it.

**Why.** The suites run while the machine is in other use, so a case within a few times of its limit on an idle machine fails under load; a number written in place hides how many tests need more time and lets one raise its own limit to get past a slow run, and a budget spent on a timer pays seconds of real waiting the fake clock skips.

**Prohibits.**
- A test, suite, hook, `vi.setConfig`, or Testing Library limit written as a number, or as a name that is no budget imported from a timeout file.
- A budget on a case that only waits out a real timer.

**References.** RULE-STD-QUALITY-001, RULE-STD-QUALITY-007; RULE-STD-ENG-005.

### RULE-STD-QUALITY-011 — `test:quiet` is the canonical gate; a stage named by hand never skips
**Scope.** both

**Rule.** `test:quiet` (`scripts/test-quiet.mjs`) is the one command that verifies a change set, running every declared stage, with targeted `--only <stage>` variants for focused runs. A hand-assembled npm sequence is not a substitute, and new verification is added as a stage of this gate rather than as a second command — structural guards run inside its test stage, an app's rules assertions in its `rules` stage. A stage that needs the `dev:e2e` stack (an app's `rules` and `e2e` stages) is skipped (⊘) by a full run with the stack down, which passes on the stages it ran — the app's Normal Test Flow's first step before `dev:e2e` starts; a run that names it (`--only rules`, `--only e2e`, or a script alias for them) fails with the stack down, naming the missing services. The stage list lives in the script, not restated here (RULE-STD-QUALITY-202).

**Why.** One command run the same way by everyone is the only way a green result means the same thing twice; assembling stages by hand silently drops the ones that were inconvenient that day. A live stage asked for by name and skipped would read as verified while nothing ran.

**Prohibits.**
- Declaring a change set verified from a hand-assembled sequence, or the live stages verified from a full run that skipped them.
- A live stage named in `--only` reported as a skip.
- A second parallel gate command instead of a new stage in this one.

**References.** `scripts/test-quiet.mjs`; RULE-STD-QUALITY-002, RULE-STD-QUALITY-003, RULE-STD-QUALITY-008.
