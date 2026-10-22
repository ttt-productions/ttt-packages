# Firestore and Storage Rules Playbook

## Purpose

Audit `firestore.rules` and `storage.rules` as executable security and data-integrity contracts —
proving every read and write grant names an intended actor, protects immutable and sensitive fields,
and is covered by emulator tests. It verifies the rules-layer expression of the backend security
boundary. Methodology only; the per-step contract, boundary, and verdict are
[README.md](README.md)'s.

It is NOT a rulebook, NOT a design doc, and NOT a findings log. Client-write depth →
`client-write-security-audit-playbook.md`; state-drift depth → `data-integrity-playbook.md`;
singleton audience placement → `codebase-hygiene-playbook.md` step 56.

**Boundary notes.** Every check reads the local rules files; the rules tests (step 10) need the
user-started emulators, else `NOT RUN`.

## When to run

Before launch; after any rules change; after adding a collection, subcollection, or Storage path.

## Audit Steps

### 1. Enumerate every allow rule (build the matrix)
**Rules:** RULE-STD-BACKEND-109, RULE-STD-ARCH-104; the `<APP_DATA_PACKAGE>` collection registry (the
inventory each row is scored against). **Scope:** `firestore.rules` + `storage.rules`.
```bash
rg -n "match /|allow " firestore.rules storage.rules
<GUARD_SUITE> -t "the Firestore rules mirror the core exactly"
```
**Expected:** a complete matrix — for every `match` path: read rule, create/update/delete rule,
allowed actor, protected or immutable fields, and test coverage. This enumeration is the input to
steps 2–12. The registry cross-check runs in both directions: every collection the registry declares
has its own explicit rule block (the repo-guards rules-mirror guard, green), and a top-level rule
block for a collection the registry does not know is always a finding to classify — an unregistered
collection sits outside the drift check, the schema-doc generation, and the erasure inventory, so it
is either registered or its block retired. (The app's additions carry its hand-diff commands until a
guard holds both directions.)
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. No broad `allow write`; split by operation
**Rules:** RULE-STD-BACKEND-109, RULE-STD-BACKEND-201. **Scope:** both rules files.
```bash
rg -n "allow write" firestore.rules storage.rules
```
**Expected:** a combined `allow write` on a collection whose create, update, and delete grants differ
is a finding — split into `allow create` / `update` / `delete`. An owner-writable document protects
its immutable and sensitive fields (step 7). A bare `allow write: if request.auth != null` on a
collection holding any sensitive field is almost always wrong — add an owner-field check, a size
limit, AND a client-writable-field allowlist, or route the write through a callable.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 4. Helper trust and escalation
**Rules:** RULE-STD-ENG-006, RULE-STD-BACKEND-108, RULE-STD-BACKEND-109, RULE-STD-BACKEND-004.
**Scope:** both rules files. **Method (semantic review).**
**Expected:** inspect every rules helper and every `get()` a rule makes — the document a helper reads
to make an authorization decision must NOT be writable by the same user in an escalating way. Admin
and role authority resolves from server-written state (the live roster in the signed-in bucket,
written only by callables), never a client-editable field; a badge claim is checked together with the
live roster, never alone. A membership helper deciding authority from a client-mutable field or a
denormalized copy of the membership is the finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 5. Collection query / list safety
**Rules:** RULE-STD-BACKEND-105, RULE-STD-BACKEND-108, RULE-STD-ENG-006. **Scope:** `firestore.rules`.
```bash
rg -n "allow list|allow read" firestore.rules
```
**Expected:** every `list` and `read` grant exposes only the documents the UI legitimately queries and
never another user's private data — a `list` grant where only `get` was intended, or a read that
returns PII-bearing documents to non-owners, is a finding. **Readable is published
(RULE-STD-BACKEND-105):** a document reachable by `read` or `list` carries no field the reader may not
see; private fields live in the private subcollection. A readable document that has quietly acquired
one is caught here, because a read grant publishes a field no allowlist constrains. Every `list`
boundary has a negative test for the unauthorized query (step 10).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 6. Create invariants bind identity to the caller
**Rules:** RULE-STD-ARCH-106, RULE-STD-BACKEND-005, RULE-STD-BACKEND-102. **Scope:** both rules files.
```bash
rg -n "allow create" firestore.rules storage.rules
```
**Expected:** for every user-generated document the create rule binds the identity field to
`request.auth.uid` — owner, reporter, applicant, sender, and the Storage upload uid. A client-supplied
identity not matched to `request.auth.uid` is an impersonation primitive. A create at a client-chosen
id asserts create semantics, never an overwrite of an existing document.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 7. Update invariants protect immutable/sensitive fields
**Rules:** RULE-STD-BACKEND-201, RULE-STD-BACKEND-109, RULE-STD-FRONTEND-107. **Scope:**
`firestore.rules`.
```bash
rg -n "allow update" firestore.rules
```
**Expected:** an owner-writable update never lets the user change owner ids, created timestamps,
payment or moderation status, counters, admin notes, processed media paths, or role and share maps
unless explicitly intended. Every such field is pinned immutable (`request.resource.data.X ==
resource.data.X`), excluded from a `diff(resource.data).affectedKeys().hasOnly([...])` allowlist, or
lives in a backend-only document. The rule is the last line; the write itself should already route
through a callable.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 8. Delete invariants are explicit
**Rules:** RULE-STD-BACKEND-109, RULE-STD-BACKEND-201, RULE-STD-BACKEND-106, RULE-STD-BACKEND-203.
**Scope:** both rules files.
```bash
rg -n "allow delete" firestore.rules storage.rules
```
**Expected:** every destructive delete is explicit — denied (`if false`), owner-only, admin-only, or
function-only. A broad `allow delete: if request.auth != null` on a content or sensitive collection is
a finding; content deletes route through a callable for moderation and audit. Audit events are
append-only — every client update and delete is `if false`.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 9. Storage path invariants (the upload path law)
**Rules:** RULE-STD-MEDIA-002, RULE-STD-MEDIA-001, RULE-STD-MEDIA-004. **Scope:** `storage.rules`.
```bash
rg -n "match /|allow (read|write|create)|request.resource" storage.rules
<GUARD_SUITE> -t "the Storage rules restate the upload-origin registry exactly"
```
**Expected:** temp uploads match the canonical upload path shape (origin, uid, upload id — no
extension); the final segment is the client-generated id the upload callable adopts. The Storage rules
enforce the path SHAPE, the per-origin size cap (an unknown origin fails closed to zero), and a
concrete media content-type pattern plus the neutral lane for unknown picker metadata (the server's
byte inspector classifies). The origin allowlist and strict path equality are callable-only
(RULE-STD-MEDIA-002) — rules enforcing the origin allowlist is itself a finding. Final and processed
paths are backend-write-only. A path outside the upload shape exists only as a documented,
create-only, attested exception with every read denied (the app's additions name its exceptions).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 10. Emulator rules tests cover every boundary
**Rules:** RULE-STD-BACKEND-120, RULE-STD-QUALITY-001, RULE-STD-QUALITY-008. **Scope:** both rules
files + the rules tests.
```bash
npm run test:rules
```
**Expected:** green against the user-started emulators. Every path with write access and every public
or private read boundary has positive AND negative coverage — wrong user, spoofed identity field,
protected-field change, oversized or wrong-type file, unauthenticated caller, member vs non-member.
Every rules test builds its environment through the app's one harness on an isolated test project,
never a real project id. Fixtures seed through `withSecurityRulesDisabled`; an access assertion never
runs inside it. A cross-service positive assertion (a Storage rule calling `firestore.get(...)`) needs
a seeding bridge — see step 12. A newly added collection or Storage path with no rule test is a
finding. `NOT RUN` without the emulators.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 11. Rule ordering and the catch-all's position
**Rules:** RULE-STD-BACKEND-109, RULE-STD-ENG-006. **Scope:** both rules files. Firestore evaluates
rules as a **union** of every matching `allow`, so an overlapping `match` path never overrides
another — it widens it.
```bash
rg -n "\{document=\*\*\}|\{allPaths=\*\*\}" firestore.rules storage.rules
rg -oNI "^    match /[A-Za-z_]+" firestore.rules | sort | uniq -c | sort -rn
```
**Expected:** both deny-all catch-alls exist and grant nothing; a run where either is absent or grants
anything is the finding. Its position is not the check: because grants union, a deny-all grants
nothing wherever it sits — confirm it is present and grants nothing. The second command groups the
top-level `match` blocks by first segment and is the shadow-candidate list: for every group with more
than one block, confirm the paths are disjoint or deliberately nested, and that a nested `match` does
not silently widen a parent grant (a parent that denies plus a child that permits is permitted). Flag
any prefix pair with differing grants.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 12. `storage.rules` performs no cross-service consult
**Rules:** RULE-STD-MEDIA-002, RULE-STD-BACKEND-120. **Scope:** `storage.rules`.
```bash
rg -n "firestore\.(get|exists)" storage.rules
```
**Expected:** zero hits. The Storage rules make no cross-service Firestore read — which is precisely
why the origin allowlist and the strict path binding live in the upload callable, and what keeps the
Storage rules cheap and free of a dependency on a document some other path writes. A future consult
silently changes the trust model and needs a seeding bridge for its positive test (never
`withSecurityRulesDisabled` around the assertion); a hit is a finding until the design doc, the
bridge, and the seeded test land with it.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Pass / Fail

Per [README.md](README.md) § Verdict. **PASS** — every rule path has a documented actor, protected
fields are immutable or backend-only, and emulator tests cover positive and negative cases.
**FAIL** — a rule allows unauthorized private reads, privilege escalation, payment or moderation
tampering, spoofed identity, or unmoderated final-media writes.
