# Adopt @ttt-productions/firebase-helpers 0.12.21

**What:** The in-memory admin Firestore's transactions conflict on query reads as real Firestore does, and its `queryResultSetConflicts` option is removed.
**Severity:** medium
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/firebase-helpers` 0.12.21.
- **Release:** `./scripts/release-multiple.sh firebase-helpers patch`.
- **What changed (`./server/testing`):**
  - A transaction that ran a query conflicts and re-runs when a document the query returned is changed or deleted before the commit. An insert into the query's result set, or a document changed into it, no longer conflicts: real Firestore does not lock a result set against either (RULE-STD-BACKEND-116).
  - `makeInMemoryFirestore()` takes no options. `InMemoryFirestoreOptions` and `queryResultSetConflicts` are gone; there is no strict or ignore-queries mode.
- **What the app must change:** Install `@ttt-productions/firebase-helpers@latest` wherever it is declared. Remove any `queryResultSetConflicts` argument or `InMemoryFirestoreOptions` import. A case that depended on an insert into a query's result set forcing a retry now commits on its first attempt. Move that case onto a real trigger: change or delete a document the query returned. If the race the case proves is an insert, the product needs a document both racers write (RULE-STD-BACKEND-116), and the case commits its competing insert together with a write to that document.
- **Done when:** The lockfiles name `@ttt-productions/firebase-helpers` 0.12.21 or later, nothing passes the removed option, and the gate is green with every transaction-retry case on a real trigger.
