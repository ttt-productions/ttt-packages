# Media Pipeline Playbook

## Purpose

Audit media uploads, the pending-upload processing documents, moderation, Storage paths, final asset
writes, rejected-file behavior, and rendering — verifying the pipeline still obeys the
`RULE-STD-MEDIA-*` rules and the backend write and moderation rules it depends on. Methodology only;
the per-step contract, boundary, and verdict are [README.md](README.md)'s.

It is NOT a rulebook, NOT a design doc (the app's upload-pipeline and media-serving design docs hold
the model), and NOT a findings log. The codebase-hygiene playbook's media tripwires (steps 4–6, 11,
14, 37, 39, 53, 58–59) are the always-on backstop; this playbook is the deep media audit they point
to. An app whose delivery half runs outside Firebase Storage audits that half in its additions.

## When to run

Before launch; after adding a media origin or changing an upload, processor, moderation, or serving
path.

## Audit Steps

### 1. Inventory media entry points
**Rules:** RULE-STD-MEDIA-001. **Scope:** `src` + `functions/src` + `storage.rules`.
```bash
rg -l "pendingMedia|fileOrigin|<UPLOAD_PATH_BUILDER>|<PROCESSOR_ROUTER>|startUpload" src functions/src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.ts' -g '!*.test.tsx'
```
**Expected:** an enumeration of files, not a pass/fail — it feeds steps 2–11. Every file is one of: a
surface riding the one pipeline through its origin (the origin's spec → the temp path builder → the
upload callable → the target-info parse → the processor route), the pipeline's own helpers, or the
Storage uploads block. A bespoke upload path, a second pending-upload producer, or a hand-rolled
processor route is a RULE-STD-MEDIA-001 violation for the per-surface review (step 9). A sanctioned
non-pipeline origin is named in the app's additions.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. Verify the upload path invariant
**Rules:** RULE-STD-MEDIA-002, RULE-STD-MEDIA-006. **Scope:** `src` + `functions/src` +
`storage.rules`.
```bash
# SINGLE quotes required — in double quotes bash collapses "\$" to "$" and rg never matches.
rg -n 'uploads/\$\{' src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
rg -n "<UPLOAD_PATH_BUILDER>" src functions/src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** the first command prints nothing — temp upload paths come only from the
`<APP_DATA_PACKAGE>` temp-path builder, never hand-assembled. The canonical shape is origin, uid, and
upload id, with no extension; the final segment is the client-generated id the upload callable adopts
as the pending document id. The callable re-derives the id from the last segment, rebuilds the path,
and rejects unless the submitted path is **strictly equal** — never a prefix match. Rules, client
helpers, and processors all agree on the shape. Deep cross-check → `codebase-hygiene-playbook.md`
step 11.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 3. Pending-doc creation and client-supplied targets
**Rules:** RULE-STD-MEDIA-004, RULE-STD-ARCH-106, RULE-STD-BACKEND-106. **Scope:** `functions/src` +
`firestore.rules`.
```bash
rg -n "pendingMedia" firestore.rules
rg -n "targetInfo|targetDocPath|targetFields|docPath" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** the pending-upload collection is callable-only in the rules (client create `if false`)
— user, origin, source path, target entity, status, and ownership are validated inside the callable.
Processors and cores never treat a pending document's target fields as authoritative for identity or
write location: identity derives from the stored uploader, `request.auth.uid`, or an admin-checked
context; target paths from the canonical path builders; asset-reference fields from server-side
target-field maps. `targetInfo` carries only the domain payload and typed ids, and no field of it is a
client-supplied path or field name.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 4. Storage temp-upload rules
**Rules:** RULE-STD-MEDIA-002. **Scope:** `storage.rules`. Deep → `firestore-storage-rules-playbook.md`
step 9.
```bash
rg -n "uploads|uploadMaxBytes|request.auth.uid|contentType|image|video|audio" storage.rules
```
**Expected:** semantic review of the uploads block: temp uploads require the uploader to own the uid
segment, the per-origin size cap (an unknown origin fails closed to zero), a concrete media
content-type pattern plus the neutral lane for unknown picker metadata (a client never fabricates a
media type to pass the shape check), and the four-segment path shape. No rule in this block grants a
final-path write. The origin allowlist is callable-only.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 5. Final-path rules and protected serving
**Rules:** RULE-STD-MEDIA-101, RULE-STD-BACKEND-201. **Scope:** `storage.rules` + `src` +
`functions/src`.
**Method (semantic review over the app's serving locators, in its additions).**
**Expected:** final media paths are backend-write-only (clients never write a final path), and any
public read path exposes only approved, processed content. Content documents store asset references,
never durable URLs — the serving URL is built at render time by the canonical builder
(RULE-STD-MEDIA-101). Rejected media never becomes publicly readable. A read rule on a path the app
serves through another layer is the finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 6. Moderation path
**Rules:** RULE-STD-BACKEND-201, RULE-STD-BACKEND-307, RULE-STD-BACKEND-308, RULE-STD-ENG-003.
**Scope:** `functions/src`. **Method (semantic review over the app's moderation adapters).**
**Expected:** every moderation decision resolves into a clear state — approved, rejected, or failed /
manual review — and a rejected or failed result never yields publicly readable media. Each classifier
and scanner runs through its one app adapter, never a raw SDK call site, and each scan is a single
shared path. **The invariant is fail-closed, not branch-count:** any environment branch on a
moderation or scan decision gates only on the sanctioned emulator flag (RULE-STD-BACKEND-308), ships
no dead production path, carries its in-file rationale, and fails CLOSED in every deployed
environment. The finding is a branch that fails open when deployed, a branch keyed on anything but the
sanctioned flag, or a new branch with no rationale — never the existence of a reviewed one (the app's
additions list its reviewed branches).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 7. Processor idempotency
**Rules:** RULE-STD-BACKEND-304, RULE-STD-MEDIA-001. **Scope:** `functions/src`. Deep async →
`async-workflow-playbook.md`.
```bash
rg -n "<PROCESSOR_ROUTER>|onObjectFinalized|onDocumentCreated|onDocumentWritten" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** re-running media processing is a safe no-op — a re-delivered trigger uses a
deterministic output id with create-if-absent, a compare-and-set, or a pre-existence read, so it never
duplicates outputs, overwrites unrelated files, or leaves a stale final path. Every intake origin
routes through the one processing core except a documented trust-boundary intake. A must-succeed
lifecycle trigger carries `retry: true` and survives re-fire.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 8. Orphan-cleanup coverage
**Rules:** RULE-STD-BACKEND-304, RULE-STD-QUALITY-104. **Scope:** `functions/src`.
**Method (semantic review).**
**Expected:** a cleanup path exists and is owned for every orphan class — temp uploads with no valid
pending document, failed or stuck pending documents, old media replaced by a successful re-upload, and
any object a copy or first ingest wrote before its asset document existed. Each sweep is an idempotent
scheduled job, and a processor failure leaves the pending document in an admin-visible failed state,
never a silent permanent orphan. Rejected-byte retention has a stated window in the app's design doc
and its own audit in the app's additions.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 9. Per-surface origins
**Rules:** RULE-STD-MEDIA-006, RULE-STD-MEDIA-001. **Scope:** `functions/src` + `storage.rules` + the
`<APP_DATA_PACKAGE>` source.
**Expected:** enumerate every canonical origin and confirm each surface extends the contract in
lockstep (RULE-STD-MEDIA-006): the origin schema AND the media specs, the Storage size cap and
content-type pattern, the upload callable's auth switch and target-info schema, and the processor
route. Distinct audiences (admin and member variants) are distinct origins, never substituted. The
origin↔processor sync tests stay green and the processor `switch` is compile-time exhaustive. Detail →
`codebase-hygiene-playbook.md` steps 5–6.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 10. The test matrix
**Rules:** RULE-STD-QUALITY-001, RULE-STD-BACKEND-120. **Scope:** the media and Storage rules tests +
the origin sync tests. **Method (semantic review of existing tests).**
**Expected:** the media suites cover each case a regression would hide — valid upload, wrong user,
wrong origin, oversized file, wrong content type, direct final-path write, rejected moderation result,
duplicate processor run, and processor failure. Same-service setup seeding inside a rules test is not
a finding. A missing case is a coverage finding, not a silent pass.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 11. Orphan temp-Storage cleanup — scheduled function (local) + bucket sample (hosted)
**Rules:** RULE-STD-BACKEND-304, RULE-STD-BACKEND-303. **Scope:** `functions/src` (local); the live
bucket (hosted, authorization required).
```bash
rg -n "onSchedule" functions/src -g '*.ts' | rg -i "cleanup|orphan|upload|temp"
```
**Expected:** local half — a scheduled cleanup function removes orphaned temp uploads, is idempotent,
and sets an explicit `concurrency`. **Hosted half — `BLOCKED` unless DJ authorizes it:** sampling the
live bucket for temp uploads older than the cleanup window runs only under
`data-integrity-playbook.md` with authorization; a non-trivial count means the cleanup is not running
or not finding its orphans.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Pass / Fail

Per [README.md](README.md) § Verdict. **FAIL** — a user can publish unprocessed media, spoof another
user's upload, or leave untraceable or stuck media state.
