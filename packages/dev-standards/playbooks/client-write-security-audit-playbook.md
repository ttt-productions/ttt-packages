# Client Write Security Audit Playbook

## Purpose

Audit every client-originated write to persisted state and prove it is safe under the actual rules
files and the backend architecture. Two surfaces: the client-side Firestore and Storage writes from
`src` (steps 1–9), and the app's privileged request handlers the client posts to (step 11), which
execute Admin-SDK writes with no rules layer in front of them (RULE-STD-BACKEND-012). It verifies the
frontend half of the backend security boundary (RULE-STD-FRONTEND-107 mirrors
RULE-STD-BACKEND-201). Methodology only; the per-step contract, boundary, and verdict are
[README.md](README.md)'s.

It is NOT a rulebook and NOT a findings log. Rules depth → `firestore-storage-rules-playbook.md`;
state-drift depth → `data-integrity-playbook.md`.

**Boundary notes.** Searches read local `src` and the local rules files; the negative rule tests
(step 9) run against the user-started emulators, else `NOT RUN`.

## When to run

Before launch; after adding any client `setDoc`, `updateDoc`, `addDoc`, `deleteDoc`, Storage upload or
delete, or mutation hook; after changing a rules file.

## Audit Steps

### 1. Inventory client writes
**Rules:** RULE-STD-FRONTEND-107, RULE-STD-FRONTEND-104, RULE-STD-BACKEND-106. **Scope:** `src`,
excluding the server-module trees (`<SERVER_MODULE_GLOBS>`) and test code.
```bash
rg -n "setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction|uploadBytes|uploadString|deleteObject" src -g '*.ts' -g '*.tsx' <SERVER_MODULE_GLOBS> -g '!src/test/**' -g '!**/__tests__/**' -g '!*.test.ts' -g '!*.test.tsx'
```
**Expected:** every printed line is classified. Server-module code running inside a request handler is
Admin-SDK backend code, audited by step 11 and `auth-boundary-playbook.md` step 12, never a client
write. Components never import runtime Firestore write operations (RULE-STD-FRONTEND-104); content
and sensitive writes route through callables (RULE-STD-BACKEND-106, RULE-STD-FRONTEND-107). Where the
app's invariant is zero client Firestore writes, any Firestore write this command prints is a
re-introduction and the finding. This inventory feeds steps 2–9.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. Classify each write
**Rules:** RULE-STD-FRONTEND-107, RULE-STD-BACKEND-106, RULE-STD-ENG-006. **Scope:** `src`.
**Method (semantic review).**
**Expected:** for every write from step 1 record path, fields, user action, actor, whether it should
be client-writable at all, and whether a callable would be safer. A user's own privilege-free edits
may be client writes; anything touching moderated content, money, roles or status, or another user's
state routes through a callable. A write that cannot be made safe with clear, minimally scoped rules
is recorded as a recommended migration behind a callable. With no client Firestore write in step 1,
this step is `NOT RUN` on the Firestore half.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 3. Compare each write against the rules
**Rules:** RULE-STD-BACKEND-109. **Scope:** `src` ↔ `firestore.rules` / `storage.rules`.
**Method (semantic review).** Rules depth → `firestore-storage-rules-playbook.md`.
**Expected:** conditional on step 1 returning a non-empty client Firestore write set; with none, this
step is `NOT RUN`, never PASS — a vacuous PASS reads as evidence that a comparison happened. When
writes exist: each write path's rule enforces exactly the intended actor and field set — an owner
check plus a client-writable-field allowlist (`affectedKeys().hasOnly([...])`) with every other field
backend-only, or the write is callable-only. A rule broader than the write it guards is a finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 4. Flag sensitive fields
**Rules:** RULE-STD-BACKEND-201, RULE-STD-FRONTEND-107, RULE-STD-BACKEND-209. **Scope:** `src`.
```bash
rg -n "Partial<Full\w+>" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** no client write context writes a sensitive field — admin flags, role or status,
ownership, shares or roles, counters, payment or moderation status, processed media paths, report or
admin status, trusted timestamps, or a notification side effect (the app's additions carry its
sensitive-field locator). A `Partial<…>` of a full document type forwarded into a client mutation is a
RULE-STD-BACKEND-209 violation — add a named mutation with a known field set.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 5. Check spoofed IDs
**Rules:** RULE-STD-ARCH-106, RULE-STD-BACKEND-005, RULE-STD-BACKEND-102. **Scope:** `src` ↔ rules.
**Method (semantic review).**
**Expected:** every user, resource, message, reply, or report id in a document path or body is bound
to `request.auth.uid` or to server-verified membership — a path segment carrying the uid while the
body carries a different owner or sender is an impersonation hole. A client-chosen document id is
written with create semantics, never a bare overwrite of an existing document.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 6. Check aggregate writes
**Rules:** RULE-STD-BACKEND-103, RULE-STD-BACKEND-201. **Scope:** `src`. Truth-drift depth →
`data-integrity-playbook.md`.
```bash
rg -n "arrayUnion|arrayRemove|increment|\.\.\.\w+\]|\.filter\(" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** for arrays, counters, and summaries the client cannot drift data or bypass a
transaction. A field with concurrent writers is mutated with `arrayUnion` / `arrayRemove`, never a
client read-modify-write. Follow, like, and vote patterns are duplicate- and undo-safe. Counters and
derived summaries are backend-owned — a client-incremented count that can drift with no recompute
path is a finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 7. Check file uploads
**Rules:** RULE-STD-MEDIA-002, RULE-STD-MEDIA-004. **Scope:** `src` + `storage.rules`. Rules depth →
`firestore-storage-rules-playbook.md` step 9.
```bash
rg -n "uploadBytes|uploadString|deleteObject" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** every Storage write enforces the authenticated uid, a concrete media content type, the
per-origin size cap, and the canonical origin — temp uploads follow the canonical upload path and go
only there; final and processed paths are backend-write-only. The client never supplies an
authoritative target path. A direct-upload path outside the pipeline exists only as a documented,
create-only, attested exception with every read denied (the app's additions name its exceptions); a
new one, or a read grant on one, is the finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 8. Check migration-sensitive writes
**Rules:** RULE-STD-ARCH-101, RULE-STD-ARCH-102, RULE-STD-ENG-011. **Scope:** `src`.
**Method (semantic review).**
**Expected:** during a schema change, client writes emit only the new canonical shape or dual-write
with a documented cutover. Written shapes derive from the canonical `<APP_DATA_PACKAGE>` schema,
never a hand-shaped local literal. A client write emitting a half-migrated shape with no documented
dual-write is a finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 9. Negative rule tests
**Rules:** RULE-STD-QUALITY-001, RULE-STD-BACKEND-120. **Scope:** the rules tests.
```bash
npm run test:rules
```
**Expected:** green against the user-started emulators, with a negative test for every risky client
write — wrong user, spoofed field, protected-field change, oversized or wrong-type file,
unauthenticated user, member vs non-member. Every rules test builds its environment through the app's
one harness against an isolated test project; fixtures seed through `withSecurityRulesDisabled` and no
access assertion runs inside it. A risky client write with no negative test is a finding. `NOT RUN`
without the emulators.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 11. The HTTP client-write surface: privileged request handlers
**Rules:** RULE-STD-BACKEND-012, with RULE-STD-BACKEND-002, RULE-STD-BACKEND-005,
RULE-STD-ARCH-106, RULE-STD-ENG-006. **Scope:** the app's privileged request handlers and the server
modules they run (the app's additions name the trees). Auth-mechanism depth →
`auth-boundary-playbook.md` step 12; this step is the write half.
**Expected:** for each Admin-SDK write a handler performs: identity is proven server-side — from a
verified token or an attestation, never the payload; input is parsed by a strict schema composed from
`<APP_DATA_PACKAGE>` before any value is used; and the write set is minimal — only the fields that
entry point owns, never a spread of the request body. A raw body value reaching a cast and then an
Admin-SDK write is the finding — a cast is not validation.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Pass / Fail

Per [README.md](README.md) § Verdict. **PASS** — every client write is intentionally allowed, minimally
scoped by rules, and covered by negative tests. **FAIL** — any client can spoof identity, mutate
sensitive state, bypass moderation, payment, or admin logic, or corrupt aggregate data.
