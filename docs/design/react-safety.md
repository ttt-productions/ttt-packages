# React and server-safety rule

Cloud Functions and schema-only consumers must not import module graphs that pull React, browser upload code, Next.js, DOM APIs, or CSS side effects.

## Required entrypoint shape

- Main entries must be server-safe.
- React UI must live behind `./react`.
- Admin SDK helpers must live behind `./server`.
- Browser-only upload runtime must live behind `./browser`.
- Pure schemas that are needed by both UI and backend should live in pure packages such as `chat-schemas` or `media-schemas`, not in React-heavy packages.

## Current examples

- `chat-schemas` is pure and safe for `ttt-core` and backend/schema composition.
- `chat-core` main entry is intended to stay server-safe; React UI is behind `./react`.
- `upload-core` exposes browser upload runtime behind `./browser`; guarded UI is in `upload-ui/react`.
- `firebase-helpers/server` is the correct import for Admin SDK helpers.

## Audit checks

When a backend or schema package imports another package, inspect the target package entrypoint and its transitive exports. Do not rely only on TypeScript type-only intent; package root exports can still pull runtime modules if the entrypoint is not split correctly.
