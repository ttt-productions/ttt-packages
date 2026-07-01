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

## Entry points

The root is pure/server-safe — pure path, timestamp, pagination, and batch helpers that never load a browser Firebase runtime. Client-only and Admin-only runtimes live behind explicit subpaths.

- `.` — pure helpers (paths, timestamps, `getFileNameFromUrl`); server-safe. Pagination and batch are NOT on root — they live on `./firestore-client` (client SDK) and `./server` (Admin SDK batch), since both need a runtime `firebase/firestore` import.
- `./server` — Admin SDK init helper, server-only handles, and admin-SDK batch helpers.
- `./react` — generic callable hook/client primitives.
- `./client` — Firebase **client** app init helper (browser runtime).
- `./firestore-client` — client Firestore helpers (browser runtime).
