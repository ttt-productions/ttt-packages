# Performance Audit Playbook

## Purpose

One local, AI-run performance audit of the app and its Functions. It finds unbounded reads, missing
indexes, cache-key drift, cold-start weight, unmetered concurrency, N+1 access, and media or scheduled
jobs that can time out — verifying the performance-relevant shared rules (React Query, Functions
concurrency, bounded reads, media byte discipline). Methodology only; the per-step contract, boundary,
and verdict are [README.md](README.md)'s.

It is NOT a rulebook, NOT a design doc, NOT a human runbook, and NOT a findings log. Media correctness
→ `media-pipeline-playbook.md`; async correctness → `async-workflow-playbook.md`; read, write, and
egress cost-spike risk is the app's own cost audit.

**Boundary notes.** Hosted runtime measurement (step 10) and "is the index built in the deployed
project" are outside the local boundary and `BLOCKED` unless DJ authorizes them.

## When to run

Before launch; after adding a feed, list, admin view, query, scheduled job, or heavy function; after a
latency or memory incident.

## Audit Steps

### 1. Firestore query inventory
**Rules:** RULE-STD-BACKEND-112; the `<APP_DATA_PACKAGE>` schema and index registry. **Scope:** `src` +
`functions/src`. **Method (discovery — feeds steps 2–3).**
```bash
rg -n "collectionGroup\(|\bquery\(|\.where\(|\.orderBy\(|\.limit\(|\.startAfter\(|\.startAt\(" src functions/src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.ts' -g '!*.test.tsx'
```
**Expected:** a working inventory — for each query, its collection, filters, ordering, `limit`,
pagination cursor, and required composite index — with no query unclassified. Constraint builders
behind the query-core `useFirestore*` hooks are the sanctioned data layer. Not itself a pass/fail.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. Unbounded reads
**Rules:** RULE-STD-BACKEND-112. **Scope:** the app's feed, list, and admin surfaces in `src` +
`functions/src`. **Method (semantic review over the step-1 inventory).**
```bash
rg -n "collectionGroup\(" src functions/src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.ts' -g '!*.test.tsx'
```
**Expected:** every feed, list, admin, and collection-group read is bounded by a `limit()` with cursor
pagination or an intrinsically bounded predicate (a single-document read, an equality on a bounded
set). A full-collection scan on such a path is a FAIL; small fixed singleton collections and tightly
narrowed admin one-shots are known exceptions. **A bound is not enough on its own:** a recurring
sweep's window makes progress, a capped or unordered page is never shown as a total, a count, or an
"oldest", a client filter never empties a page while later pages hold matches, and no batch spans an
unbounded set — `codebase-hygiene-playbook.md` step 98 carries the locators.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 3. Composite index coverage
**Rules:** RULE-STD-BACKEND-112, RULE-STD-ENG-009. **Scope:** `firestore.indexes.json` (local file) +
the step-1 inventory.
```bash
<GUARD_SUITE> -t "every filtered collection-group query is index-backed"
rg -n "collectionGroup\(" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.ts' -g '!*.test.tsx'
```
**Expected:** every compound `where` + `orderBy` (or multi-field) query maps to a declared composite
index; single-field queries need none. A compound query with no matching index is a FAIL — it would
otherwise surface only in a deployed project. **The collection-group half is load-bearing:** every
filtered `collectionGroup(X).where(...)` needs a collection-group-scoped entry (a composite index, or a
field override carrying the collection-group scope); the automatic single-field index does NOT serve
it, and the emulator does not enforce indexes, so every local test stays green while the deployed
query fails. The guard holds this for the trees it scans and is green; any collection-group call site
outside its scan (the second command) is matched to an index by hand. A query that cannot run is
captured, never swallowed.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 4. React Query cache-key and freshness discipline
**Rules:** RULE-STD-FRONTEND-101, RULE-STD-FRONTEND-102, RULE-STD-FRONTEND-103. **Scope:** `src`.
```bash
<GUARD_SUITE> -t "every query key is a named builder in the one query-key module"
rg -n "invalidateQueries" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** the guard is green: each key is a named builder that includes every variable. Every query
carries an explicit `staleTime` or a `STALE_TIMES` preset, and no `invalidateQueries` runs on an
infinite-feed key — invalidating an infinite feed refetches every cached page; patch it in place. The
only sanctioned invalidation site is the domain-event registry. Cross-ref
`codebase-hygiene-playbook.md` steps 1–2.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 5. Public pages avoid heavy or private fetches
**Rules:** RULE-STD-FRONTEND-104, RULE-STD-FRONTEND-101. **Scope:** the app's public routes in
`src/app`. **Method (semantic review + direct-read tripwire).**
```bash
<GUARD_SUITE> -t "no component or route imports the Firestore runtime"
```
**Expected:** every public page renders from bounded React Query hooks and fetches only what the
initial view needs — no eager private, admin, or heavy query on a public path. Direct Firestore reads
exist only inside a `queryFn` or root-provider hydration.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 6. Cloud Functions cold-start weight and explicit concurrency
**Rules:** RULE-STD-BACKEND-303. **Scope:** `functions/src`.
```bash
rg -n "memory:|concurrency:|timeoutSeconds:|minInstances:" functions/src -g '*.ts' -g '!*.test.ts'
<GUARD_SUITE> -t "the codebase manifest deploys every function exactly once|light functions never statically reach a heavy module"
```
**Expected:** every heavy function (memory above the app's global default, media processing, or a
batch, cascade, or drain loop) carries an explicit `concurrency: 1`; light interactive functions never
statically import a heavyweight dependency — cold-start cost. Both guards are green. Hot stateless
callables at a measured higher concurrency, rarely-hit admin callables left unset, and `minInstances`
unset are the documented exceptions. Cross-ref `codebase-hygiene-playbook.md` steps 64 and 67.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 7. Media operations stay within memory and time limits
**Rules:** RULE-STD-BACKEND-303. **Scope:** the app's media-processing functions + `src`. **Method
(semantic review + resource-envelope search).**
**Expected:** media-processing functions carry `concurrency: 1` and a memory and timeout envelope
matched to the largest file the media specs allow, bound file size and type, and stream rather than
buffer a whole file where feasible — a function buffering a whole file into memory exceeds its ceiling
and is killed. Viewport-gated fetching (a video never pulls bytes before play) is
RULE-STD-MEDIA-101/102 → `codebase-hygiene-playbook.md` step 59.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 8. Scheduled and batch jobs page and bound their scans
**Rules:** RULE-STD-BACKEND-303, RULE-STD-BACKEND-304, RULE-STD-BACKEND-112, RULE-STD-QUALITY-104.
**Scope:** `functions/src` schedules and drains.
```bash
rg -l "onSchedule" functions/src -g '*.ts' -g '!*.test.ts'
rg -n "\.limit\(|batchSize|pageSize|startAfter" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** every scheduled job and drain reads in bounded pages, logs progress, and carries
`concurrency: 1`; a full-collection scan with no page bound every run is a FAIL. Cross-ref
`codebase-hygiene-playbook.md` steps 33, 50, and 67.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 9. N+1 read/write patterns
**Rules:** RULE-STD-BACKEND-113, RULE-STD-ARCH-003. **Scope:** `functions/src` + `src`. **Method
(semantic review).**
```bash
rg -n "for .*of |\.map\(async|for await" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** a per-iteration read or write over an unbounded set is batched — `getAll`, a chunked
`in` query, a chunked `Promise.all`, or a batch — never a `get` or `set` inside a loop; cross-domain
composition imports the owning core and passes the transaction handle, never a server-side callable
loop. A fixed-N loop over a small constant set is fine. RULE-STD-BACKEND-113's one authorized exception
— per-document reads on a collection whose rules gate on stored fields — still rides shared caching,
in-flight deduplication, and bounded concurrency; a bare sequential `await` loop is a FAIL even there,
and a rule weakened so a batch query passes is a FAIL the other way.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 10. Runtime measurement (hosted — authorization required)
**Rules:** no dedicated rule — hosted runtime performance is owned by the app's hosted end-to-end
suite and its pre-launch audit. **Scope:** hosted dev or production (or the local `dev:e2e` build for
structural-only timing). **Method (`BLOCKED` by default).**
**Expected:** under DJ's explicit authorization, each launch-critical flow meets its recorded p95
target and streams media bytes only after a play click. `BLOCKED` unless authorized; never counted as
PASS while unrun.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Pass / Fail

Per [README.md](README.md) § Verdict.
