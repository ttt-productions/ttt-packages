# Migration Playbook

## Purpose

Ensure Firestore, Storage, schema, and rules migrations are safe, idempotent, observable, and
recoverable — verifying a migration obeys the cross-boundary contract rules, the package-adoption
rules (RULE-STD-ARCH-204, RULE-STD-ARCH-205), the live-data rule (RULE-STD-ENG-011, once
`<HOLDS_LIVE_DATA>` is yes), and the backend write, idempotency, and rules rules it touches.
**Scripts are in scope, by rule:** RULE-STD-BACKEND-114 makes a script that writes a real project
backend write code — canonical paths, no hand-copied projection, an explicit target project, a
dry-run, idempotent — and living in a scripts folder is no exemption from the write-boundary audits.
It binds steps 1, 5, 6, and 10. Methodology only; the per-step contract, boundary, and verdict are
[README.md](README.md)'s.

It is NOT a rulebook, NOT a design doc (the schema model lives in the `<APP_DATA_PACKAGE>` schema
registry and the app's design doc for it), and NOT a findings log. Local schema-vs-data drift is also
`codebase-hygiene-playbook.md` step 51; a hosted dev↔prod comparison is owned by
`data-integrity-playbook.md`.

## When to run

Before and after any change to a stored shape, a document id convention, a custom claim, a Storage
path, or a rules file that existing data depends on; before running any data-writing script.

## Audit Steps

### 1. Define migration scope
**Rules:** RULE-STD-ARCH-101, RULE-STD-BACKEND-114. **Scope:** the app and `<PACKAGES_REPO>`,
including scripts. **Method (semantic enumeration over the app's field-lineage report —
`field-lineage-playbook.md` step 1).**
**Expected:** an enumeration, not a pass/fail — it feeds steps 2–10. List every affected collection,
subcollection, Storage path, rules block, function, hook, test, shared-package helper, index, and
data-writing script. Cross-boundary shapes are owned by `<APP_DATA_PACKAGE>`, so its schema registry
and the field-lineage report are the source of truth for what a field is and where it lives — a scope
built from the code alone misses a consumer. **Confirm the report's walk covers every source root the
migrated concept can reach**; a root outside it is a silent scope hole. Every runner the report
surfaces is backend write code under RULE-STD-BACKEND-114, checked in steps 5 and 6.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. Classify migration type
**Rules:** RULE-STD-ARCH-001, RULE-STD-ARCH-002, RULE-STD-BACKEND-114. **Scope:** the migration
surface. **Method (semantic classification).**
**Expected:** name the type — batch script, callable repair, trigger mirror, lazy migration on read or
write, dual-write and cutover, rules-only change, or manual admin operation. Whichever it is, the
migration write has ONE authoritative owner and entry points are thin adapters over it — a migration
never becomes a second writer for a state a core already owns. A batch script recomputes a
projection, counter, or derived document by reusing the owning core's computation, never a second
hand-written copy of its shape. The type decides which of steps 3–9 bind hardest.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 3. Check backward compatibility
**Rules:** RULE-STD-ENG-011, RULE-STD-ARCH-204, RULE-STD-ARCH-205. **Scope:** the reading code (`src`
+ `functions/src`) + the `<APP_DATA_PACKAGE>` schema. **Method (semantic review).**
**Expected:** new reads tolerate old data until the migration completes, and old reads do not break
during a rollout whose code and data deploys are not simultaneous. Once `<HOLDS_LIVE_DATA>` is yes,
every persisted-shape change ships its migration and, where it runs against live documents before the
migration completes, a read path tolerating both shapes (RULE-STD-ENG-011). An adoption wrapper keeps
the call-site shape (new optional fields fine; renames and removals not) with all translation inside
the wrapper; the on-disk shape may differ only under the app's stated latitude (RULE-STD-ARCH-204). A
package-owned shape change lands in ttt-packages and is published before the app adopts it — never
adopted against sibling source (RULE-STD-ARCH-205).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 4. Check write cutover
**Rules:** RULE-STD-ARCH-001, RULE-STD-ARCH-204. **Scope:** the writing code. **Method (semantic
review).**
**Expected:** the migration names exactly when old writes stop and new writes start. During any
dual-write window, ONE side is declared authoritative and mismatches have a defined repair path — two
writers for one state with no reconciliation is the parallel-owner failure. Translation stays inside
the adoption wrapper, never leaked to call sites.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 5. Check idempotency
**Rules:** RULE-STD-BACKEND-304, RULE-STD-BACKEND-102, RULE-STD-BACKEND-103, RULE-STD-BACKEND-114,
RULE-STD-ENG-011. **Scope:** the migration script, callable, or trigger. **Method (semantic review).**
**Expected:** running the migration twice is a safe no-op — it never corrupts data, duplicates
documents, double-increments counters, or overwrites newer user changes. Writes at a client-chosen id
use `.create()` or `.set(..., { merge: true })`, never a bare `.set()` that silently overwrites
(RULE-STD-BACKEND-102 — scoped exactly as written: "client-chosen" or caller-reconstructable, not
merely "known"; a full-payload mirror at a server-derived id, where total overwrite is the point, is
not a violation); concurrent arrays use `arrayUnion` / `arrayRemove`; re-runs guard on a deterministic
id with create-if-absent, a compare-and-set, or a pre-existence read. A script runner reuses the owning
core's computation rather than hand-copying a projection, since nothing downstream validates one.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 6. Check batching, progress, and resumability
**Rules:** RULE-STD-QUALITY-104, RULE-STD-BACKEND-114, RULE-STD-BACKEND-302, RULE-STD-BACKEND-304,
RULE-STD-BACKEND-303, RULE-STD-BACKEND-112. **Scope:** the migration runner. **Method (semantic
review).** Deep async → `async-workflow-playbook.md`.
**Expected:** two halves, and only one applies to a given migration.

**Script-runner half (RULE-STD-BACKEND-114, RULE-STD-QUALITY-104).** The runner pages and batches
safely, avoids unbounded reads, persists a cursor or checkpoint so a large job resumes after a partial
failure, and logs progress with recoverable state. It takes its target project explicitly at
invocation (never a project id in source), takes its credential from the one owner, supports a
dry-run, is idempotent and safe to re-run, and takes collection names and paths from the canonical
`<APP_DATA_PACKAGE>` constants. An unbounded read with no checkpoint in a runner documented for a
production run is the finding. A recompute or repair writes absolute values and visits every derived
document that EXISTS — the source's keys unioned with the derived documents already stored — so a
stored counter whose source is gone is compared and rewritten too.

**Scheduled-sweep half (RULE-STD-BACKEND-303)** — only when the migration runs as a scheduled sweep:
it sets `concurrency: 1` explicitly. A script runner has no such setting and is not judged against it.

Both halves: work the migration must complete commits in its own batch or transaction or rides the
durable outbox, never a best-effort block whose throw silently drops it; each resumed batch is
idempotent.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 7. Check rules timing
**Rules:** RULE-STD-BACKEND-109, RULE-STD-ENG-006. **Scope:** both rules files. Deep →
`firestore-storage-rules-playbook.md`. **Method (semantic review of the rules change and its deploy
ordering).**
**Expected:** rules are not tightened before every client and function uses the new paths, and rollout
order does not break reads or writes. A migration never opens broad writes as a shortcut: a bare
signed-in create or write on a collection holding a sensitive field is a violation — add an owner
check, a size limit, and a client-writable-field allowlist, or route the write through a callable.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 8. Check validation before delete
**Rules:** RULE-STD-ARCH-102, RULE-STD-BACKEND-115. **Scope:** the local emulator (default); hosted dev
(authorization required).
```bash
# LOCAL (needs the user-started emulators + seed): data matches schema.
npm run seed:emulator && npm run drift:check:local
```
**Expected:** before removing any old field or document, prove the migration completed — the drift
check reports zero invalid documents and zero unknown fields against the `<APP_DATA_PACKAGE>` schema
registry. Query counts and sample records confirm the new shape is fully populated, and rollback data
is kept until DJ's go. **Hosted half — `BLOCKED` unless DJ authorizes it:** the hosted drift variant
runs only under `data-integrity-playbook.md`.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 9. Check rollback / repair
**Rules:** RULE-STD-ENG-009, RULE-STD-BACKEND-203. **Scope:** the migration plan. **Method (semantic
review).**
**Expected:** a rollback, restore, or repair path is documented before the migration runs — a
migration whose one attempt can fail with no recovery route violates the fail-truthfully posture.
"Reset test data" is an acceptable recovery ONLY while `<HOLDS_LIVE_DATA>` is no and DJ has explicitly
decided it. A backup, restore, or migration path never rewrites audit documents
(RULE-STD-BACKEND-203). The durable backup and restore mechanics are owned by the app's own backup
audit.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 10. Add migration tests
**Rules:** RULE-STD-QUALITY-001, RULE-STD-QUALITY-004, RULE-STD-BACKEND-114, RULE-STD-BACKEND-120.
**Scope:** the app's tests + rules tests. Deep → `testing-coverage-playbook.md`. **Method (semantic
review of existing tests).**
**Expected:** the migration ships tests covering old-only, new-only, and mixed documents, a duplicate
run, partial failure and retry, and rules after cutover. **Duplicate-run is the mandatory case for a
script runner** — a one-shot that touches a real project has no rules, no callable, and no review path
in front of it, so its test is the only proof it can be re-run; a runner with no spec, or whose pure
compute step is not extracted so it can be tested without the Admin SDK, is a coverage finding. A
positive rules test builds its environment through the app's one harness, never a real project id,
and never asserts inside `withSecurityRulesDisabled`. E2E coverage uses the established fixtures and
web-first assertions.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Pass / Fail

Per [README.md](README.md) § Verdict. **PASS** — the migration is scoped, backward-compatible,
idempotent, tested, observable, and has a rollback or repair path. **FAIL** — the deployment order can
break reads or writes, the migration can corrupt data, or it leaves no recovery path.
