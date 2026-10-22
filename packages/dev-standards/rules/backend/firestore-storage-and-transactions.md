# Backend — Firestore, Storage & transactions

Shared rulebook — format, IDs, scope, placeholders, and app layering: [../README.md](../README.md).

Data-integrity and write-boundary rules for backend code, for a package that reads or writes
Firestore, and for the rules files. Read with [core-rules.md](core-rules.md).

### RULE-STD-BACKEND-101 — All transaction reads before all transaction writes
**Scope.** both

**Rule.** A Firestore transaction body runs in fixed order: (1) all `transaction.get(...)`; (2) the throw-points those reads trigger; (3) all writes; (4) the in-transaction audit write (RULE-STD-BACKEND-202), where the action is audited. A late read of a doc that one of your own earlier writes affects means the function is really two transactions — restructure it.

**Why.** Firestore throws at runtime on any read after a write inside a transaction.

**Prohibits.**
- Any `transaction.get` after a `transaction.set` / `update` / `delete`.
- Reading a doc your own earlier write in the same transaction affects.

**References.** RULE-STD-BACKEND-202 (the in-transaction audit write closes the same ordering); RULE-STD-BACKEND-116.

### RULE-STD-BACKEND-102 — create() / merge-set semantics on client-chosen IDs
**Scope.** apps

**Rule.** Never `.set()` a document at a client-chosen **or caller-reconstructable** ID without first deciding intent: `.create()` (fails if it exists) when the doc must be new, or `.set(..., { merge: true })` when updating an existing doc. A bare `.set()` at such an ID silently overwrites. A compound document id (RULE-STD-ARCH-109) is reconstructable by any caller who knows its parts, so it is covered.

**Out of scope.** A full-payload `.set()` at a SERVER-derived ID that no caller can aim — the projection-mirror pattern, where the owning writer recomputes a derived document in full from its authoritative source and overwrites it (RULE-STD-BACKEND-206) — is deliberately outside this rule: a merge would strand fields the recomputation removed. Do not widen RULE-STD-BACKEND-102 to cover it.

**Why.** Bare overwrite at an id a caller can choose or rebuild clobbers another user's document.

**Prohibits.**
- Bare `.set()` on a client-supplied, client-chosen, or caller-reconstructable document ID.

**References.** RULE-STD-ARCH-109; RULE-STD-BACKEND-106.

### RULE-STD-BACKEND-103 — Concurrent arrays use atomic array operations
**Scope.** apps

**Rule.** A Firestore array that can see concurrent writers is mutated with `FieldValue.arrayUnion` / `arrayRemove`, never client-side `[...arr, x]` or `arr.filter()`.

**Why.** Read-modify-write on a shared array races — two concurrent writers each overwrite the other's element.

**Prohibits.**
- `[...arr, x]` / `arr.filter(...)` writes to a field that can see concurrent writes.

**References.** RULE-STD-BACKEND-101 (transaction write integrity).

### RULE-STD-BACKEND-104 — Dotted paths only in update(); nested objects in merge-sets
**Scope.** both

**Rule.** Dot notation is a field path ONLY in `update()`. In a merge-set (`set(..., { merge: true })` Admin SDK / `setDoc(..., { merge: true })` client) a dotted key creates a LITERAL top-level field and never touches the nested map. Use `update()` for dotted paths, or pass a real nested object to the merge-set. Firestore test mocks expand dotted keys ONLY in a mocked `update()`.

**Why.** A dotted key in a merge-set writes `'lease.state'` as a literal field name — readers of the real nested field see stale state while the write reports success.

**Prohibits.**
- Dotted string keys inside a merge-set.
- A test mock that expands dotted keys for merge-sets (it makes regression tests pass against broken code).

**References.** RULE-STD-QUALITY-001.

### RULE-STD-BACKEND-105 — No PII on readable docs; use the privateData subcollection
**Scope.** apps

**Rule.** A top-level document other users can read never holds PII (email, payment info, settings, claims, age flags). Sensitive per-user state lives in the `privateData` subcollection. Which top-level documents are readable by whom is the app's addition.

**Why.** A readable doc is effectively published; PII on it leaks to every reader.

**Prohibits.**
- Writing email / payment / settings / claims / age fields to a document other users can read.

**References.** RULE-STD-BACKEND-108 (audience-bucket placement).

