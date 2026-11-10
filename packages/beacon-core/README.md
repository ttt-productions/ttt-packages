# @ttt-productions/beacon-core

Generic change beacon: one small document that says "something changed", which an open page listens
to and reacts to.

- `.` — pure: `createBeaconStampSchema`, the `BeaconStamp` type, and the change decision
  `observeBeacon` with its state.
- `./server` — `writeBeaconStamp`, which stamps the beacon on the caller's transaction or batch.
- `./react` — `useBeaconObserver`.

The app supplies the document, its own fields and their schema, its query key, whether a first load
reports, and what a report does.
