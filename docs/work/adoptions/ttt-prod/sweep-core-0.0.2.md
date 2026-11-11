# Adopt @ttt-productions/sweep-core 0.0.2

**What:** A new shared sweeps package: a sweep's saved position, the Auth full scan, and the walks with and without a retry list, which replace ttt-prod's own copies.
**Severity:** high

- **Package and version:** `@ttt-productions/sweep-core` 0.0.2 (new).
- **Release:** `./scripts/release-multiple.sh dev-standards storage-core firebase-helpers
  ui-core repo-guards theme-core consent-core query-core app-config-core notification-core
  sweep-core auth-core q-core media-viewer file-input upload-core patch`.
- **What the package owns** (`docs/packages/sweep-core.md`):
  - `.` — `SweepStateSchema` and its parts (`SweepRollingCursorSchema`, `SweepDeferredRowSchema`,
    `SweepAuthScanLapSchema`), their types, `SweepPosition`, and the three numbers
    (`SWEEP_STATE_MAX_DEFERRED` 50, `AUTH_LIST_USERS_PAGE_SIZE` 1,000,
    `AUTH_FULL_SCAN_EXAMINED_PER_RUN` 2,000).
  - `./server` — `createSweepStateStore({ firestore, path })` (one reader; one writer that changes
    only the parts a patch names and never drops another), `runAuthFullScanLap`, the sources
    (`firestoreIdSource`, `firestoreValueSource`, `storageListingSource`, and `rereadDocuments`),
    `openSweepPage`, `walkSweep` and `walkSweepWithRetryList`.
- **What ttt-prod hands in:** its sweep names (`SWEEP_STATE_NAMES` stays in ttt-core), the path of
  each saved position (`sweepState/{name}`), its Firestore and Auth, its queries and Storage
  prefixes, each sweep's row step, limits and retry timing, and what a full retry list reports (its
  log and capture).
- **What the app must change:**
  - **ttt-core, in ttt-prod's own session:** its copies of the saved-position schema and its parts
    (`backend-state.ts`, `sweep-cursor.ts`) and the three numbers (`constants/scheduled-jobs.ts`)
    go; its registry binds `sweep-core`'s `SweepStateSchema` for `sweepState/{sweepName}`, and the
    child-safety case takes `SweepRollingCursorSchema` from `sweep-core`.
  - `functions/src/shared/sweep-state.ts` goes. `readSweepState` / `writeSweepState` become one
    store from `createSweepStateStore`; `runAuthFullScanLap` takes that store, the sweep name and
    the Admin SDK's Auth as its lister. `rollingCursorStart` and `advanceRollingCursor` are no
    longer called by any sweep: the walks own them.
  - `functions/src/safety/reconcilerCursor.ts` goes. `openSafetySweepPage` is `openSweepPage` over
    `firestoreValueSource(base, orderField)`, and `openSafetyKeySweepPage` over
    `firestoreIdSource(base)`; the page's rows are already read, and `page.save(lastPassed,
    reachedEnd, now)` saves the position the sweep names. The crossover-legs reconcile opens one page
    for each of its two sweep names, works their rows interleaved under its own budget, and saves
    each page only as far as it got.
  - The other walks with no retry list (the two media reconciles, the two Storage cleanups, the
    private-data reaper, the safety and NCII sweeps that do not need to name their own position)
    sit on `walkSweep` with their limits; a Storage cleanup uses `storageListingSource`.
  - The walks with a retry list sit on `walkSweepWithRetryList`: `reconcilePublicUsers` (its profile
    query by id, `retry: { kind: 'nextRun' }`, and the row step that rebuilds one card), the
    pledge-refund reconcile (`nextRun`), and the hall-media reaper (`growingWait` with its own
    backoff). Each keeps only its query, its row step returning `cleared`, `tryLater` or
    `outOfBudget`, its limits and its retry timing.
  - The retry walk drops a due row whose re-read item is missing and counts it cleared without
    calling the row step. `rereadDocuments` leaves a missing document out, so `reconcilePublicUsers`
    hands the walk its own re-read that keeps a missing profile (a `getAll` that keeps the snapshot
    of a profile that no longer exists); otherwise a profile deleted while it waited on the retry
    list keeps its public card.
- **Every walk call hands in a reporter:** `walkSweep` and `walkSweepWithRetryList` take a required
  `report(error, { kind })`, ttt-prod's logger and capture; a failed save while a row step's error
  is being rethrown is reported through it (`kind: 'positionSave'`), and the row step's error is
  the one rethrown.
- **What changes for ttt-prod:**
  - A value-ordered sweep resumes after a null value as `reconcilerCursor` does today
    (`startAfter(null, key)`), and its saved position now stores that null (the schema's value is
    a number or null). A value that is neither a number nor null now fails the sweep with
    `SweepPositionValueError`, naming the field and the row, after the rows before it are saved;
    the hall-media reaper read such a value as 0 instead.
  - Every saved-position time is a whole non-negative number (its `fullScanLastRunAt` and
    `updatedAt` were any number).
  - An unknown field in a saved position is dropped on read, where ttt-core's strict nested objects
    refuse it today.
  - A save never drops another part of the position (the cursor, the retry list, the Auth lap, the
    last full scan); an empty retry list is stored as no list.
  - A full retry list no longer stops the public-users and pledge-refund sweeps: every sweep keeps
    examining its page, holds its saved position, and reports one warning; a lap is complete only
    when the position was not held.
- **Done when:** the lockfiles name `@ttt-productions/sweep-core` 0.0.2 or later; no sweep in ttt-prod
  reads or writes its saved position, pages its source or keeps a retry list but through the
  package; `functions/src/shared/sweep-state.ts` and `functions/src/safety/reconcilerCursor.ts` are
  gone; and the Normal TTT Test Flow is green.
