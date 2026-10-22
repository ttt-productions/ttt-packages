# Architecture — data and contracts (RULE-STD-ARCH-100–199)

Format, scopes, and rule IDs: [../README.md](../README.md).

Cross-boundary contracts, canonical definitions, identity, paths, compound ids, and timestamps. Fundamentals: [core-rules.md](core-rules.md).

### RULE-STD-ARCH-101 — `<APP_DATA_PACKAGE>` owns cross-boundary contracts
**Scope.** apps

**Rule.** `<APP_DATA_PACKAGE>` is the single source of truth for anything that crosses the backend↔frontend boundary in `<APP_NAME>`: types, constants, schemas, path builders, and shared shapes. If both `functions/src/` and `src/` need to know about it, it lives in `<APP_DATA_PACKAGE>`. A new cross-boundary type is added to `<APP_DATA_PACKAGE>` first — never to an app-local types module first. `<APP_DATA_PACKAGE>` is the application-data package: it may depend on generic packages and composes the app's schemas, constants, enums, paths, and business rules; generic packages never depend on it (RULE-STD-ARCH-201, RULE-STD-ARCH-207), and it imports no app code. No import between `src/` and `functions/src` — by relative path, alias, build step, or copied file — stands in for an `<APP_DATA_PACKAGE>` definition. A pair-proving test that imports both sides of a trust contract (RULE-STD-ARCH-005) is not such an import.

**Why.** Drift fixed after parallel local definitions already exist costs a consolidation across every copy — a definition living in one app layer is a copy waiting to happen the moment a second consumer needs it.

**Prohibits.**
- App-local (`functions/src/`, `src/`) definitions of cross-boundary shapes, constants, or copy.
- Adding a cross-boundary type to an app-local types module before `<APP_DATA_PACKAGE>`.
- An import between the two app roots (by relative path, alias, build step, or copied file) standing in for an `<APP_DATA_PACKAGE>` definition.
- `<APP_DATA_PACKAGE>` importing app code; a generic package importing `<APP_DATA_PACKAGE>`.

**References.** RULE-STD-ARCH-102, RULE-STD-ARCH-201, RULE-STD-ARCH-207; RULE-STD-ENG-004; ttt-packages `docs/packages/package-architecture.md`.

### RULE-STD-ARCH-102 — One named declaration; enforcement points derive
**Scope.** both

**Rule.** Every definition — numbers (length limits, count caps, rate windows, price bounds), string unions and enums (kinds, statuses, item types), option and allowlist arrays, label and display-name maps, verbatim business copy (agreement statements, attestations), and typed shapes — is ONE named declaration in the package that owns the concept: `<APP_DATA_PACKAGE>` for an app's business truth, the owning generic package for a mechanism.

**Apps:** this holds regardless of which layer consumes the definition today: there is no "frontend-only" or "backend-only" definition, because `src/` and `functions/src` are not importable by a second consumer, so a definition living there is a copy waiting to happen. The app owns wiring (routes, composition, layout) — never truths.

Enforcement points **derive**, never restate: zod `.max(MAX_X)`, React `maxLength={MAX_X}`, backend guards, `.slice(0, EXCERPT_LEN)`, and type positions referencing the canonical union (never an inline re-declared union). A literal at an enforcement point is drift by definition. Two compliance questions for any declaration: "updating this touches how many places?" (must be one) and "can a second consumer import this?" (if it would ever need to, it belongs in a package).

Every enforcement point of one field enforces the SAME constraint set — the form, the wire schema, and the final writer accept exactly the same values. A rule present at one point and missing at another (a client-only cap, a UI-only pattern, a server-only trim, a wire schema that admits what the writer later discards) is drift even when each point imports its constant. Text a field requires is non-blank after trimming at every point, and a typed number is read from the whole input — `parseInt` / `parseFloat` read a numeric PREFIX, so "1.9" and "12abc" silently become 1 and 12.

**Why.** A restated value is drift by definition — updating the concept must touch exactly one place. A constraint split across points is the same drift one level up: a cap only the form enforces is bypassed by any other caller, whitespace-only text passes the wire and is stored blank, and a prefix-parsed number submits a value the user never typed.

