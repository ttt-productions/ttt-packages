# Data Integrity Playbook

## Purpose

Audit whether the app's data stays correct across client writes, callables and triggers, webhooks,
caches and limiters, Storage media processing, account erasure, and the shared path and type helpers.
This is about **truth and consistency**, not only security: it verifies the where-data-lives rules —
RULE-STD-ARCH-001 (one authoritative owner per state transition), RULE-STD-ARCH-101
(`<APP_DATA_PACKAGE>` owns cross-boundary contracts), and RULE-STD-ARCH-103 (persist identity
references, not snapshots). Methodology only; the per-step contract, boundary, and verdict are
[README.md](README.md)'s.

It is NOT a rulebook and NOT a findings log. Client-write depth → `client-write-security-audit-playbook.md`;
rules depth → `firestore-storage-rules-playbook.md`.

**Boundary notes.** The local schema-drift check (step 7) runs against the user-started emulators; an
unreachable emulator is `NOT RUN`, never a zero-drift PASS. This playbook is also the sanctioned owner
of the hosted comparisons other audits delegate here — a hosted dev↔prod document comparison and any
provider-dashboard reconciliation — and those run ONLY with DJ's explicit in-conversation
authorization; without it they are `BLOCKED`. No step runs a full gate.

## When to run

Before launch and before real users or payments; after changing a rules file, `functions/src/**`, a
shared path helper, or any stored schema; before and after a migration; any time UI state, stored
state, and backend state disagree.

## Audit Steps

