# @ttt-productions/firebase-helpers

Generic Firestore utilities (no auth flows, no business logic, no app-specific
collection names).

## Entry points

The **root is pure / universal** — it imports neither the Firebase *client* SDK
nor the Admin SDK at runtime, so it is safe for backend, browser, and React
consumers alike. Firebase client/admin runtime lives behind subpaths.

- `.` — pure helpers: Firestore type guards, path builders, universal
  timestamp/date normalization (`toMillis`, `toDate`, `now`, `formatDate`,
  `formatDistanceToNowStrict`, `formatDateDisplay`), `chunk`, and
  `getFileNameFromUrl`. No `firebase/*` import at runtime.
- `./client` — Firebase **client** SDK initialization (`initFirebaseClient`):
  app/auth/firestore/storage/functions + optional emulator wiring.
- `./firestore-client` — Firestore **client** SDK helpers: batched writes
  (`commitInBatches`, `batchSet`), cursor pagination (`fetchPage`,
  `fetchOrderedPage`), and Timestamp helpers that touch the client SDK
  (`serverNow`, `dateToTs`, `msToTs`, `tsToDate`).
- `./server` — Admin SDK init + server timestamp helpers.
- `./react` — React Query-friendly callable hook primitives.

`firebase` (client SDK) is an **optional** peer — only the `./client` and
`./firestore-client` subpaths require it. The pure root does not.
