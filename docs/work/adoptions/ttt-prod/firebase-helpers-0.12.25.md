# Adopt @ttt-productions/firebase-helpers 0.12.25

**What:** The Admin in-memory Firestore test kit answers `listDocuments()` and `listCollections()`.
**Severity:** low
**Came from:** the Q-Sports 5c test-tree session

- **Package and version:** `@ttt-productions/firebase-helpers` 0.12.25.
- **Release:** `./scripts/release-multiple.sh firebase-helpers patch`.
- **What changed:**
  - `@ttt-productions/firebase-helpers/server/testing` `makeInMemoryFirestore()`: a collection's
    `listDocuments()` names every document under it, including a missing one that holds a
    subcollection, and a document's `listCollections()` names the subcollections that hold
    documents. `failQueries` fails a listing of the path it matches. Both threw before.
- **What the app must change:** Install. A test that stood in for either method by hand can use the
  kit's store instead.
- **Done when:** The lockfiles name `@ttt-productions/firebase-helpers` 0.12.25 or later and the gate
  is green.