**Prohibits.**
- Re-declared local copies of a canonical union, constant, or map; "keep in sync" comment pairs (the fix is consolidation, then deleting the sync obligation).
- Loose `string` / `string[]` typing where a canonical allowlist exists.
- Justifying a local copy or local DTO by "avoids a package publish" (auto-reject).
- A sync TEST between two importable files (acceptable only across a boundary that physically cannot import TypeScript — `firestore.rules` / `storage.rules`).
- A constraint enforced at one point of a field and missing from another; required text the wire accepts as whitespace; `parseInt` / `parseFloat` reading user-typed text.

**Enforcement teeth (apps).** The repo-guards core-definition guards run against the installed `<APP_DATA_PACKAGE>` build and fail the gate: no bare numeric `.max()` outside the reviewed allowlist, and no canonical union member as a quoted literal outside its defining file and reviewed allowlist. The redeclaration check parses sources with the TypeScript compiler API, so a member named in a comment is never a hit; each allowlist entry excuses ONE `file#declaration` and carries its justification, and an entry whose occurrence is gone fails the guard too. The same suite fails a `parseInt` / `parseFloat` in a render surface outside its reviewed allowlist.

**References.** RULE-STD-ENG-002, RULE-STD-ENG-005, RULE-STD-ENG-006; RULE-STD-ARCH-101.

### RULE-STD-ARCH-103 — Persist identity references, not snapshots
**Scope.** apps

**Rule.** Display identity lives only in the user's own profile document and the backend-mirrored `publicUsers/{uid}` document. Content, chat, report, admin-task, and projection documents store uid references only (`{ uid }`, `userId`, `senderId`, `createdBy.uid`, or a schema-specific owner reference). Never persist display names, profile-picture URLs, or username snapshots on those documents. The one exception is an audit-trail field explicitly named as a snapshot (`displayNameSnapshot`); a field named plainly `displayName` is never that exception. The same rule covers the names of other records referenced inside content: a stored reference carries the record's id, never its name or title. Names and avatars are resolved at read/render time through the app's public-user lookup hooks or server-side reads of `publicUsers/{uid}`. The read model is owned by the app's identity design doc.

**Why.** A snapshotted name or avatar goes stale the instant the user edits it and can never be corrected; resolving by id at render time means a rename or a moderation flag (disabled state) reaches every surface on the lookup's own freshness rules, with no copy left behind to contradict it.

**Prohibits.**
- Persisting `displayName` / `profilePictureUrl` / username snapshots on content, chat, or projection docs, outside an audit-trail field named as a snapshot.
- A name or text field on a stored reference to another record.
- Snapshotting a referenced record's title into content.
- A read path that trusts an embedded name instead of resolving from `publicUsers`.

**References.** RULE-STD-ARCH-106; RULE-STD-FRONTEND-108 (auth-scoped subscribers reset on identity change).

### RULE-STD-ARCH-104 — Canonical Firestore paths and compound-camelCase naming
**Scope.** apps

**Rule.** All Firestore collection names, path constants, and shared path shapes live in `<APP_DATA_PACKAGE>`. Use `COLLECTIONS.X` for collection names and `PATH_BUILDERS.x()` for full paths — never a hardcoded collection or path string. `PATH_BUILDERS` returns path-segment tuples; the backend wraps them with `toPath()` for Admin SDK slash paths, never by hand-assembly. Collection names are compound camelCase, never single words (`userProfiles`); a subcollection name carries its parent's context as a prefix; document-ID fields use camelCase with an id suffix (`userId`).

**Why.** A hardcoded or hand-assembled path string is an un-refactorable copy of a schema fact only `<APP_DATA_PACKAGE>` should own; single-word collection names collide and read ambiguously.

**Prohibits.**
- Hardcoded collection or path strings anywhere in `src/` or `functions/src`, in source or test code.
- A path builder or collection constant defined app-locally instead of in `<APP_DATA_PACKAGE>`.
- Joining path segments by hand instead of `toPath()` over a `PATH_BUILDERS` tuple.
- Single-word collection names; a subcollection without its context prefix.

**References.** RULE-STD-ARCH-101; the repo-guards hand-typed collection-path guard.

### RULE-STD-ARCH-105 — Timestamps are epoch milliseconds via firebase-helpers
**Scope.** apps

