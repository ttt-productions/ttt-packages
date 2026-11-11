# @ttt-productions/sweep-core

Generic scheduled sweeps: the saved position of a sweep, the Auth full scan, and the ways a sweep
walks its source, with and without a retry list. A product hands in its sweep names, where each
saved position lives, its queries, and what its row step does.

## Owns

- **The saved position.** One schema, `SweepStateSchema`, with its parts: the rolling cursor
  (`SweepRollingCursorSchema`, a lap in progress after a key and an optional value, a number or
  null, or a finished lap), the retry list (`deferred`, rows of `SweepDeferredRowSchema`), the Auth lap in
  progress (`SweepAuthScanLapSchema`), the last full scan, and `updatedAt`. Its objects are plain,
  as a stored-document schema's must be (RULE-STD-ARCH-110): a field it does not name is dropped on
  read, never refused. Every time is a whole non-negative number of milliseconds, the retry list
  holds at most `SWEEP_STATE_MAX_DEFERRED` (50) rows and a row at most once, and a finished lap
  completes no earlier than it started. Each product's application-data package registers this
  schema for its saved-position documents.
- **The three numbers.** `SWEEP_STATE_MAX_DEFERRED` (50), `AUTH_LIST_USERS_PAGE_SIZE` (1,000, the
  most one Auth listing returns) and `AUTH_FULL_SCAN_EXAMINED_PER_RUN` (2,000).
- **One reader and one writer.** `createSweepStateStore({ firestore, path })` binds the product's
  Firestore and the path of each sweep's document, typed on the product's own sweep names. `read`
  parses the stored position, or answers nothing for a sweep that never ran. `update(name, patch,
  now)` reads the document in a transaction, changes only the parts the patch names (the cursor,
  the retry list, the Auth lap, the last full scan) and writes the rest back as it was, so a write of
  one part never drops another. An empty retry list is stored as no list.
- **The Auth full scan.** `runAuthFullScanLap` lists accounts a page at a time through the
  product's lister (the Admin SDK's Auth is one), up to `AUTH_FULL_SCAN_EXAMINED_PER_RUN` a run,
  and saves the page after every page. The next run resumes the lap at the saved page; a page token
  Firebase no longer accepts restarts the lap from the first page. A finished lap records when it
  ran, and a new lap waits for the sweep's minimum interval.
- **The sources.** `firestoreIdSource(query)` orders the product's query by document id and
  resumes after the saved id. `firestoreValueSource(query, field)` orders it by a top-level field
  and then by id, and resumes after both, never by "greater than the value", which would skip rows
  tied on it. A value is a number or null: null is a position like any other (Firestore orders it
  before every number), so a run of null-valued rows makes progress, and a saved position with a
  null value resumes after it; a saved position with no value resumes as if it were null. Any other
  value (a string, a boolean, a timestamp, a map) fails the sweep loudly: the walk works the rows
  before it, saves them, and throws `SweepPositionValueError`, which names the field and the row's
  key (`openSweepPage`'s `save` throws it after saving).
  `storageListingSource(lister, prefix)` lists objects under a prefix, resumes at its last object
  and skips that object; within a run it pages on by page token. A Firestore source reads a
  collection's query (a document id is resumed as the id alone).
- **The walk with no retry list,** in two forms. A failed row is met again on the next lap.
  - `openSweepPage` reads one page at the saved position and returns its rows with `save(lastPassed,
    reachedEnd, now)`, which saves the position the sweep names. A sweep that works several saved
    positions together, or stops short of its page, uses this form.
  - `walkSweep` hands each row to the sweep's `visit` (after an optional `preparePage` per page) and
    saves the last row passed. The sweep hands in its limits for one run (pages, rows examined,
    deletes; a page or rows-examined limit is required) and may set a minimum time between laps.
    A row step that throws ends the run: the rows passed before it are saved and the error is
    rethrown.
- **The walk with a retry list.** `walkSweepWithRetryList` first re-reads the rows due on the
  list, the way the sweep reads them, and drops a row whose re-read item is missing: it counts as
  cleared and the row step is never called for it. `rereadDocuments` reads Firestore documents in
  one `getAll` and leaves out a document that no longer exists, so a sweep whose row step must
  still run for a deleted document hands in its own re-read that keeps it. Then it walks the source; a row already on the list is
  passed. Each row comes back `cleared`, `tryLater` (it goes on the list and the walk moves on) or
  `outOfBudget` (the saved position is held there and the row is not counted a failure; a due row
  stays on the list, due again, with its attempt count unchanged). The sweep hands in when a failed
  row is retried: `nextRun`, or its own `growingWait`. When the list is full, the walk keeps
  examining the page, holds its saved position so nothing is skipped, and calls the sweep's
  `onRetryListFull` once. A lap counts as complete only when the position was not held.
- **The reporter.** Both walks take a required `report(error, { kind })`. When a row step (or the
  source) throws and saving the rows passed before it fails as well, the walk reports the save
  failure through it (`kind: 'positionSave'`) and rethrows the row step's own error, so neither is
  lost.

## Entry points

- `.` — pure, zod only: the saved-position schema and its parts, their types, `SweepPosition`, and
  the three numbers.
- `./server` — `createSweepStateStore`, `runAuthFullScanLap`, the three sources and
  `rereadDocuments`, `openSweepPage`, `walkSweep` and `walkSweepWithRetryList`, over
  `firebase-helpers/server`'s Firestore contract and the Auth and Storage listers the product hands
  in.

## Boundary

The product supplies its sweep names, the path of each saved position, its queries and Storage
prefix, its row steps, its limits and retry timing, and what a full retry list reports. The package
names no product, path or sweep (RULE-STD-ARCH-201), captures nothing to monitoring
(RULE-STD-QUALITY-102), and imports no Admin SDK.