### 1. Inventory persisted write paths
**Rules:** RULE-STD-ARCH-001, RULE-STD-BACKEND-106, RULE-STD-BACKEND-201. **Scope:** `src` +
`functions/src`.
```bash
# (a) The pass/fail signal — client-side persisted writes:
rg -n "setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction" src -g '*.ts' -g '*.tsx' <SERVER_MODULE_GLOBS> -g '!src/test/**' -g '!**/__tests__/**' -g '!*.test.ts' -g '!*.test.tsx'
# (b) The backend inventory — a scoping note for the later steps:
rg -n "setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** (a) is the pass/fail half: every client persisted write is classified against
`client-write-security-audit-playbook.md`, and where the app's invariant is zero client writes, any
printed line is a re-introduction and the finding. (b) is an inventory, not a step to pass: record it
as the scoping note and move on. The invariant it feeds: every durable state transition has exactly
one authoritative writer, so two files writing one domain's state is drift.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. Classify the source of truth per domain
**Rules:** RULE-STD-ARCH-001, RULE-STD-ARCH-101, RULE-STD-ARCH-103. **Scope:** `src` + `functions/src`
+ the `<APP_DATA_PACKAGE>` document schemas. **Method (semantic review).**
**Expected:** name the single authority for each domain the app stores (the app's additions list its
domains). Cross-boundary shapes come from `<APP_DATA_PACKAGE>`; identity is stored as a uid reference,
never a name or avatar snapshot. A domain with two authorities is a finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 3. Find duplicate / drifting truth
**Rules:** RULE-STD-ARCH-001, RULE-STD-ENG-002. **Scope:** `functions/src` + `src`.
**Method (semantic review over the app's retired-shape tripwire grep, in its additions).**
**Expected:** inspect aggregate-array and map patterns — follow arrays, membership id arrays,
member-subcollection role and share state, counters, summaries, recent-feed documents — and for each
duplicated value identify its repair or recompute path. A retired document shape must stay dead: a
live backend authority read of a retired field, or a persisted field of that name, is a truth-drift
finding. A frontend derivation that reads the correct authority is expected, not a finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 4. Client-writable docs vs sensitive fields
**Rules:** RULE-STD-BACKEND-201, RULE-STD-FRONTEND-107. **Scope:** `src` ↔ `firestore.rules`.
Deep → `client-write-security-audit-playbook.md` step 4.
**Expected:** for every client write, compare with `firestore.rules`. Sensitive fields — role, status,
and admin flags, ownership, shares, moderation and payment state, counters, media-processing status,
report and admin status, and the public/private profile split — are never client-written.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 5. Atomicity of multi-document changes
**Rules:** RULE-STD-ARCH-001, RULE-STD-BACKEND-101. **Scope:** `functions/src`.
**Method (semantic review).**
**Expected:** every multi-document update uses a transaction, a batch, deterministic ids, or a
documented repair path. Atomic state transitions stay in one transaction under one owner; transaction
bodies do every read before any write. A document that flips to a final state while a coupled Storage
copy or update can still fail separately is a finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 6. Idempotency of re-run work
**Rules:** RULE-STD-BACKEND-304. **Scope:** `functions/src`.
```bash
rg -n "onDocumentCreated|onDocumentWritten|onDocumentUpdated|onSchedule|constructEvent|webhook" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** re-running the same callable, trigger, webhook, or outbox drain never duplicates money,
votes, notifications, membership entries, report groups, media outputs, or task state. Each
re-deliverable surface is idempotent — a deterministic id with create-if-absent, a compare-and-set on
a revision snapshot, or a pre-existence read — never an unguarded increment or append. A webhook
replay that double-increments a total is a finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 7. Schema compatibility and local drift
**Rules:** RULE-STD-ARCH-101, RULE-STD-ARCH-102, RULE-STD-BACKEND-115, RULE-STD-ENG-011. **Scope:**
`src` + `functions/src`; the local emulator.
```bash
# Local data-vs-schema drift — emulator reachability guard FIRST (Git Bash has no `nc`).
if (exec 3<>/dev/tcp/127.0.0.1/9099) 2>/dev/null && (exec 3<>/dev/tcp/127.0.0.1/8080) 2>/dev/null; then
  npm run seed:emulator && npm run drift:check:local
else
  echo "NOT RUN: Auth 9099 / Firestore 8080 unreachable — the emulators are user-started"
fi
```
**Expected:** every cast of stored data targets a canonical `<APP_DATA_PACKAGE>` type, never a
hand-rolled local shape — a cast to a type declared in the same file is the finding; parse the schema
instead (the app's additions carry its cast locator). Reads survive old documents: a read that assumes
a migrated field exists on every old document is a finding, and once `<HOLDS_LIVE_DATA>` is yes a
shape change ships its migration or a tolerant read (RULE-STD-ENG-011). When the emulators are
reachable, the drift check reports zero invalid documents and zero unknown fields against the seeded
emulator. **Hosted half (authorization required):** the hosted drift variant and the dev↔prod
comparison are `BLOCKED` without DJ's authorization.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 8. Shared path / type helpers
**Rules:** RULE-STD-ARCH-104, RULE-STD-ARCH-101. **Scope:** `src` + `functions/src` (+ the rules files'
values).
```bash
<GUARD_SUITE> -t "no Firestore path is assembled by hand|no typed path segment reaches a Firestore accessor"
rg -n "collection\(db,\s*[\"']|doc\(db,\s*[\"']" src functions/src -g '*.ts' -g '*.tsx'
```
**Expected:** the guards are green and the grep prints nothing — collection names and paths come from
the canonical `<APP_DATA_PACKAGE>` constants and path builders, and the rules files use the same
constants' values. Cross-boundary types and unions import from `<APP_DATA_PACKAGE>`, never a
re-declared local copy. A shared path helper that changed while a rule or function still uses the old
literal is a finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 10. Cache and limiter stores are never the durable truth
**Rules:** RULE-STD-BACKEND-307, RULE-STD-BACKEND-302, RULE-STD-QUALITY-104. **Scope:**
`functions/src`. **Method (semantic review over the app's cache/limiter adapter call sites).**
**Expected:** a cache or rate-limit store is reached only through its one app adapter and may limit or
cache — it is never the sole durable source of user, payment, or resource state. Its outage behavior
is explicit and user-safe (fail-closed, or a documented safe degradation), never a silent loss of
required state.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 13. Account-erasure completeness
**Rules:** RULE-STD-ENG-009, RULE-STD-BACKEND-304, RULE-STD-ARCH-103, RULE-STD-BACKEND-112. **Scope:**
the app's account-erasure scrub and its worker + the `<APP_DATA_PACKAGE>` collection registry (the
app's additions name the files). An app with no account erasure records `NOT RUN`.
```bash
<GUARD_SUITE> -t "no backend read or write has its failure swallowed|every filtered collection-group query is index-backed"
```
**Expected:** build the **erasure obligations inventory** and prove where each is discharged. For every
stored collection that holds a user reference — the identity-field set is `field-lineage-playbook.md`
step 3's, which is this step's precondition — name the disposition (deleted, anonymised, or
deliberately retained with a stated legal basis) and confirm the scrub implements it, ideally through
a declared fate per collection held to the scrub's steps by a test. **A collection storing an identity
field that appears in no scrub predicate is an uncovered obligation.** Two failure shapes carry the
weight, and both guards above are green: a swallowed failure on an erasure path is a Critical
finding — each discovery read captures and marks its obligation pending so the request stays
non-terminal; and a `collectionGroup` query with no collection-group index fails closed in every
deployed project while passing locally (the emulator does not enforce indexes).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Pass / Fail

Per [README.md](README.md) § Verdict. **PASS** — every durable field has one authority, multi-document
changes are atomic or repairable, duplicate execution is safe, and old documents are readable.
**FAIL** — important state can drift, be client-spoofed, duplicate on retry, or become unrecoverable
after a partial failure.