**Rule.** Store all timestamps as epoch-millisecond numbers (`Date.now()`), not Firestore `Timestamp` objects. Convert legacy or interop values with `toMillis()` and format for display with `formatDate()` from `@ttt-productions/firebase-helpers`. Do not use `Timestamp.now()`, `serverTimestamp()`, `FieldValue.serverTimestamp()`, or firebase-helpers' `serverNow()`. **Exception:** a field governed by a Firestore native-TTL policy must be a real `Timestamp` — the platform only expires a Timestamp field — written via `Timestamp.fromMillis(...)` (`Timestamp` imported from `firebase-admin/firestore`). Such a field is named for its purpose (`expireAt`) and is never the source of a displayed or sorted value. A native-TTL policy is the only sanctioned REASON to write a `Timestamp`; a new TTL-governed field joins the exception without amending this rule.

**Why.** Mixed timestamp representations break comparisons and force conversion at every read; one numeric representation keeps every comparison and sort correct across both SDKs.

**Prohibits.**
- Persisting a Firestore `Timestamp` for an ordinary time field.
- `Timestamp.now()` / `serverTimestamp()` / `FieldValue.serverTimestamp()` / `serverNow()` outside the native-TTL exception.
- A native-TTL `Timestamp` field that is not named for its purpose, or that is displayed or sorted on.
- Ad-hoc timestamp parsing instead of `toMillis()` / `formatDate()`.

**References.** ttt-packages `docs/packages/firebase-helpers.md`.

### RULE-STD-ARCH-106 — Client-supplied identity, paths, and targets are never authoritative
**Scope.** apps

**Rule.** Any field a client can send is untrusted: identity fields (`actorId`, `userId`, `createdBy`, `actorName`), storage and target paths (`targetDocPath`, `targetInfo`, `targetFields`), ownership hints, and display fields (`displayName`). The backend derives the authoritative value — identity from `request.auth.uid` (acting on another user's behalf requires an explicit privilege check), target locations from validated fields (`userId`, `fileOrigin`, `id`) or a `PATH_BUILDERS` derivation, and any public display field re-sourced from the authoritative profile doc or validated against the caller's profile before it is written. A client string that becomes a path segment — a target id, a name turned into a reservation key — is validated as ONE segment (non-empty, no `/`, within the document-id limit) by its wire schema before any path is built from it.

**Why.** Anything the client can send, an attacker can send without the UI; a trusted client path or identity field is a direct write-anywhere or impersonation primitive.

**Prohibits.**
- Trusting `targetDocPath` / `targetInfo` / `targetFields` from `pendingMedia` (derive the target or reject the doc).
- Writing a client-supplied `displayName` / `createdBy` / `actorName` to a public doc without re-sourcing or validation.
- Accepting an identity field as authority without matching `request.auth.uid` or an explicit privilege check.
- Building a path from a client string not validated as one segment — a `/` in it addresses a different document or a subcollection, and an empty one addresses the collection.

**References.** RULE-STD-ENG-006; RULE-STD-BACKEND-005 (identity fields match `request.auth.uid`); RULE-STD-MEDIA-004 (media-target form).

### RULE-STD-ARCH-109 — Compound document IDs have one builder and one parser
**Scope.** apps

**Rule.** Every compound document id format — an id built from two or more parts — is owned by a single builder in `<APP_DATA_PACKAGE>`, with a matching parser wherever code needs the parts back. Every producer and consumer — app code, Cloud Functions, the rules files, and test fixtures — goes through that builder; a rules file, which cannot import it, restates the format only as a declaration a guard pins to the builder. The format is never assembled inline and never taken apart with an ad-hoc split at the call site.

**Why.** A compound id is often load-bearing for authorization — code and rules read a document by its id to decide whether the caller holds a role or a relationship — so one inconsistent copy is a permission failure, not a cosmetic one. Any caller can reconstruct it, so its writes follow RULE-STD-BACKEND-102.

**Prohibits.**
- An inline template literal or a local id helper for a compound id.
- Parsing a compound id by splitting on the separator at the call site.
- A second id convention for one relationship.
- A rules-file restatement of a compound id format that no guard pins to its builder.

**References.** RULE-STD-ENG-002, RULE-STD-ENG-011 (an id convention change ships its migration); RULE-STD-ARCH-004, RULE-STD-ARCH-101, RULE-STD-ARCH-104; RULE-STD-BACKEND-102.
