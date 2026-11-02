# Adopt @ttt-productions/dev-standards 0.0.21

**What:** The shared rulebook says every stored-document schema is plain and callable input takes a strict copy of a stored shape.
**Severity:** medium
**Came from:** the Q-Sports stored-document-schemas-are-plain ttt-packages session

- **Package and version:** `@ttt-productions/dev-standards` 0.0.21.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards media-schemas q-core patch`.
- **What changed:**
  - RULE-STD-BACKEND-115 gains the clause **Stored schemas are plain**: every object schema a
    registered document's schema reaches is a plain `z.object` — never `.strict()` /
    `z.strictObject`, `.passthrough()` / `z.looseObject`, or a `catchall`. A field the schema does
    not name is dropped on read, never refused and never kept; the write guard keeps undeclared
    fields out. A callable input that carries a stored shape takes a strict copy of the stored
    schema. The repo-guards `storedDocumentSchemasPlain` guard enforces it.
  - RULE-STD-BACKEND-002 says the same from the input side: a shape a callable takes that is also
    stored takes a strict copy of the plain stored schema, so its fields are declared once.
  - The data-integrity playbook's step 7 expects the drift check to report unknown fields at every
    depth and the new guard green; `playbooks/crosswalk.md` lists `storedDocumentSchemasPlain`
    beside `firestoreWrites` for RULE-STD-BACKEND-115.
- **What the app must change:** Install. ttt-prod's rulebook keeps no copy of either rule, so no
  rule text changes; the code change the rule asks for is in `repo-guards-0.1.42.md`.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.21 or later.
