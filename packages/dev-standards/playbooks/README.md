# Shared playbooks

These playbooks are **AI audit procedures**: repeatable methodology an AI runs to verify that the
code still obeys the shared engineering rules (`<DEV_STANDARDS>/rules/`). Each one audits rules that
every product shares, so it ships here once, in `@ttt-productions/dev-standards`: an app reads it at
`node_modules/@ttt-productions/dev-standards/playbooks/`, ttt-packages at
`packages/dev-standards/playbooks/`. A playbook describes **how to audit**. It is not:

- **a findings log** — a playbook never carries a running list of results;
- **a human runbook** — operator steps during an incident live in the repo's runbooks;
- **a rulebook** — every must/never lives in the rules, and each playbook step cites the rule IDs it
  audits.

## Steps cite rules, not the reverse

Every step names, on its **Rules** line, the `RULE-STD-*` IDs it audits (and an app's addition names
its `RULE-<PRODUCT>-*` IDs). A rule never cites a playbook step. [crosswalk.md](crosswalk.md) maps
every shared rule to the step or steps that audit it, the guard that enforces it, or "no audit step
yet"; a new or changed rule updates the auditing step and the crosswalk in the same change
(RULE-STD-QUALITY-203).

## What is shared and what stays in the app

- **Shared** — a playbook whose steps audit shared rules, written product-neutral. App values appear
  as the placeholders every repo's `CLAUDE.md` declares (`<APP_NAME>`, `<APP_DATA_PACKAGE>`, <!-- no-check -->
  `<PACKAGES_REPO>`, `<DEV_STANDARDS>`, `<APP_RULES>`, `<DESIGN_DOCS>`, `<TERMINOLOGY_DOC>`,
  `<HOLDS_LIVE_DATA>`, `<CANONICAL_ORIGIN>`, `<GUARD_SUITE>`, and the like). `<GUARD_SUITE>` is the
  command that runs the repo's repo-guards suite; a guard is run alone by adding `-t "<its title>"`.
- **App additions** — an app adds to a shared playbook in its own `docs/playbooks/` folder, in the
  file with the same name, under an "`<APP_NAME>` additions" heading. That file opens with a link to
  the shared playbook. The app's own commands, file paths, counts, known exceptions, domain lists, and
  every security internal (RULE-STD-ARCH-209) live there, never here.
- **App overrides** — an app overrides shared text only explicitly: "Overrides shared
  `<playbook>` step N: …". An unstated difference is drift.
- **Private playbooks** — business and app-infrastructure audits (payments, trust and safety,
  incident response, backup and restore, CI/CD, cost, pre-launch readiness, the security
  orchestration) stay whole in the app. They cite shared and app rule IDs like any other playbook.

## Step identifiers

A step's number is a permanent reference, not a position: it is never reused, never renumbered, and
a dead step is deleted outright with every citation of it updated in the same change. Gaps in the
sequence are meaningless. The shared steps keep the numbers they had in the playbook they came from.

- **An addition to a shared step** sits in the app's file under that step's number
  (`### 3 — <APP_NAME> additions`): the app's known exceptions, its concrete commands, its counts.
- **A step of the app's own** is identified by the app's rule prefix and a number (`TTT-11`,
  `QS-4`), so it can never collide with a shared step. A run report lists the shared steps and the
  app's steps together.

## The per-step contract

Every step states, in order:

1. **Rules** — the `RULE-STD-*` (and app) IDs it audits, or the honest owning artifact where no rule
   owns the check.
2. **Scope** — the repository and the paths it ranges over.
3. **Check** — an `rg` search, a checked-in script, a guard or test, or a precise semantic-review
   procedure. Never a command that fetches a package at run time.
4. **Expected** — what the check prints when the code obeys the rule, and the durable property
   behind it. An exact list is derived from a named guard, script, or canonical constant, never kept
   by hand (RULE-STD-QUALITY-202, RULE-STD-QUALITY-203).
5. **Status** — exactly one of `PASS` / `FAIL` / `NOT RUN` / `BLOCKED`.

