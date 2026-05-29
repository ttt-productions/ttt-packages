# @ttt-productions/auth-core

Generic Firebase Auth package.

## Owns

- Auth provider and hooks
- Claims parsing helpers
- Server-side `createAssertAuth<TUser>(config)` factory pattern
- Generic auth floors such as signed-in, email-verified, banned/status handling, and admin requirements supplied by the consuming app

## Boundary

`auth-core` is app-agnostic. It must not know about TTT Productions works, artisans, work guild standings, work-project actions, Firestore work-project paths, or Q-Sports-specific concepts.

Consuming apps wire the generic factory at their boundary. In `ttt-prod`, `functions/src/shared/assertAuth.ts` binds the user-profile path and user-status/admin semantics. TTT-specific checks such as `assertArtisanCreator` and `assertWorkProjectActionAllowed` live in `ttt-prod`, not in this package.

## What does not belong here

- guild-membership requirements
- `artisanCreator` requirements
- work-project callbacks such as `isWorkSteward`, `isGuildmateUser`, or `isWorkProjectActionAllowed`
- `ctx.workProject` or any app-specific work-project context
- imports from `@ttt-productions/ttt-core`

If a future app needs domain authorization, add it in that app or in an appropriate app-specific package. Do not leak the domain into `auth-core`.