### RULE-STD-BACKEND-106 — Content writes route through callables
**Scope.** apps

**Rule.** Every user-generated or admin-entered write — and any new moderation-worthy surface — goes through an HTTPS callable, never a direct client write to a content collection or to the upload pipeline's pending documents. The callable owns auth, rate limit, and text moderation, then either writes the final doc synchronously (text-only) or hands the upload pipeline its pending document for background processing (file attached). The app's addition lists its surfaces.

**Why.** A direct client write bypasses moderation, rate limits, and audit — the exact guarantees the surface exists to enforce.

**Prohibits.**
- A direct client write to a content collection or to the upload pipeline's pending documents.
- A new content surface without a callable owning its moderation / rate-limit / audit.

**References.** RULE-STD-BACKEND-013; RULE-STD-MEDIA-001.

### RULE-STD-BACKEND-108 — Singleton config/system docs live in one of three audience buckets
**Scope.** apps

**Rule.** Every singleton config/system doc lives in one of three buckets, chosen by its least-privileged necessary reader; the bucket IS the read grant, and rules grant reads at the bucket level with NO per-doc carve-outs:

- **`_appConfig` — PUBLIC** (`allow read: if true`): docs rendered pre-auth. Placing a doc here IS publishing it.
- **`_systemData` — SIGNED-IN** (`request.auth != null`).
- **`_serverData` — SERVER-ONLY** (`allow read, write: if false`): policy configs and backend-only singletons.

An audience change is a MOVE of the doc (packages-first — paths live in `<APP_DATA_PACKAGE>`). All three buckets are callable-only for writes. The app's addition says what each bucket holds.

**Why.** A per-doc carve-out ships a real exposure: a sensitive singleton added to the public bucket silently inherits anonymous readability.

**Prohibits.**
- Per-doc read conditions inside a bucket's match block; placing a doc in a wider bucket for path convenience.
- New one-off singleton collections when a bucket fits.

**References.** RULE-STD-BACKEND-105; RULE-STD-ARCH-104.

### RULE-STD-BACKEND-109 — Field-aware allowlist rules on sensitive collections
**Scope.** apps

**Rule.** A rule of the form `allow create/write: if request.auth != null` on a collection holding sensitive fields is almost always wrong. Either add an owner-field check (`request.resource.data.<ownerField> == request.auth.uid`), a size limit, AND a client-writable-field allowlist (every non-allowlisted field is backend-only) — OR route the write through a callable. Rules also re-check the preconditions the UI checks (e.g. `request.auth.token.email_verified`). A rules role check reads the same truth the callable reads — never a denormalized copy of the membership or role.

**Why.** An open `if request.auth != null` write lets any signed-in user set any field — including sensitive ones — by field-smuggling; a role read from a copy grants what the authoritative record has already revoked.

**Prohibits.**
- `allow write: if request.auth.uid == userId` on a doc that has any sensitive field.
- Bare `if request.auth != null` create/write on a sensitive collection.
- A rules role or membership check that reads a denormalized copy instead of the record the callable reads.

**References.** RULE-STD-BACKEND-201; RULE-STD-BACKEND-209; RULE-STD-BACKEND-120.

### RULE-STD-BACKEND-111 — Custom claims merge, never overwrite
**Scope.** apps

**Rule.** Never call `setCustomUserClaims(uid, { singleField })` — it wipes all existing claims. Read the existing claims first and merge the new field onto them.

**Why.** A single-field claim write silently drops every other claim the user holds.

**Prohibits.**
- `setCustomUserClaims` with a partial claims object that is not merged onto the existing claims.

**References.** RULE-STD-BACKEND-004 (the claim is metadata, not authority).

### RULE-STD-BACKEND-112 — Reads are bounded and index-backed
**Scope.** apps

