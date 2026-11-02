# Adopt @ttt-productions/repo-guards 0.1.43

**What:** The stored-schema guard also fails a union of object shapes with no discriminator; ttt-core has two to discriminate.
**Severity:** medium
**Came from:** the Q-Sports stored-document-schemas-are-plain ttt-packages session

- **Package and version:** `@ttt-productions/repo-guards` 0.1.43. Adopt `repo-guards-0.1.42.md`
  first, or together.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards media-schemas q-core patch`.
- **What changed:**
  - The `storedDocumentSchemasPlain` guard runs a second check, "no stored document is read through
    a union that guesses its shape": every union of object shapes a registered document schema
    reaches is a discriminated union. A plain union holding two or more object shapes reads a value
    as the first member it happens to parse as, so with plain options a damaged value of one shape
    reads as another's. Each one fails once, at the first document path that reaches it. Same facts
    (`{ docSchemas }`), so the guard config does not change.
  - `./zod-shape` adds `guessingUnions(schema, path)`; its walk reaches a union wrapped in
    `.optional()` / `.nullable()` as a node of its own.
- **What the app must change (packages-first: each fix is a ttt-packages change and its release,
  then this adoption):**
  1. **`safetyEvidenceJobs/{jobId}/safetyEvidenceJobItems/{itemId}`** —
     `SafetyEvidenceJobItemDocV1Schema` (ttt-core `src/doc-schemas/safety/evidence.ts`) is a plain
     union of the item and the two control shapes (both controls store `role: 'control'`). Make it a
     discriminated union on a field every option stores — the item storing a `role` of its own and
     the two controls told apart by a field each stores — with its writers storing it, and the
     migration of existing items if ttt-prod holds live ones.
  2. **`pendingMediaArchive/{pendingMediaId}`** — `ArchivedPendingMediaDocSchema`, built in
     media-schemas `createPendingMediaSchemas` (`src/factories/pending-media.ts`), is a plain union
     of the archived states (themselves a discriminated union on `status`) and the quarantined row
     (`parseFailed: true`, no `status`). Discriminate it in media-schemas — for instance a
     quarantined row that stores a `status` of its own, so the archive reads as one discriminated
     union on `status` — with ttt-core's archive writer and any existing quarantined rows following.
     Q-Sports registers no pending-media archive, so only ttt-prod depends on it.
  3. Tests in ttt-core and ttt-prod for each: a document of one option missing a field of its own is
     refused, never read as another option.
- **Done when:** ttt-core (and media-schemas, for the archive) are released and installed, the
  lockfiles name `@ttt-productions/repo-guards` 0.1.43 or later, and both checks of
  `storedDocumentSchemasPlain` run green in ttt-prod's suite.