**Audit boundary — local only.** The default boundary is the local checkout and the user-started
local emulators. No step queries hosted development or production, a package registry, deployed
configuration, hosted logs, or cloud metadata unless DJ explicitly authorizes that hosted source in
the current conversation. A step that needs an unauthorized hosted source is `BLOCKED`; one that
needs an emulator or a fresh `dev:e2e` nobody started is `NOT RUN`. Neither is ever counted as PASS.

**Shell contract — Git Bash.** Every ```` ```bash ```` block is POSIX shell for Git Bash on Windows.
`rg` must be on `PATH`. Commands run from the repo root of the repository the playbook audits;
ttt-packages is reached as `<PACKAGES_REPO>`. A command needing another directory carries its own
`cd` inside a subshell.

**Command traps (load-bearing).**

- A path that does not exist is never a zero-hit PASS: `rg` aborts with `os error 2` and searches
  nothing.
- `rg` prints backslash paths on Windows. Never pipe `rg -l` into `xargs`; use the NUL-delimited pair
  `rg -l0 … | xargs -0 …`. Never exclude a path with `| rg -v "a/b.ts"`; use `-g '!glob'`.
- Colocated tests (`*.test.ts`) are not under `__tests__`, so exclude them by glob.
- An Expected describes what the step's own command prints. An Expected that discusses hits the
  command cannot reach is a defect in the playbook, not a finding about the code.

**Enforcement ladder.** Prefer, in order: a type or package boundary that makes a violation not
compile; a build-failing guard (the repo-guards suite, the package boundary suites); a lint
restriction; a playbook search with an explicit Expected; manual review only where the semantics
cannot be checked mechanically. A step that proves a durable, high-value constraint recommends
promoting it up the ladder. A guard enforces a boundary or an owner, never an inventory
(RULE-STD-QUALITY-007).

## Findings and run reports

Every finding records **evidence** (path + line), the **violated rule ID**, **impact/severity**, and a
**recommended correction**, and goes to DJ. A playbook run's report is one transient
`<playbook-name>-run.md` in the app in scope's `docs/work/raw-findings/playbook-runs/`, deleted once
worked; the `playbook-audit-run` workflow owns its format. A finding is never written into a
playbook, and an audit never auto-fixes or widens the task (small mechanical documentation drift
excepted, when doc editing is already authorized).

## Verdict

Every run rolls up to one verdict:

- **PASS** — every step returned its expected result and every semantic review checked out.
- **PASS WITH EXCEPTIONS** — only documented, justified exceptions remain; no open violation.
- **FAIL** — any unexpected hit; classify it, record the finding, and bring it to DJ.

Any Critical or High finding needs an owner. A `NOT RUN` or `BLOCKED` step is reported as such,
never counted as PASS.

## The shared playbooks

| Playbook | Audits |
|---|---|
| `codebase-hygiene-playbook.md` | the integration audit across every area; the always-on tripwires |
| `async-workflow-playbook.md` | triggers, schedules, webhooks, outboxes, retries, terminal state |
| `auth-boundary-playbook.md` | identity, authority, and App Check enforced in the backend and rules |
| `callable-functions-playbook.md` | callables and backend entry points: input, auth, secrets, responses |
| `client-write-security-audit-playbook.md` | every client-originated write and the HTTP write surface |
| `data-integrity-playbook.md` | one authority per state, atomicity, idempotency, schema drift |
| `dependency-audit-playbook.md` | install roots, advisories, reproducibility, licensing |
| `field-lineage-playbook.md` | where an identity or owner field lives across the trees |
| `firestore-storage-rules-playbook.md` | the rules files as executable contracts, with their tests |
| `media-pipeline-playbook.md` | uploads, processing, moderation, final paths, rendering |
| `migration-playbook.md` | schema, data, and rules migrations, and the scripts that run them |
| `observability-playbook.md` | capture, traceability, durable failure state, telemetry hygiene |
| `performance-audit-playbook.md` | bounded reads, indexes, cache keys, cold starts, N+1 access |
| `testing-coverage-playbook.md` | the gate, coverage of launch-critical domains, test quality |
| `ux-audit-playbook.md` | page states, mobile, accessibility, feedback, copy |
| `package-boundaries-playbook.md` | the generic packages against the package rules |
| `react-leak-audit-playbook.md` | package entry purity and client-peer install safety |

Write a new playbook when a real, recurring drift risk appears — not speculatively.
