# Adopt @ttt-productions/dev-standards 0.0.22

**What:** RULE-STD-BACKEND-115 says every union of object shapes in a stored document is discriminated.
**Severity:** low
**Came from:** the Q-Sports stored-document-schemas-are-plain ttt-packages session

- **Package and version:** `@ttt-productions/dev-standards` 0.0.22. Adopt `dev-standards-0.0.21.md`
  first, or together.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards media-schemas q-core patch`.
- **What changed:**
  - RULE-STD-BACKEND-115's **Stored schemas are plain** clause adds: every union of object shapes a
    stored schema reaches is a discriminated union, so a document is read by the shape its
    discriminator names — never as the first shape it happens to parse as — and a document whose
    shape depends on something it does not hold stores that discriminator. The
    `storedDocumentSchemasPlain` guard enforces it (`repo-guards-0.1.43.md`).
  - The data-integrity playbook's step 7 names both checks of that guard.
- **What the app must change:** Install. ttt-prod's rulebook keeps no copy of the rule; the code
  change is in `repo-guards-0.1.43.md`.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.22 or later.
