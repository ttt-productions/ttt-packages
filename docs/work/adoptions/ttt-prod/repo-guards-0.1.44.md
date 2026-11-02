# Adopt @ttt-productions/repo-guards 0.1.44

**What:** The stored-schema guard is renamed `storedDocumentSchemas`.
**Severity:** low
**Came from:** the Q-Sports stored-schemas finish and rulebook ttt-packages session

- **Package and version:** `@ttt-productions/repo-guards` 0.1.44. Adopt `repo-guards-0.1.42.md`
  and `repo-guards-0.1.43.md` first, or together.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards patch`.
- **What changed:**
  - The guard id `storedDocumentSchemasPlain` is now `storedDocumentSchemas`: it holds both checks
    of RULE-STD-ARCH-110 (plain objects and discriminated unions). Its two titles and its facts
    (`{ docSchemas }`) do not change. The union check's description names the valid value a plain
    union misreads, not only a damaged one.
- **What the app must change:** Wherever `repo-guards-0.1.42.md` step 5 wires
  `storedDocumentSchemasPlain` in `src/__tests__/guards/config/firestore.ts` (the facts `Pick` and
  the config entry), wire `storedDocumentSchemas` instead: `'storedDocumentSchemas'` in the `Pick`
  and `storedDocumentSchemas: { docSchemas }`.
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.44 or later, and both checks
  of `storedDocumentSchemas` run green in ttt-prod's suite.
