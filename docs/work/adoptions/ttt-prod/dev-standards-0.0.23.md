# Adopt @ttt-productions/dev-standards 0.0.23

**What:** Stored-document schemas get their own rule, RULE-STD-ARCH-110; RULE-STD-BACKEND-115 keeps only the write.
**Severity:** low
**Came from:** the Q-Sports stored-schemas finish and rulebook ttt-packages session

- **Package and version:** `@ttt-productions/dev-standards` 0.0.23. Adopt `dev-standards-0.0.21.md`
  and `dev-standards-0.0.22.md` first, or together.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards patch`.
- **What changed:**
  - New **RULE-STD-ARCH-110 — A stored-document schema reads every live document**
    (`rules/architecture/data-and-contracts.md`): every object schema a registered document's schema
    reaches is a plain `z.object`; every union of object shapes it reaches is a discriminated union,
    and a document whose shape depends on a value it does not hold stores that value as its
    discriminator; a callable input carrying a stored shape takes a strict copy. Its reason now names
    the valid document a plain union misreads (a larger shape read as a smaller one listed before
    it), not only a damaged value, and its Prohibits list names the strict, passthrough and catchall
    object, the undiscriminated union, and the undiscriminated document. The repo-guards
    `storedDocumentSchemas` guard enforces it (`repo-guards-0.1.44.md`).
  - RULE-STD-BACKEND-115 loses its **Stored schemas are plain** paragraph: it says undeclared fields
    are kept out at the write and points at RULE-STD-ARCH-110.
  - `playbooks/crosswalk.md` lists RULE-STD-ARCH-110 (data-integrity step 7, `storedDocumentSchemas`)
    and leaves `firestoreWrites` alone on RULE-STD-BACKEND-115; the data-integrity playbook's step 7
    names RULE-STD-ARCH-110 and the renamed guard.
- **What the app must change:** Install. Then, in ttt-prod: a citation of RULE-STD-BACKEND-115 for
  a stored schema's plainness or its unions (a design doc, a guard-test comment, a rule addition)
  cites RULE-STD-ARCH-110 instead; a `RULE-STD-ARCH-110 — TTT additions` block goes in
  `docs/engineering-rules/architecture/data-and-contracts.md` only if ttt-prod has an addition (the
  guard's wiring in `src/__tests__/guards/config/firestore.ts`).
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.23 or later, and no
  ttt-prod doc cites RULE-STD-BACKEND-115 for a stored schema's plainness or its unions.
