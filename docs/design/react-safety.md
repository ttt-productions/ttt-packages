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
- `chat-core` main entry is pure (no React, no Firebase reachable from it) — its React UI was extracted into a fully separate sibling package, `chat-react` (own `.` and `./styles` entries), rather than living behind a `./react` subpath on `chat-core` itself.
- `upload-core` exposes browser upload runtime behind `./browser`; guarded UI is split across `upload-ui/react/upload`, `upload-ui/react/guard`, and `upload-ui/react/tray`.
- `firebase-helpers/server` is the correct import for Admin SDK helpers.

## Audit checks

When a backend or schema package imports another package, inspect the target package entrypoint and its transitive exports. Do not rely only on TypeScript type-only intent; package root exports can still pull runtime modules if the entrypoint is not split correctly.

For the full mechanical procedure (per-package classification, transitive-export checks, built-`dist` grep, and a runnable peer-optionality check), see `docs/playbooks/REACT_LEAK_AUDIT_PLAYBOOK.md`.

## Dependency (install-graph) safety

Server-safe entrypoints are not enough on their own. A package can still force React (or other client-only libraries) into a server-only install - including Cloud Functions - through *required* peer dependencies. npm installs required peers automatically, so a backend that imports only a package's server-safe surface still drags React into its `node_modules` and lockfile.

Rule: every client-only peer must be declared `optional` via `peerDependenciesMeta`. Client-only peers are the ones needed solely by a `./react` (or `./browser`) surface: `react`, `react-dom`, `@tanstack/react-query`, React-ecosystem libraries (`lucide-react`, `react-hook-form`, `@hookform/resolvers`, `react-intersection-observer`), the client `firebase` SDK, and the React-oriented internal packages (`@ttt-productions/ui-core`, `@ttt-productions/query-core`). A consumer that imports a `./react` subpath installs these directly; a consumer that imports only a server-safe surface must never be forced to. Internal infrastructure peers that are themselves server-safe (such as `@ttt-productions/firebase-helpers`) stay required.

Consumers enforce the other side of this: a server-only install (for example `ttt-prod/functions`) is checked to contain none of these client packages in its lockfile. See the consuming app's dependency-audit playbook.
