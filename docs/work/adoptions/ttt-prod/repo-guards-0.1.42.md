# Adopt @ttt-productions/repo-guards 0.1.42

**What:** A new guard fails any strict, passthrough, or catchall object in a stored-document schema; ttt-core's stored schemas become plain to pass it.
**Severity:** medium
**Came from:** the Q-Sports stored-document-schemas-are-plain ttt-packages session

- **Package and version:** `@ttt-productions/repo-guards` 0.1.42 (0.1.41 first shipped the guard;
  0.1.42 makes it read the installed core build, so the suite counts it as checking something).
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards media-schemas q-core patch`,
  then `./scripts/release-multiple.sh repo-guards patch`.
- **What changed:**
  - New generic guard `storedDocumentSchemasPlain` ("every stored-document schema is plain"), facts
    `{ docSchemas }` — the core's `doc-schemas` loader. It walks every schema `COLLECTION_SCHEMAS`
    reaches (fields, arrays, records, unions, intersections, tuples, pipes, lazy schemas) and fails
    each strict, passthrough, or catchall object once, at the first document path that reaches it.
    It reads the layout's `coreDist` build, and an installed core with no compiled module is a
    finding. `absentWhen`: the app stores nothing in Firestore.
  - `./zod-shape` adds `objectMode`, `reachedObjects`, and `unknownFieldPaths(schema, value)` — the
    undeclared fields a stored value holds at every depth the schema declares.
- **What the app must change (packages-first: the ttt-core part is a ttt-packages change and its
  release, then this adoption):**
  1. **ttt-core, every stored schema plain** (RULE-STD-BACKEND-115; ttt-core follows ttt-prod's
     rulebook). About 280 strict objects and one passthrough (`NotificationArchiveAllJobSchema`, its
     "future additive fields" comment goes with it) are reachable from the registry today; the guard
     names each one.
  2. **A callable input that carries a stored shape takes a strict copy** of the plain stored schema
     (`.strict()`; for a union, each option made strict), so the fields stay declared once:
     `SquareStreetzPostMentionSchema` in `CreateSquareStreetzTextPostInputSchema.mentions`,
     `PublicDocumentVersionRefSchema` in `AcceptPublicDocumentsInputSchema.documents`,
     `InviteSourceSchema` (every option and its `data`) in `InviteUserToGuildInputSchema.source`, the
     chat conversation locators in `DeleteConversationFileInputSchema.conversation`, and
     `AdminDispatchContextRefSchema` in `CreateAdminDispatchToWorkProjectInputSchema` and
     `StartWorkProjectAdminSupportThreadInputSchema`. The last one is plain in those callable inputs
     today, against RULE-STD-BACKEND-002, so its strict copy also fixes that. After the change no
     object a callable input reaches is plain (a runtime walk of every `*Input*Schema` export
     confirms it; `AdminDispatchContextRefSchema` is the only one today).
  3. **The one union with no discriminator,**
     `safetyEvidenceJobs/{jobId}/safetyEvidenceJobItems/{itemId}`: plain options no longer refuse
     each other's fields, so a damaged item could read as a narrower option. Confirm each option's
     required fields still keep them apart, or discriminate it.
  4. Tests that expected a stored schema to refuse an extra field now expect it dropped.
  5. `src/__tests__/guards/config/firestore.ts`: add `'storedDocumentSchemasPlain'` to the facts
     `Pick` and `storedDocumentSchemasPlain: { docSchemas }`.
  6. `scripts/firestore-drift-check.mjs`: report nested unknown fields through `unknownFieldPaths`
     (plain reads now drop them silently) in place of the top-level `knownKeys` check.
- **Done when:** ttt-core holds no strict, passthrough, or catchall stored schema and is released and
  installed, the lockfiles name `@ttt-productions/repo-guards` 0.1.42 or later, the guard runs green
  in ttt-prod's suite, and the drift check reports nested unknown fields.
