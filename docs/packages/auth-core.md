# @ttt-productions/auth-core

Generic Firebase Auth package.

## Owns

- Auth provider and hooks
- Claims parsing helpers
- Server-side `createAssertAuth<TUser, TAdmin>(config)` factory pattern. Both the factory and `AuthContext<TUser, TAdmin>` are generic over the consuming app's admin-check result type; the package stays app-agnostic and the consumer supplies `TAdmin`.
- Generic auth floors such as signed-in, email-verified, banned/status handling, and admin requirements supplied by the consuming app. When a callable requests `requirements.admin`, the factory delegates to `config.requireAdmin` and surfaces its result on `ctx.admin` (left `undefined` when no admin check ran).

## Boundary

`auth-core` is app-agnostic. It must not know about TTT Productions works, artisans, work guild standings, work-project actions, Firestore work-project paths, or Q-Sports-specific concepts.

Consuming apps wire the generic factory at their boundary. In `ttt-prod`, `functions/src/shared/assertAuth.ts` binds the user-profile path and user-status/admin semantics. TTT-specific checks such as `assertArtisanCreator` and `assertWorkProjectActionAllowed` live in `ttt-prod`, not in this package.

## Entry points

The root is pure: it exposes only contracts, claims parsing, normalized errors, and environment helpers, and never loads `firebase/auth` at runtime. Client/Admin/React runtimes each live behind an explicit subpath.

- `.` — pure contracts, claims parsing, errors, env helpers (server-safe).
- `./client` — Firebase **client** auth runtime (`onAuthStateChanged` wrapper, `getAuthUser`); importing it pulls `firebase/auth`.
- `./react` — React auth provider and hooks.
- `./server` — Admin SDK / Functions helpers, including `createAssertAuth`.

## Does not own

- guild-membership requirements
- `artisanCreator` requirements
- work-project callbacks such as `isWorkSteward`, `isGuildmateUser`, or `isWorkProjectActionAllowed`
- `ctx.workProject` or any app-specific work-project context
- imports from `@ttt-productions/ttt-core`

If a future app needs domain authorization, add it in that app or in an appropriate app-specific package. Do not leak the domain into `auth-core`.
