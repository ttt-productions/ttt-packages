# @ttt-productions/firebase-helpers

Generic Firebase helper package.

## Owns

- Firestore path helpers
- Timestamp conversion helpers
- Pagination and batch helpers
- Admin SDK init helper on `./server`
- Client Firebase init helper
- Generic file-url helper `getFileNameFromUrl`
- Generic callable hook/client helpers on `./react`

## Boundary

TTT config, Firebase project values, toast behavior, monitoring behavior, and callable names live in app wrappers. `firebase-helpers/react` exposes generic primitives; the consuming app decides how errors are surfaced.

Backend code should prefer `@ttt-productions/firebase-helpers/server` when it needs Admin SDK handles.
