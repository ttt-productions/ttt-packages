# A test store that can witness a real transaction race

**What:** The Functions tests' default in-memory Firestore has query result-set conflict detection on, which real Firestore does not, so a case cannot prove that a document touch is what makes two racing transactions conflict.
**Severity:** low
**Came from:** the shared-standards Phase 3 repair session (ttt-prod scope), fixing ttt-prod's realm-file folder and promotion tests
**Trigger:** after launch, when DJ turns to improving the test code

This is a write-up of the item as it is known now, not a finished design.

## The gap

Real Firestore does not lock a query's result set against an insert (RULE-STD-BACKEND-116). A
transaction that must conflict with a racer touches a document they both write; the realm-file
folder create and rename, and the promotion approval, touch the Realm or folder doc for exactly this
reason. firebase-helpers' in-memory admin store defaults to `queryResultSetConflicts: true`, so any
competing insert into a queried collection already forces a retry, with or without the touch.
ttt-prod's `functions/src/work-project-management/runRealmFileFolders.test.ts` (create and rename)
and `runApproveRealmFilePromotion.test.ts` therefore prove only "read in the transaction and touched
in the same commit". They were renamed to say that. They cannot prove the race.

## Fix shape (not decided)

Either a per-test way to build the module's `db` from `makeInMemoryFirestore({
queryResultSetConflicts: false })` in ttt-prod's Functions test setup, or a kit option to switch it
off for one store. Then the race cases commit a competing write through `afterRead` and assert two
attempts plus the right outcome, and fail when the touch is removed. Whether the default should stay
lenient is part of the decision. It is kit-side (`firebase-helpers`) or app test-setup-side.

## Done when

A Functions test can run against a store with real Firestore's conflict semantics, and the
realm-file race cases prove the conflict with a witness that fails when the touch is removed.
