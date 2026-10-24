# @ttt-productions/firebase-helpers

Generic Firestore utilities (no auth flows, no business logic, no app-specific
collection names).

## Entry points

The **root is pure / universal** — it imports neither the Firebase _client_ SDK
nor the Admin SDK at runtime, so it is safe for backend, browser, and React
consumers alike. Firebase client/admin runtime lives behind subpaths.

- `.` — pure helpers: Firestore type guards, path builders, universal
  timestamp/date normalization (`toMillis`, `toDate`, `now`, `formatDate`),
  `chunk`, and `getFileNameFromUrl`. No `firebase/*` import at runtime or in
  its types.
- `./client` — the one Firebase **client** setup (`initFirebaseClient`): config
  validation, the persistent Firestore cache, App Check and its first-token wait,
  the Auth boot lookup guard, emulator wiring, and the consent-gated Analytics handle.
- `./firestore-client` — Firestore **client** SDK helpers: batched writes
  (`commitInBatches`, `batchSet`), cursor pagination (`fetchPage`,
  `fetchOrderedPage`), and Timestamp helpers that touch the client SDK
  (`serverNow`, `dateToTs`, `msToTs`, `tsToDate`), and the names typed on
  `firebase/firestore` (`DocSnap`, `QueryDocSnap`, `withId`, `TimestampLike`,
  `formatDateDisplay`).
- `./server` — Admin SDK init + server timestamp helpers.
- `./react` — React Query-friendly callable hook primitives and the Firebase
  Analytics page-view, identity, and event pieces.

`firebase` (client SDK) is an **optional** peer — only the `./client`, `./react`, and
`./firestore-client` subpaths require it. The pure root does not.
