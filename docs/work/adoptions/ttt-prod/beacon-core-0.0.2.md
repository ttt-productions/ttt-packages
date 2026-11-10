# Adopt @ttt-productions/beacon-core 0.0.2

**What:** A new shared change-beacon package: the stamp and its schema, the stamp writer, the pure change decision, and the observer hook.
**Severity:** medium
**Came from:** the change-beacon ttt-packages session

- **Package and version:** `@ttt-productions/beacon-core` 0.0.2 (new).
- **Release:** `./scripts/release-multiple.sh beacon-core firebase-helpers monitoring-core notification-core query-core repo-guards q-core patch`.
- **What changed:** the change beacon is now a package (`docs/packages/beacon-core.md`):
  - `.` — `createBeaconStampSchema(fields)` for the stored beacon document (`updatedAt`, `changeId`,
    and the app's own fields), the `BeaconStamp` type, and the pure decision `observeBeacon` with
    `INITIAL_BEACON_OBSERVATION`.
  - `./server` — `writeBeaconStamp(writer, { beacon, ids, schema, fields, now })`, which stamps the
    beacon on the caller's own transaction or batch and mints the change id with no write.
  - `./react` — `useBeaconObserver({ docPath, queryKey, enabled, reportFirstLoad, onChange })`, the
    live read of the beacon through query-core, calling `onChange` with the stamp when it moves.
- **What the app must change:** Install. Building a page onto a beacon is its own work, done when
  that page is picked up; this file only installs.
- **To settle when a page with sections adopts it:** the beacon holds its latest stamp, not a log,
  and the writer replaces the document whole. An observer learns that something changed and the
  latest stamp's fields, not every change in between. A page that re-reads only the section the
  latest stamp names can miss a different section changed just before it, or while the page was
  offline; a page that must not miss one re-reads every section on every report.
- **Done when:** The lockfiles name `@ttt-productions/beacon-core` 0.0.2 or later.
