# Async Workflow Playbook

## Purpose

One local, AI-run audit of the workflows whose correctness depends on events, retries, triggers,
webhooks, scheduled jobs, external services, or multi-step state transitions — verifying
idempotency, ordering safety, terminal state, partial-failure recovery, and durable observability
against the shared rules. Methodology only; the per-step contract, boundary, and verdict are
[README.md](README.md)'s.

It is NOT a rulebook (the `RULE-STD-BACKEND-3xx` and `RULE-STD-QUALITY-104` rules own every
must/never), NOT a design doc (the app's design docs explain its systems), and NOT a findings log.
Callable input/auth depth → `callable-functions-playbook.md`; notification topology →
`codebase-hygiene-playbook.md` step 50.

**Boundary notes.** Every check is an `rg` over local source or a local semantic review of the
handler. No step runs a full gate: the Functions test run is RULE-STD-QUALITY-002's one gate, run by
the repo's Normal Test Flow, and step 10 judges replay coverage against it. A targeted `-t` run that
cannot reach a dependency it needs is `BLOCKED`.

## When to run

Before launch; after adding or changing any webhook, trigger, scheduled function, queue-like
collection, retryable external call, or multi-write backend flow; after any duplicate, missing,
stuck, or inconsistent stored state is observed.

## Audit Steps

### 1. Inventory async entry points
**Rules:** the app's Functions architecture design doc (surface enumeration; feeds
the RULE-STD-BACKEND-3xx steps and RULE-STD-QUALITY-104). **Scope:** `functions/src`.
```bash
rg -n "export const \w+ = (onRequest|onDocumentCreated|onDocumentUpdated|onDocumentWritten|onObjectFinalized|onSchedule)" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** an enumeration of every async surface — webhooks, document and object triggers,
scheduled jobs, and the outbox and fanout drains. It scopes steps 2–10 and 12; a surface missed here
silently voids the later steps that range over it. The grep is `functions/src`-only: an app with
other deployed trees that hold async state (its additions name them) enumerates those too, at the
same bar (RULE-STD-ARCH-005).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. Map source and sink for every flow
**Rules:** RULE-STD-BACKEND-301, RULE-STD-BACKEND-302, RULE-STD-BACKEND-201. **Scope:**
`functions/src`. **Method (semantic review).**
**Expected:** for each flow, document the source event or document, every write it performs (stored
data, files, external services), its terminal states, its retry behavior, and its repair or
reconciliation path. A required-for-correctness effect with no atomic commit and no durable outbox is
a RULE-STD-BACKEND-302 gap; a best-effort post-commit effect carries the canonical post-commit marker
(RULE-STD-BACKEND-301). A trigger that branches on a client-writable field to perform a sensitive side
effect is a RULE-STD-BACKEND-201 violation. This map is the substrate for steps 3–9.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 3. Every re-deliverable handler is idempotent
**Rules:** RULE-STD-BACKEND-304. **Scope:** `functions/src`.
```bash
# Scope the locator to re-deliverable handlers, then look inside only those.
rg -l0 "retry: true|export const \w+ = onSchedule\(|export const \w+ = onRequest\(" functions/src -g '*.ts' -g '!*.test.ts' \
  | xargs -0 -r rg -n "\.create\(|ALREADY_EXISTS|already-exists|transaction\.get\(|\.exists\b"
