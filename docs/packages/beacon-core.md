# @ttt-productions/beacon-core

Generic change beacon: one small document that says "something changed", which an open page listens
to and reacts to. It is how a page built from many separate reads, or from computed results, learns
that someone else changed it. A page that shows one small document or a short list listens to that
instead and needs no beacon.

## Owns

- **The stamp.** A beacon document holds a stamp: `changeId`, a document id minted fresh by every
  write, and `updatedAt`, epoch milliseconds, beside the app's own fields.
  `createBeaconStampSchema(fields)` is the stored shape with the app's fields plugged in, a plain
  object schema; `BeaconStamp` is the type of the two fields the package owns. The change id is the
  stamp's identity. The time never is: a commit that started first can land last with the older
  time, and two commits can share a millisecond.
- **The writer.** `writeBeaconStamp(writer, { beacon, ids, schema, fields, now })` builds the stamp,
  parses it through the app's schema, and sets it on the caller's own transaction or batch
  (`BeaconStampWriter`: anything with that `set`), so the stamp commits with the change it announces
  or not at all. It mints the change id from `ids`, any collection of the same database, with no
  write. A stamp the schema refuses throws before anything is written, and only fields the schema
  declares are stored. It replaces the document whole, so a stamp never carries a field an earlier
  one left behind.
- **The decision.** `observeBeacon(state, snapshot)` is pure: given what an observer has seen
  (`BeaconObservation`, starting at `INITIAL_BEACON_OBSERVATION`) and one snapshot of the document,
  it answers whether to report and what the observer has now seen.
  - A snapshot that is not live (still connecting, answered from cache, offline, or failed) reports
    nothing and is never taken as seen.
  - The first live snapshot is the baseline. It reports only when the app says a first load reports
    (`reportFirstLoad`).
  - After that, a live snapshot reports when its change id differs from the last one seen live, and
    never for the same id again. A return to live therefore reports only when the id moved while
    the listener was away.
  - A missing document reports nothing and keeps the last id seen. A document stored without an id
    reads as having none.
- **The observer.** `useBeaconObserver({ docPath, queryKey, enabled, reportFirstLoad, onChange })`
  holds the live read of the beacon document, through query-core's `useFirestoreDoc`, and calls
  `onChange` with the stamp (or `null` when a first load reports a missing document) each time the
  decision reports. What it has seen lives in the hook and starts fresh when `docPath` changes. Two
  observers of one beacon share one listener, and each reports to its own `onChange`. A listener
  that fails reports nothing; the failure is the live read's, surfaced as query-core surfaces it.

## What an observer learns

The beacon holds its latest stamp, not a log, and the writer replaces the document whole. An
observer learns **that** something changed, and the latest stamp's fields. It does not learn every
change in between: several commits can land before an observer's next live snapshot, and it sees
only the last. A consumer that re-reads only what the latest stamp names can miss an earlier change;
a consumer that must not miss one re-reads everything the beacon covers on every report.

## Entry points

- `.` — pure: `createBeaconStampSchema`, `BeaconStamp`, and the decision `observeBeacon` with its
  state and snapshot types.
- `./server` — `writeBeaconStamp`, over `firebase-helpers/server`'s Firestore contract.
- `./react` — `useBeaconObserver` (React and query-core are optional peers).

## Boundary

The app supplies the beacon document (one for a whole site, or one per open page), its own fields
and their schema, its query key, whether a first load reports, and what a report does: re-read
quietly, or tell the person. The package names no app, path, field of the app's, or event
(RULE-STD-ARCH-201), captures nothing to monitoring (RULE-STD-QUALITY-102), and never listens to
Firestore itself (RULE-STD-ARCH-206).
