# Testing Coverage Playbook

## Purpose

One AI-run audit of whether the app has enough automated coverage to protect its launch-critical
security, data, payment, media, async, and UI flows — verifying the testing and verification rules
(RULE-STD-QUALITY-001–012) and the security-boundary rules the tests must exercise
(RULE-STD-ENG-006, RULE-STD-BACKEND-001, RULE-STD-BACKEND-003, RULE-STD-BACKEND-005). Methodology only;
the per-step contract, boundary, and verdict are [README.md](README.md)'s.

It is NOT a rulebook, NOT a design doc (the app's testing design doc holds the test architecture), and
NOT a findings log. Area depth lives in the owning playbooks — `auth-boundary-playbook.md`,
`client-write-security-audit-playbook.md`, `firestore-storage-rules-playbook.md`,
`media-pipeline-playbook.md`, `async-workflow-playbook.md`, `migration-playbook.md`.

## When to run

Before launch; after a change set lands and before it is called verified; when a review asks whether a
domain is covered.

## Audit Steps

### 1. Run the full gate
**Rules:** RULE-STD-QUALITY-011, RULE-STD-QUALITY-002, RULE-STD-QUALITY-008, RULE-STD-QUALITY-003.
**Scope:** the repo's whole suite through `test:quiet`.
```bash
npm run test:quiet
```
**Expected:** every stage ✓. `test:quiet` is the one command that verifies a change set; a
hand-assembled sequence is never a substitute (RULE-STD-QUALITY-011). A test stage is red when any test
is skipped or left pending — a skipped test proves nothing, so it is fixed and un-skipped, or deleted
with the behavior it covered. The rules and E2E stages count only against a fresh `dev:e2e` started
after the last app-code edit (RULE-STD-QUALITY-008); in a full run without the stack they skip (⊘) and
are reported `NOT RUN`, never PASS, while a run that names them fails with the stack down. Record
failures separately from retry-passes — a retry-pass is a real bug, logged where the app's flaky log
lives (RULE-STD-QUALITY-003). Targeted reruns use the gate's `--only` stages.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. Map tests to launch-critical domains
**Rules:** RULE-STD-QUALITY-001, RULE-STD-ENG-007, RULE-STD-ARCH-005. **Scope:** every test tree the
app has — `src`, `functions/src`, `e2e`, and every other deployed tree's own suite — against the app's
launch-critical domain list (its additions). **Method (semantic mapping; no permanent inventory —
RULE-STD-QUALITY-202).**
```bash
rg --files -g '*.test.ts' -g '*.test.tsx' -g '*.spec.ts' src functions/src e2e | rg -v node_modules
```
**Expected:** each launch-critical domain has automated coverage or a documented, accepted manual
check; a domain with zero automated coverage is a FAIL. The mapping is produced at audit time, not
stored here. Three domains this command alone cannot see: any other deployed tree, whose trust surface
(token verification, provenance, deny paths) carries the same testing bar (RULE-STD-ARCH-005) and whose
cross-tree mint/trust pair is proven as a PAIR; a mobile form factor that is a test-runner project
rather than a spec tree (step 10); and run-once data scripts (step 7).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 3. Negative / attacker tests on sensitive flows
**Rules:** RULE-STD-QUALITY-001, RULE-STD-ENG-006, RULE-STD-BACKEND-001, RULE-STD-BACKEND-003,
RULE-STD-BACKEND-005. **Scope:** `functions/src` + rules tests. **Method (semantic review).**
**Expected:** each sensitive flow has missing-auth, wrong-user, invalid-input, unauthorized-role,
spoofed-id, and permission-denied cases — not only the happy path. A sensitive callable or rule path
with positive-only coverage is a FAIL.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 4. Replay / idempotency tests
**Rules:** RULE-STD-BACKEND-304, RULE-STD-QUALITY-001. **Scope:** `functions/src`. Deep →
`async-workflow-playbook.md` step 10. **Method (semantic review).**
**Expected:** webhooks, triggers, scheduled jobs, media processors, notifications, and every other
re-deliverable handler have a "run twice" test proving a redelivery is a safe no-op. A re-deliverable
handler with no replay test is a FAIL.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 5. Rules allow + deny tests
**Rules:** RULE-STD-BACKEND-120, RULE-STD-BACKEND-109. **Scope:** both rules files + the rules tests.
```bash
npm run test:quiet:rules   # needs a fresh dev:e2e
# An OR alternation reports a one-sided file as covered — check each file for BOTH sides.
for f in $(rg --files -g '*.rules.test.ts'); do
  rg -q assertSucceeds "$f" && rg -q assertFails "$f" || echo "ONE-SIDED: $f"
done
```
**Expected:** every path with write access has both an allow and a deny test, and the loop prints only
known one-sided files — each covering a path with no reachable client success at all (server-only
paths, or a guard that a retired path never comes back), where a deny-only spec is the complete
coverage. Any other `ONE-SIDED:` line is the finding; the test for a new exception is proof that no
success is reachable, never that writing the allow case was inconvenient. A rules change shipped with
no emulator test is a FAIL.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 6. E2E happy-path coverage and hygiene
**Rules:** RULE-STD-QUALITY-004, RULE-STD-QUALITY-003. **Scope:** `e2e`.
```bash
# A hardcoded URL is banned WHERE baseURL covers it — in a navigation call.
rg -n "page\.waitForTimeout|(goto|navigate)\(\s*['\"\`]https?://" e2e -g '*.ts'
rg -n "name: '|devices\[|viewport" playwright.config.ts
```
**Expected:** representative real-mutation coverage for the app's launch-critical journeys, specs on
the role fixtures with web-first assertions, no `page.waitForTimeout`, no hardcoded URL in a navigation
call, and admin and lifecycle specs in serial mode. E2E that only navigates is a FAIL. Emulator-host
constants and other origins `baseURL` cannot express are known non-findings; classify each hit as a
call or a mention. **Viewport axis — report it, do not assert it:** the second command is the evidence
for the device dimension each run. Cross-ref `codebase-hygiene-playbook.md` step 28.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 7. Migration tests (old / new / mixed / duplicate)
**Rules:** RULE-STD-QUALITY-001, RULE-STD-ENG-007, RULE-STD-BACKEND-114. **Scope:** active schema
migrations in `functions/src` and every run-once data script. Owning →
`migration-playbook.md`.
**Expected:** two halves. **Schema migrations:** each active migration tests old, new, and mixed
schemas and a duplicate run; one with no mixed or duplicate-run test is a FAIL; with no active
migration in scope this half is `NOT RUN`. **Run-once data scripts:** every data-writing script has a
test, and duplicate-run is the mandatory case — a second consecutive run producing identical end
state. Confirm each spec actually asserts the duplicate run rather than merely existing.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 8. Deterministic fixtures; no private production data
**Rules:** RULE-STD-QUALITY-004. **Scope:** the E2E fixtures and the seed path.
```bash
# The app's additions add its UI-login helper and seed entry to this pattern.
rg -n "fixture" e2e -g '*.ts'
```
**Expected:** test users, records, media, and payments are deterministic seed fixtures, never private
production data; a UI login appears only in the auth-setup project and the specs that exercise login
itself. A test that depends on private production data or leftover emulator residue is a FAIL.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 9. CI readiness (clean-room run)
**Rules:** RULE-STD-QUALITY-002, RULE-STD-QUALITY-008, RULE-STD-QUALITY-011. **Scope:** the repo.
**Method (semantic review).**
**Expected:** the suite passes from a fresh install with no hidden local state — every prerequisite
(tools on `PATH`, local env values, the emulators) is declared in the repo's `CLAUDE.md`, never <!-- no-check -->
undocumented machine residue. The `npm ci`-from-registry half is `dependency-audit-playbook.md`'s under
authorization.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 10. A mobile-viewport project exists and actually selects specs
**Rules:** RULE-STD-QUALITY-004, RULE-STD-QUALITY-001, RULE-STD-FRONTEND-007. **Scope:** the
Playwright config + `e2e`. Reading the config is local; running it is step 1.
```bash
rg -n -A8 "name: 'mobile'" playwright.config.ts
rg -c "@mobile" e2e -g '*.spec.ts'
```
**Expected:** where the app declares a mobile project, it sets a mobile device profile, a tag filter,
and `dependencies` on the desktop projects so it runs after them against shared seeded state. **The tag
count is non-zero** — a filtered project whose pattern matches nothing runs zero tests and goes green
while proving nothing. **The findings:** the project absent (the mobile axis has no automated proof); a
present project with a zero tag count; a count that drops (a journey silently lost its mobile pass); or
a project missing its `dependencies`, which is a flake generator. The manual mobile pass is
`ux-audit-playbook.md` step 3.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 11. Tests prove the business rule, not the code's output
**Rules:** RULE-STD-QUALITY-001, RULE-STD-ENG-009, RULE-STD-BACKEND-104. **Scope:** every new or changed
test under review. **Method (semantic review, read-only).**
For each test: (a) name the business rule it claims to prove — the engineering rule, the design doc's
statement, or the recorded decision — and check each expected value against THAT, never against what
the code returns; (b) confirm it would fail if the behavior were wrong; (c) read its mocks and fixtures
— the logic under test is not mocked away, and a mock on the proved path behaves like the real
dependency (a mocked merge-set that expands dotted keys is the canonical counter-example); (d) look for
an assertion loosened, deleted, or skipped, or an expected value edited, with nothing showing the new
expectation is correct.
**Expected:** every expected value traces to a named business rule; no test is written or bent to
pass. **The findings:** an expected value copied from the code's output; a test that cannot fail; an
assertion weakened to turn red green; a mock that hides the behavior under test; a review that passed a
test without checking it against its rule.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 12. Test doubles reproduce the real dependency's states
**Rules:** RULE-STD-QUALITY-012, RULE-STD-QUALITY-001. **Scope:** every shared fake, kit, and builder
the repo's tests use, and every new or changed test under review. **Method (semantic review,
read-only).** (a) For each shared double or builder, list from the real dependency's source and docs
the states it reaches that the product renders or handles apart — a read's first load, failure,
retry, background refresh over kept data, failure over kept data, a list's next page and its failure —
and confirm each one is buildable; (b) for each case, confirm its trigger is one production can
produce and its fixture values are ones the schema and the real writers allow; (c) confirm each case's
name states the trigger it uses; (d) confirm every export the repo's tests replace with a stand-in
that has shared builders is listed in the guard config's `typedMocks` `builtOverrides`, so the
`typedMocks` guard holds each override to those builders.
**Expected:** every reachable state the product renders apart is buildable, no double offers an
unreachable one, and every case is driven the way production drives it. **The findings:** a reachable
state no builder builds; a builder with no real state behind it; an answer pushed to a listener the SDK
has ended; a cache entry removed by hand to reach a state no user action reaches; a fixture value the
schema or its only writer rules out; a case named for a trigger it no longer uses; an export with
shared builders whose stand-ins the guard config does not hold to them.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Pass / Fail

Per [README.md](README.md) § Verdict. **FAIL** — any Critical or High risk area lacks positive and
negative, rules, or replay coverage.
