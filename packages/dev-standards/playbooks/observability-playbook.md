# Observability Playbook

## Purpose

One AI-run audit that the app can diagnose production failures across the frontend, Cloud Functions,
external services, media processing, scheduled jobs, and admin workflows — verifying the monitoring,
error-capture, and durable-failure-state rules (RULE-STD-QUALITY-101–107, RULE-STD-ENG-009): failures
are captured through the sanctioned wrapper, traceable to the affected document, and never leak
secrets or PII. Methodology only; the per-step contract, boundary, and verdict are
[README.md](README.md)'s.

It is NOT a rulebook, NOT a design doc, NOT a human runbook (live incident steps are the app's own
incident audit and runbooks), and NOT a findings log. Async correctness → `async-workflow-playbook.md`;
media → `media-pipeline-playbook.md`.

**Boundary notes.** Hosted consoles (monitoring, provider, and hosting dashboards) are outside the local
boundary; their halves are `BLOCKED` unless DJ authorizes them. **Filter contract for every `rg` here:**
Functions tests are colocated `*.test.ts`, so a piped `rg -v '__tests__'` does not exclude them and a
mocked capture reads like a real one — always exclude by glob.

## When to run

Before launch; after changing a monitoring init, an adapter, a capture path, or an alerting metric;
after an incident whose failure was hard to see.

## Audit Steps