```
**Expected:** this command is a LOCATOR, not a pass condition — a hit is a place to look, and an
absent hit in a re-deliverable handler is the signal. Semantically: every trigger, scheduled job,
webhook, and outbox or fanout drain that can be re-delivered is a safe no-op on redelivery — a
deterministic id with create-if-absent (`ALREADY_EXISTS` is the idempotent no-op), a compare-and-set
on a revision snapshot, or a pre-existence read; never an unguarded increment, append, or reservation
write. A lifecycle trigger that must not leak on transient failure carries `retry: true` and is
written to survive re-fire.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 4. No handler depends on exactly-once or in-order delivery
**Rules:** RULE-STD-BACKEND-304. **Scope:** `functions/src`. **Method (semantic review).**
**Expected:** no handler assumes an event arrives exactly once or in a fixed order — providers and
Firestore both retry and may reorder. A state transition tolerates a later event superseding an
earlier one; a money or count computation recomputes from cumulative provider fields, never by a
relative increment keyed off arrival order. **The four replay shapes, each a violation where
found:** a retried trigger that writes its event's `before`/`after` data as the new state instead of
re-reading the source's live state in its transaction; a cap, gate, or counter evaluated before the
idempotency check; a deterministic id derived from a key that can legitimately recur with no
occurrence identity in it; and an ordered step with no fence (version, generation, decision id).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 5. Every flow has an explicit terminal state — nothing stuck forever
**Rules:** RULE-STD-BACKEND-302, RULE-STD-QUALITY-104. **Scope:** `functions/src` + `src`.
**Method (semantic review).**
**Expected:** every multi-step flow (media processing, payments, reports, notifications, invites,
appeals) has explicit terminal states; no document remains permanently pending or processing without
cleanup, a durable retry, or admin visibility. A document left in a processing state after a failure
with no durable retry and no observable state is the violation.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 6. Partial-failure behavior is atomic or repairable
**Rules:** RULE-STD-BACKEND-302, RULE-STD-BACKEND-101. **Scope:** `functions/src`.
**Method (semantic review).**
**Expected:** for every multi-write handler, determine what persists if write 2 fails after write 1
succeeds. Required-for-correctness writes commit in one transaction or batch — every transaction read
before any write (RULE-STD-BACKEND-101) — or enqueue to the established durable outbox
(RULE-STD-BACKEND-302); a best-effort post-commit block never holds must-complete work. A two-write
handler with no transaction and no reconciliation path is the violation.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 7. External-service failures are caught, captured, and made durable
**Rules:** RULE-STD-BACKEND-307, RULE-STD-BACKEND-301, RULE-STD-ENG-009, RULE-STD-QUALITY-104.
**Scope:** `functions/src`.
```bash
rg -n "Post-commit side effect \(non-blocking\)" functions/src -g '*.ts' -g '!*.test.ts'
# Completeness: every file that cites the post-commit rule carries the exact canonical marker.
for f in $(rg -l "RULE-STD-BACKEND-301" functions/src -g '*.ts' -g '!*.test.ts'); do rg -q "Post-commit side effect \(non-blocking\)" "$f" || echo "NO CANONICAL MARKER: $f"; done
```
**Expected:** every external service is reached through its one app adapter
(RULE-STD-BACKEND-307), and every failure is caught, captured to monitoring, and — when user-visible
or required for correctness — converted to durable retry state, never swallowed. Each marker the
first grep prints sits directly above a real best-effort effect that logs and captures and never
rethrows; a marker with no effect, or a required effect hidden under one, is the violation. The
second command prints nothing: a file that reasons about the post-commit rule without the exact
marker is either a real best-effort effect that gains the canonical line, or prose that stops citing
the rule. An outage of a limiter or cache service fails legitimate operations with a defined error
path, never an opaque hang.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 8. Replays never duplicate side effects
**Rules:** RULE-STD-BACKEND-304, RULE-STD-BACKEND-306. **Scope:** `functions/src`.
```bash
rg -n "FieldValue\.increment|arrayUnion" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** a replay never duplicates money, a total, a notification, a report group, a message, a
media output, a vote, or a feed entry — each increment or append is guarded by the step-3
idempotency key. Notifications are created only through the app's sanctioned lanes
(RULE-STD-BACKEND-306; the app's additions name its lane entry points), so a retried trigger cannot
double-send. An unguarded `FieldValue.increment` in a retryable handler is the violation.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 9. Scheduled jobs are bounded, overlap-safe, isolated, and observable
**Rules:** RULE-STD-BACKEND-303, RULE-STD-BACKEND-304, RULE-STD-BACKEND-309, RULE-STD-BACKEND-112.
**Scope:** `functions/src`.
```bash
rg -l "export const \w+ = onSchedule\(" functions/src -g '*.ts' -g '!*.test.ts'
# Per-file attribution — how many `concurrency:` lines follow an onSchedule( in each file:
for f in $(rg -l "export const \w+ = onSchedule\(" functions/src -g '*.ts' -g '!*.test.ts'); do printf "%s %s\n" "$(rg -A12 'onSchedule\(' "$f" | rg -c 'concurrency:' || echo 0)" "$f"; done | sort
```
**Expected:** every scheduled job is bounded (query limits, batch caps), overlap-safe (`concurrency:
1` on any sweep, drain, or cascade — a heavy schedule with no `concurrency` line runs at the platform
default), logs counts changed, skipped, and errored, and never deletes valid recently-updated state.
Each independent pass runs in its own try/catch, each per-row loop isolates its rows, and a failing
row leaves the window instead of pinning an oldest-first query (RULE-STD-BACKEND-309,
RULE-STD-BACKEND-112; the locators are `codebase-hygiene-playbook.md` steps 98 and 105). Both
commands anchor on the export shape, so a comment mentioning `onSchedule` never enters the list. A
`0` in the second command is the finding unless the job is a documented, rarely-hit, read-only
exception; a file with two scheduled exports needs the per-handler read.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 10. Replay tests prove idempotency
**Rules:** RULE-STD-QUALITY-001, RULE-STD-BACKEND-304. **Scope:** `functions/src` tests.
```bash
# The replay-spec surface (a coverage question, not a gate):
rg -l "idempot|replay|redeliver" functions/src -g '*.test.ts'
# Run just those specs when a replay change is under review:
npx vitest run --root functions -t "idempot|replay|redeliver"
```
**Expected:** this step judges replay coverage, not green/red. Cross-reference the spec list against
the re-deliverable handler set from steps 1 and 3: each idempotent handler has a test that calls it
twice with the same input and asserts the final state is unchanged except for safe timestamps and
logs. A webhook or trigger fix ships a regression replay test that fails before the fix. A
re-deliverable handler with no replay test is the coverage gap.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 12. A scheduled cadence never depends on in-process state
**Rules:** RULE-STD-BACKEND-303, RULE-STD-QUALITY-104. **Scope:** `functions/src`.
```bash
rg -n "^let \w+ = 0;|EVERY_N_SWEEPS|sweepCounter" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** every scheduled job whose behavior varies across runs — a rare full scan, a periodic
reaper, a "once a day" pass inside a frequent sweep — derives that state from a persisted marker
document read and written through one owner, never module-level memory: instances recycle freely, so
a module-scoped counter resets on every cold start and the rare pass may never run. The finding is a
module-level counter that decides whether a pass runs, and a comment claiming a cadence the mechanism
cannot deliver is itself a finding. Classify each hit by whether losing the value changes whether the
work runs, not merely how fast.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Pass / Fail

Per [README.md](README.md) § Verdict. **PASS** — every async flow is idempotent, terminal, observable,
and repairable. **FAIL** — retries duplicate money, state, or notifications, a pending document can
get stuck forever, or an async failure is invisible.
