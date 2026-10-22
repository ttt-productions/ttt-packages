# Adopt @ttt-productions/ttt-core 0.79.112

**What:** The NCII case and validity ids are built by ttt-core.
**Severity:** medium
**Came from:** the ttt-packages shared-standards run (the NCII id family)

- **Package and version:** `@ttt-productions/ttt-core` 0.79.112.
- **Release:** `./scripts/release-multiple.sh ttt-core patch`.
- **What changed:** `./safety` adds `nciiCaseIdForRequest(requestId)`, `validityDecisionId(requestId, result, decidedByUid, sequence)`, and `validityActionId(requestId, result, sequence)` beside the intake ids, with the exact formulas the app uses today; `result` is a `TakeItDownValidityDecisionResult`.
- **What the app must change:** Install `@ttt-productions/ttt-core@latest` wherever it is declared, then delete the app's three local builders of these ids and import them from `@ttt-productions/ttt-core/safety`.
- **Done when:** The lockfiles name `@ttt-productions/ttt-core` 0.79.112 or later, no NCII case or validity id is built outside ttt-core, and the gate is green.
