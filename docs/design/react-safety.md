# React Safety: Main entry must be server-safe

Every package's main entry (`.`) must be importable from a Node.js server-only context (Cloud Functions, build scripts, server-side rendering helpers) without dragging React, JSX, or browser-only APIs into the module graph. React UI lives behind a separate `./react` subpath. Cloud Functions/Admin SDK code lives behind `./server` for packages that have it.

`auth-core` is the reference example. Its `package.json` has separate `.` and `./react` entries, its `src/index.ts` exports only server-safe primitives, and its `src/react/index.ts` exports the React surface. Use it as the bar.

## Rule

A package's main entry is **server-safe** if and only if:

1. `src/index.ts` (or `.tsx`) does not import from `react`, `react-dom`, or any React-specific library (`@tanstack/react-query`, `framer-motion`, etc.)
2. It does not contain JSX
3. It does not import browser-only Firebase SDK surfaces such as `firebase/storage` upload/delete runtime APIs
4. It does not re-export from any file that itself violates rule 1, 2, or 3
5. It does not re-export from a path matching `./react`, `./ui`, `./components`, or `./hooks` (these names signal React-coupled code by convention)

React surface lives behind `./react`:
- Hooks (anything starting with `use*` that calls a React hook internally)
- Components (anything that returns JSX)
- Providers, contexts
- Utilities that import any of the above

Cloud Functions/Admin SDK surface lives behind `./server` when a package needs it:
- Admin SDK imports (`firebase-admin/firestore`, `firebase-admin/storage`, etc.)
- Cloud Function handlers shared across apps
- Server-side helpers that depend on admin credentials

CSS may live behind `./styles`, `./styles.css`, or another explicit CSS subpath. CSS subpaths are side-effect imports and do not make the main barrel unsafe.

Main does NOT re-export from `./react` or `./server`. The surfaces are independent.

## Why

- **Functions emulator stability.** A package whose main entry pulls React into the module graph crashes the Cloud Functions emulator on cold start because Node ESM cannot resolve `react/jsx-runtime` in a server-only context. We hit this with `chat-core` re-exporting UI components from main; the only reason `firebase-helpers` and `media-contracts` work in Functions is that they don't import React.
- **Bundle size for consumers.** Apps that only need server-safe primitives (constants, types, schemas) shouldn't have to tree-shake React out of their backend bundle. Splitting at the entry boundary makes the dependency graph honest.
- **Clear contracts at the import site.** `from "@ttt-productions/chat-core"` means "I want server-safe things." `from "@ttt-productions/chat-core/react"` means "I want React things." Mixing them in main makes every import line ambiguous.
- **Pre-launch consistency.** All packages get the same shape — no "this one is React-only so it doesn't need a split" exception. Long-term consistency over short-term convenience.

## Where it applies

- Every package in `packages/`. No exceptions.
- New packages must follow the shape from day one. Use `auth-core` as the template when scaffolding.
- The rule applies regardless of whether the package currently has Node consumers. `mobile-core` has no Node consumer today, but the cost of complying is low and the shape stays uniform.
- Internal package-to-package imports follow the same rule as app imports: React surface from another package uses `/react`; server/Admin helpers use `/server`; types/constants/pure helpers use main.

## What it forbids

- Main entry re-exporting JSX components.
- Main entry re-exporting React hooks (anything that calls `useState`, `useEffect`, `useContext`, `useMemo`, `useCallback`, etc.).
- Main entry re-exporting from `./react/index.js` (or any path matching `./react`, `./ui`, `./components`, `./hooks`).
- Main entry re-exporting from a barrel file that re-exports React-touching or browser-only Firebase Storage runtime code.
- "Dual" exports where the same runtime React symbol is available on both `.` and `./react` paths. Pick one.
- Backwards-compat shims that re-export React from main "just for migration." Pre-launch, the answer is to update the consumer, not to compromise the package shape.
- Consumer or internal-package imports that pull React components/hooks/providers from another package's main barrel when that package has `/react`.

## What it allows

- `export type` lines from React component files. Types are erased at compile time and don't pull React into the runtime graph. Verify by reading the compiled `dist/index.js` — type-only re-exports leave no trace.
- Server-safe constants colocated with React code, exported from main via explicit named re-exports of the constants.
- Source files that export both types and runtime constants, as long as the server-safe barrel uses explicit named re-exports. `chat-core/src/types.ts` is the current example: `GROUP_GAP_SEC` is a runtime constant, so `src/index.ts` lists every exported type/value explicitly instead of using `export *` or `export type *`.
- Three-surface packages (`.` + `./react` + `./server`) for packages that have both React UI and Cloud Function/Admin SDK code. `notification-core` and `report-core` are the current examples. Browser-only runtime code that is not React should get an explicit browser/client subpath rather than living on main.
- CSS side-effect subpaths such as `./styles` or `./styles.css`.

## When to revisit

- If a packaging system (Vite 7, Bun, etc.) lands meaningful conditional-export improvements that solve the dual-graph problem more elegantly.
- If we adopt a different module resolver (e.g. moving Functions to a bundler-built artifact rather than raw `npm install`) that obviates the issue.
- If the post-launch chat architecture review concludes that `chat-core` should be split into multiple packages — at that point, revisit whether the rule still makes sense or whether smaller packages with single-purpose main entries are the better answer.

Until any of the above happens, the rule stands. Every package, every release.

## Checking compliance

The audit methodology lives in `docs/playbooks/REACT_LEAK_AUDIT_PLAYBOOK.md`. Run it after every package release that touches main-entry exports.
