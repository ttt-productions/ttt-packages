# Adopt @ttt-productions/firebase-helpers 0.12.26

**What:** The unused batched-write helpers `commitInBatches` and `batchSet` are deleted.
**Severity:** low
**Came from:** the Q-Sports data-rules ttt-packages session

- **Package and version:** `@ttt-productions/firebase-helpers` 0.12.26.
- **Release:** `./scripts/release-multiple.sh notification-core firebase-helpers q-core dev-standards patch`.
- **What changed:** `./firestore-client` no longer exports `commitInBatches`, `batchSet`,
  `BatchApplyFn` or `CommitInBatchesResult`, and `./server` no longer exports `commitInBatches`,
  `BatchApplyFn` or `CommitInBatchesResult`; both split work by a 500-write limit Firestore no
  longer has, and nothing called them. `./server` still exports `CreateOnlyWriter`.
- **What the app must change:** the install; ttt-prod imports none of the deleted names.
- **Done when:** the lockfiles name `@ttt-productions/firebase-helpers` 0.12.26 or later and the
  typechecks are clean.