### 1. Inventory observability surfaces (local config)
**Rules:** RULE-STD-QUALITY-101, RULE-STD-QUALITY-102. **Scope:** the app's monitoring inits, error
boundaries, and adapters. **Method (discovery — feeds steps 2–9).**
```bash
rg -n "Sentry\.init|withScope|captureException|ErrorBoundary" src functions/src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.ts' -g '!*.test.tsx'
```
**Expected:** a map of the local surfaces — the monitoring inits for every runtime, the telemetry
scrubber, the monitoring-core `withScope` wrappers, the frontend error boundaries, and the app's
adapters (RULE-STD-QUALITY-102 names that one list). Discovery, not pass/fail.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. Environment and release context, and emulator gating
**Rules:** RULE-STD-QUALITY-101, RULE-STD-ENG-002. **Scope:** the monitoring inits, the build
configuration that may inject a release, the hosting configuration, and the deploy workflow that mints
the release value.
**Method (the app's locators, in its additions, + semantic review).**
**Expected:** monitoring is a no-op under the emulator and in tests, so local runs emit no telemetry,
and no init sends secrets, raw tokens, or full private payloads. **Every runtime carries a `release`
that is a build identifier, not an environment name**, and every runtime emits the SAME identifier (a
frontend release the backend cannot be correlated with is half a release). A release may be
build-injected by a framework plugin, so read that configuration before calling it missing. A release
variable declared in configuration and read by no source is a finding in its own right
(RULE-STD-ENG-002): release tracking looks configured while giving no regression detection. A missing
environment on any runtime is a FAIL.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 3. Structured backend logs on critical functions
**Rules:** RULE-STD-QUALITY-101, RULE-STD-QUALITY-105, RULE-STD-ENG-009. **Scope:** `functions/src`.
**Method (semantic review + wrapping tripwire).**
```bash
rg -n "logger\.|console\.(log|error|warn)\(|withScope" functions/src -g '*.ts' -g '!**/__tests__/**' -g '!*.test.ts'
```
**Expected:** each critical function logs operation and function name, a safe user id, the domain ids
needed to locate the affected document, the result, duplicate or retry status, and an error code — and
routes failures through monitoring-core `withScope`, never a console-only swallow. A "failed" log that
omits the ids to find the document is a FAIL; a raw SDK capture is a RULE-STD-QUALITY-101 violation.
Every callable's error-exit routes through the app's one callable error exit with all of the handler's
work inside its `try` (RULE-STD-QUALITY-105; `codebase-hygiene-playbook.md` step 87 is the mechanical
half). A designed refusal is silent at the exit and WARN-logged with context; an ERROR log or capture
of a designed refusal is a FAIL, and so is a per-callable designed-answer declaration that also covers
a real fault.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 4. Critical-flow traceability (start / success / failure)
**Rules:** RULE-STD-ENG-009, RULE-STD-QUALITY-101, RULE-STD-BACKEND-202, RULE-STD-BACKEND-204.
**Scope:** `functions/src` + `src` across the app's critical flows (its additions list them).
**Method (semantic trace — a tripwire; the deep playbooks own exhaustive coverage).**
**Expected:** each critical flow emits enough to reconstruct start → success or failure. Sensitive
actions additionally carry their atomic audit event — on success and on a refused attempt; audit events
are a distinct record from logs, and both are required. No permanent inventory table here
(RULE-STD-QUALITY-202).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 5. Async failure visibility (stuck / duplicate / orphan state)
**Rules:** RULE-STD-QUALITY-104, RULE-STD-BACKEND-302, RULE-STD-BACKEND-304. **Scope:** `functions/src`
triggers, webhooks, and schedules. Deep → `async-workflow-playbook.md`.
```bash
rg -n "retry|deadLetter|dead-letter|failureReason" functions/src -g '*.ts' -g '!**/__tests__/**' -g '!*.test.ts'
```
**Expected:** every must-complete async obligation exposes durable, queryable state — a delivery
ledger row with an explicit retry class, a dead-letter row, or an outbox status — enough to find stuck
uploads, duplicate payments, failed notifications, and failed cleanups. A required-for-correctness
effect in a fire-and-forget post-commit block with no durable state is a FAIL.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 6. User-safe error surfacing (client)
**Rules:** RULE-STD-FRONTEND-105, RULE-STD-QUALITY-103, RULE-STD-QUALITY-107, RULE-STD-ENG-009.
**Scope:** `src`.
```bash
rg -n "httpsCallable|from 'firebase/functions'" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.ts' -g '!*.test.tsx'
rg -n "captureException" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.ts' -g '!*.test.tsx'
<GUARD_SUITE> -t "every Firebase Auth failure reaches monitoring"
# Catches that show a message — read each hit.
rg -n -A6 "catch \(" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.ts' -g '!*.test.tsx' | rg "toast\(|set\w*Error\(|status: 'error'"
```
**Expected:** client errors ride the declared callables, whose policy owns the expected-answer filter
and the standard error surface; the first grep prints no call site outside the one Functions-instance
provider (classify a line that only names the API in prose). No second capture or second error surface
for one rejection. The UI shows an actionable message; internal detail goes to monitoring, never to the
user. The guard is green. Each catch that shows a message rethrows, or its failure class's one capture
owner captures it, or it is a designed answer — anything else is a silent failure, and a class with no
owner is a finding for a new adapter, never a per-site capture.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 7. Alerting — the local metric surface, then the hosted rules
**Rules:** RULE-STD-ENG-009, RULE-STD-QUALITY-201, RULE-STD-QUALITY-202; the app's alerting design
(its additions name it). **Scope:** the emitted-metric surface is local; the alert rules are hosted.
```bash
# LOCAL — the alert-bearing metric names the code emits, derived from the code.
rg -oNI "metric: '[a-z_]+'" functions/src src -g '*.ts' -g '!*.test.ts' -g '!**/__tests__/**' | sed "s/metric: '//; s/'//" | sort -u
```
**Expected (local half):** the `metric:` field on a structured log is the app's alerting contract with
its log-based metrics; the code is the source of that set (no list is kept here). Diff the emitted set
against the alerting design in both directions: a metric the design does not name (explicitly or by a
declared family) is a failure the code names and nothing was configured to notice; a metric the design
names that the code no longer emits is an alert policy filtering on nothing. **Expected (hosted half —
authorization required):** for each metric and each named failure class, a configured alert policy
exists with an owner and a destination someone reads. `BLOCKED` unless authorized, and never inferred
from the local half.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 8. Dashboards and manual queries (hosted — authorization required)
**Rules:** RULE-STD-ENG-009; the app's incident audit owns the operator map. **Scope:** hosted consoles
+ the local admin surfaces that read them. **Method (semantic review locally; `BLOCKED` for consoles).**
**Expected:** the in-app admin and diagnostic surfaces exist that point an operator at recent
payments, failed media, reports, admin tasks, notifications, and scheduled-job outputs; under DJ's
authorization, the exact console queries for each are documented in the app's runbooks.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 9. PII and secrets hygiene in telemetry and logs
**Rules:** RULE-STD-QUALITY-101, RULE-STD-QUALITY-102, RULE-STD-QUALITY-106, RULE-STD-BACKEND-307.
**Scope:** `functions/src` + `src` + every monitoring init.
```bash
rg -n "console\.(log|error|warn)\(|logger\.(info|error|warn)\(" functions/src -g '*.ts' -g '!**/__tests__/**' -g '!*.test.ts'
rg -n "from '@sentry/node'" functions/src -g '*.ts' -g '!**/__tests__/**' -g '!*.test.ts'
<GUARD_SUITE> -t "every backend telemetry tag key survives the content policy"
```
**Expected:** every backend runtime sends monitoring the error and allowlisted diagnostic fields only,
under ONE policy — monitoring-core `createTelemetryContentPolicy` built from the app's
`<APP_TELEMETRY_POLICY>`, with no app-side copy of the allowlist: no request data, no breadcrumbs, no
trace sampling, transactions dropped, and only the error-grouping default integrations. Each init wires
the scrubber on errors AND transactions (a transaction carries the request URL and query); a browser
init with session replay scrubs replay events and recording frames too. No log statement emits a
provider secret, raw auth token, private message body, file contents, or full report body — only the ids
needed to locate the document. The raw-SDK tripwire prints nothing; the guard is green. A new capture
key that holds prose, a document, a file name, or a path, or a widening of the policy's diagnostic keys
to one, is a RULE-STD-QUALITY-106 FAIL.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 10. Failure drills (hosted/live — authorization required)
**Rules:** RULE-STD-ENG-009; the app's incident audit owns live drills. **Scope:** a hosted system;
some drills run against the user-started emulators. **Method (`BLOCKED` by default).**
**Expected:** under DJ's explicit authorization, simulate a webhook failure, an unauthorized callable,
a media-processor failure, a limiter outage, and a permission denial; each surfaces in logs, monitoring,
and (where step 7 defines one) an alert, with enough context to act. The emulator-feasible drills may
run locally; hosted drills are `BLOCKED` unless authorized.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Pass / Fail

Per [README.md](README.md) § Verdict.
