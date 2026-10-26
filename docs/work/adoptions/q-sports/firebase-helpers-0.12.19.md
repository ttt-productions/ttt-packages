# Adopt @ttt-productions/firebase-helpers 0.12.19

**What:** Two Firebase test kits ship: an in-memory Admin Firestore with its FieldValue fake and a no-network Admin test app, and an in-memory client Firestore that answers reads with real SDK snapshots.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/firebase-helpers` 0.12.19.
- **Release:** `./scripts/release-multiple.sh firebase-helpers media-processing-core monitoring-core query-core repo-guards ttt-core upload-core patch`.
- **What changed:** New entries `./server/testing` (`makeInMemoryFirestore`, `FieldValueSentinel` / `fieldValueSentinels`, `testAdminApp`) and `./firestore-client/testing` (`makeInMemoryClientFirestore`, whose `reads` are typed as `firebase/firestore`'s `getDoc`, `getDocFromServer`, `getDocs`, `getDocsFromServer`, `getCountFromServer`, `onSnapshot`, with hooks to fail a read, break a live listener (`failListeners`), answer listeners from cache (`answerFromCache` / `answerFromServer`), hold an answer, and build the SDK's own `FirestoreError` (`firestoreError`)). `vitest` is a new optional peer. Nothing existing changed.
- **What the app must change:** Install only. Adopting the kits is optional: a test tree that keeps its own in-memory Firestore or hand-built client read doubles can move onto them.
- **Done when:** The lockfiles name `@ttt-productions/firebase-helpers` 0.12.19 or later, and the gate is green.