**Rule.** Every Firestore query that could return an unbounded set carries an explicit `limit(...)` or cursor pagination — whether it runs in a backend core or a client `queryFn` — never an unfiltered collection scan that grows with the data. Any query that filters or orders on more than one field, or combines an equality with a range/`orderBy`, has a matching composite index declared in `firestore.indexes.json`; a query that would need a missing index is a defect to fix, not a runtime surprise. A bound must still make progress and tell the truth: a recurring sweep or reconcile pages with a persisted cursor, or its processed rows leave its window, so a fixed first page can never starve the rest (an exhausted source's cursor is kept as "done", never dropped back to page one); a capped or unordered page is never presented as a total, a count, or an "oldest" — count with an aggregate, mark the cap ("200+"), and order before picking; a filter the query cannot express runs before the page is cut, or the reader keeps paging until the page fills or the source ends; and one batch or transaction never spans an unbounded set.

**Why.** An unbounded read's cost and latency grow with the collection until it times out or drains the read budget; a missing composite index fails the query closed in production (`FAILED_PRECONDITION`) even when it passed against a small emulator dataset. A bound without progress fails quietly instead: a reconcile that rescans the same first page forever starves every later row, a capped read rendered as an exact count misreports, and a client filter after the limit shows an empty state while matches sit on the next page.

**Prohibits.**
- A collection or collection-group query with no `limit`/pagination bound.
- A compound (`where` + `where`/`orderBy`/range) query with no corresponding `firestore.indexes.json` entry.
- A recurring sweep that rereads the same first page each run, or restarts an exhausted source from page one.
- A capped or unordered page shown as a count, a total, or the "oldest"; a client-side filter applied after the server limit.
- One batch or transaction over a set with no bound (Firestore caps a batch at 500 writes).

**References.** RULE-STD-FRONTEND-101 (client freshness), RULE-STD-FRONTEND-103 (infinite feeds); RULE-STD-BACKEND-309.

### RULE-STD-BACKEND-113 — Batch reads; no per-item read loop
**Scope.** apps

**Rule.** Reading many documents by id uses ONE batched call (`getAll(...)`, a chunked `where(FieldPath.documentId(), 'in', ids)`, or a denormalized projection) — never a `for`/`await` loop issuing one `get` per item. The client mirror is the app's one batched-by-ids lookup hook, never a per-row hook that fans out N single-doc reads. Cross-domain composition that must read another domain passes the transaction handle and reads through the owning core (RULE-STD-ARCH-003), never a call per item.

**One authorized exception, narrow by construction.** Individual per-document reads are permitted where batching cannot preserve the required authorization semantics and per-id failure isolation — a collection whose Firestore rules gate on `resource.data`, where an unconstrained arbitrary-id `in` query is denied wholesale and one unreadable id would otherwise fail every id with it. This licenses the transport only; it is not a general exemption for per-row reads elsewhere. Shared caching, in-flight deduplication, and bounded concurrency remain required, and access rules are never weakened to make a batch work. The client mirror of the whole rule — both transports — stays the one lookup hook.

**Why.** An N+1 read turns one logical fetch into N sequential round-trips — the single largest avoidable latency and cost multiplier on a list surface.

**Prohibits.**
- A loop issuing one Firestore `get` per element where a batched read exists.
- A per-row React Query hook that fans out N single-doc reads instead of one batched-by-ids hook.
- Claiming the per-document exception for a collection whose rules do not gate on `resource.data`, or loosening those rules so a batch query passes.

**References.** RULE-STD-ARCH-003 (no server HTTPS hop); RULE-STD-ARCH-103 (identity lookups).

### RULE-STD-BACKEND-114 — Scripts that write project data follow the backend write rules
**Scope.** apps

**Rule.** A script that writes a real Firestore/Storage project — dev or prod — is backend write code, not a scratch tool. Collection names and paths come from `<APP_DATA_PACKAGE>`'s canonical declarations (RULE-STD-ARCH-104), never hardcoded strings; a projection, counter, or derived document another core already owns is recomputed by reusing that owner's computation rather than a second hand-written copy of its shape (RULE-STD-ENG-003). Every such script takes its target project explicitly at invocation (never a project id in source), takes its credential from the app's one credential owner, supports `--dry-run`, and is idempotent and safe to re-run. A recompute or repair writes absolute values, never deltas, and visits every derived document that exists — the union of the keys the source still has AND the derived docs already stored — so a counter whose source is now empty, or that a blind decrement drove negative, is compared and rewritten too. These scripts are in scope for the write-boundary and hygiene audits — living in a scripts folder is not an exemption from them.

**Why.** A backfill or recompute script is a full-privilege writer with no rules, no callable, and no review path in front of it, so it is the one write surface where every other guard is absent. A hand-copied projection shape drifts from the trigger that owns it and then writes the wrong document across an entire collection, silently — nothing downstream validates a projection.

**Prohibits.**
- A hardcoded collection or path string in a script that writes project data.
- A script re-deriving a projection/counter another core owns instead of reusing that owner's computation.
- A writing script with no dry-run, no explicit target project taken at invocation, or no re-run safety; a project id in source; a credential taken from anywhere but the one owner.
- A repair whose key set is only the source's keys, so a stored derived doc with no source left is never checked.

**References.** RULE-STD-ARCH-104, RULE-STD-ENG-002, RULE-STD-ENG-003; RULE-STD-BACKEND-206 (server-owned projections); RULE-STD-BACKEND-212 (a repair records its reason and the state it replaced).

### RULE-STD-BACKEND-115 — A write stores only fields the document's `<APP_DATA_PACKAGE>` schema declares
**Scope.** apps

**Rule.** Every write to a registered document stores only fields that document's schema in `<APP_DATA_PACKAGE>`'s document-schema registry declares. A new stored field lands in `<APP_DATA_PACKAGE>` FIRST (RULE-STD-ARCH-101, RULE-STD-ARCH-205), then the writer uses it. Write payloads are typed against the document's `z.infer` type with an operation-specific named patch — never a broad `Partial<Doc>` on a sensitive mutation (RULE-STD-BACKEND-209) — and never cast to `Record<string, unknown>`, `any`, or through a double cast. Document paths feeding a write come from the canonical path builders (RULE-STD-ARCH-104); minting an auto-id with a canonical collection reference's `.doc()`, addressing a preset id on a canonical collection reference, writing through a query snapshot's own `ref`, and building a collection reference for a query are none of them hand-built paths and none of them are covered. A write whose target document or payload the guard cannot resolve fails the same as a violation; the only way past is a specific reviewed exception with its justification.

**The guard bends to the writer, never the writer to the guard.** A canonical shape the analyzer cannot follow is a gap in the analyzer (resolve it, or carry a justified exception) or in `<APP_DATA_PACKAGE>` (a typed field map, a collection builder) — never a reason to unroll a package-owned map into a hand-written field chain, mint a `randomUUID()` in place of a Firestore auto-id, or narrow a generic helper into a specific writer.

**Why.** Zod validates only where code calls it, and no writer calls it — so a merge-set carrying a new field simply succeeds, and the registry's "one source of truth per document shape" quietly stops being true; every undeclared field gets in through a cast that exists to get it past the document's own type.

**Prohibits.**
- Writing a field the document's schema does not declare (including through a spread, a computed key, or a dotted `update()` path, whose top-level field is what the schema must declare — RULE-STD-BACKEND-104).
- `as Record<string, unknown>` / `as any` / `as unknown as X` on a write payload.
- A hand-assembled document path feeding a write.
- Adding a stored field to `functions/src` or `src/` before `<APP_DATA_PACKAGE>`.

**References.** RULE-STD-ARCH-101, RULE-STD-ARCH-104, RULE-STD-ARCH-205; RULE-STD-BACKEND-104, RULE-STD-BACKEND-114, RULE-STD-BACKEND-209; RULE-STD-QUALITY-007.

### RULE-STD-BACKEND-116 — Every write precondition is decided inside the write's transaction
**Scope.** both

**Rule.** A precondition a write depends on — a lock or status, a cap or count, an existence or duplicate check, a hidden flag, a live membership — is read inside the same transaction as the write it guards, through that transaction; RULE-STD-BACKEND-003 is the authorization case of this rule. A query is no exception: the Admin SDK reads a query inside a transaction (`transaction.get(query)`), and a read that errors fails CLOSED, never as "not locked" or "not hidden". A transaction does not lock a query's result set against a concurrent insert, so a cap or uniqueness decided by counting a query also writes one document every competing writer writes (a counter, or a "touch" on the parent) — the two racers then conflict instead of both passing. A partial edit sends and writes only the fields its user changed, never the whole snapshot it loaded.

**Why.** A precondition read outside the transaction is a time-of-check/time-of-use hole: a lock, a cap, a hide flag, or an existing record read before the write it decides can change in the gap. A resent snapshot is the same race in the other direction — saving one field silently overwrites a collaborator's concurrent edit to another.

**Prohibits.**
- A plain `ref.get()` / `query.get()` / `db.getAll(...)` deciding a transactional write, before the transaction or inside its callback; a comment claiming a query cannot run inside a transaction.
- A cap or uniqueness proven only by a query count, with no document both racers write.
- A precondition read that fails open on an error.
- An editor or mutation that resends untouched fields from the snapshot it loaded.

**References.** RULE-STD-BACKEND-003 (authorization, the same rule), RULE-STD-BACKEND-101 (reads before writes), RULE-STD-BACKEND-304.

### RULE-STD-BACKEND-117 — An existence-probe get proves ownership from the path, never from `resource.data`
**Scope.** apps

**Rule.** A client `get` that asks whether the caller's own record exists at a deterministic id — "am I following this?", "have I voted?", "did I apply?" — is authorized from the document PATH: the path segment or deterministic-id part that names the owner equals `request.auth.uid`, so the caller's absent record answers `exists: false`. A document that exists must still name the caller in its stored owner field, a `list` stays constrained on that stored field, and a path naming another member is denied whether or not the document exists. Every probed-by-id collection carries rules tests for the caller's own absent document, its own existing document, another member's document, and the list.

**Why.** A `get` rule reading only `resource.data` denies the probe when the document is absent, so the ordinary "not yet" answer arrives as a permission error and the control built on it fails for everyone without a record. The obvious `resource == null ||` repair is worse: it answers every absent id for every caller, which tells an attacker exactly which of another member's records exist.

**Prohibits.**
- A `get` on a probed-by-id collection authorized only from `resource.data`.
- `resource == null ||` (or any grant on an absent document that does not prove ownership from the path).
- A probed-by-id collection without its absent-own-document rules test.

**References.** RULE-STD-ENG-006; RULE-STD-BACKEND-109, RULE-STD-BACKEND-120; RULE-STD-ARCH-109 (the deterministic id's builder).

### RULE-STD-BACKEND-119 — A counter decrement reads the counter in its transaction and never writes it below zero
**Scope.** apps

**Rule.** A write that lowers a stored count — a follower or like tally, a file or byte count, a report total, a reference count — reads the current value inside the same transaction and writes the lowered value through that count's one decrement path, never a blind `FieldValue.increment(-n)`. A display or derived count is written as `max(0, value − n)`. A count whose going below zero can only mean corruption — a reference count that keeps something held — refuses the write instead (fails closed, never clamps, so a live hold is never read as released). A decrement never creates a counter: a counter that does not exist stays absent. A count the app exempts from this rule is an explicit override in its addition, and each exempt site carries its exception comment (RULE-STD-COMMENT-001).

**Why.** A blind `FieldValue.increment(-1)` on a counter that is missing, already zero, or decremented twice by a retry drives a published count negative — shown to members and sorted on. On a count that holds something in place the same drift is worse: a negative aggregate lets the next hold read as zero.

**Prohibits.**
- `FieldValue.increment(-n)` on a stored count.
- A decrement decided from a read outside its transaction; a decrement that writes a counter document that did not exist.
- A second decrement path for a count that already has its owner; clamping a count that must fail closed.

**References.** RULE-STD-BACKEND-101, RULE-STD-BACKEND-114, RULE-STD-BACKEND-116; RULE-STD-BACKEND-304.

### RULE-STD-BACKEND-120 — A rules change ships positive and negative access assertions
**Scope.** apps

**Rule.** A `firestore.rules` or `storage.rules` change ships positive AND negative access assertions for every collection or path prefix it touches — the actor who may, and at least one who may not — run in the gate's `rules` stage against the emulator, in the same change. A grant meant to be backend-only is proven closed to every client actor, and a write moved behind a callable proves its client path is now denied. Fixtures seed through `withSecurityRulesDisabled`; an assertion never runs inside it.

**Why.** Both rules files are security boundaries, and a rules regression fails silently in the direction that matters: an over-broad grant passes every other stage of the gate, and an over-narrow one fails closed at a path nothing explains. A suite that only proves a grant works never proves it excludes anyone.

**Prohibits.**
- A rules edit with no assertion covering the paths it changed.
- Only positive assertions — a grant proven to work and never proven to exclude.
- An access assertion run inside `withSecurityRulesDisabled`, which proves nothing about the rule.

**References.** RULE-STD-BACKEND-109, RULE-STD-BACKEND-117; RULE-STD-QUALITY-001, RULE-STD-QUALITY-008, RULE-STD-QUALITY-011.
