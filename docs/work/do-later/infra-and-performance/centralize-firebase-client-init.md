# Centralize Firebase client init into firebase-helpers

**Area:** infra-and-performance · **Priority:** P2 · **Effort:** M
**Trigger:** a second consumer app starts integrating the packages and needs Firebase client init.
**Severity:** medium — not a launch blocker, but its cost grows with every consumer app.

---

## Context

`@ttt-productions/firebase-helpers` owns `initFirebaseClient()` (`src/client/firebase-init.ts`): config
validation, idempotent `initializeApp` + Firestore / Auth / Storage / Functions handles, and emulator
wiring. It deliberately leaves App Check, Analytics, env-var reading, and named-export ergonomics to
the consumer. The server side is already shared: apps adopt `getAdminApp()` from
`firebase-helpers/server`.

So each consumer app writes its own client-init module around the helper — today about 170 lines in
the first app — holding App Check initialization (its HMR-safe single-init flag, its local and test
handling, the missing-site-key warning), Analytics, and the throw-if-not-initialized getters.

## Why it matters once a second app consumes the packages

1. **Duplicated subtle code.** HMR-safe init and App Check's local/test handling are easy to copy
   wrong, and every app would hold its own copy.
2. **One bug, many fixes.** An App Check init regression would need porting into each app; a package
   fix reaches all of them on their next install (as the `getAdminApp` credential fix did).
3. **Drift between apps** in App Check behavior.
4. **Duplicated test setup** for "a Firebase client in test mode".
5. **A blurred seam.** Pure Firebase init and App Check / Analytics are generic with app-supplied
   config; only env-var names and export ergonomics are the app's.

## Suggested shape (design when picked up)

`@ttt-productions/firebase-helpers/client` grows opt-in helpers beside `initFirebaseClient(config,
options)`:

- `initAppCheck(app, options)` — owns the single-init flag, the local/test handling, and the
  missing-site-key warning; every value (site key, test token, emulator mode) comes from the app.
- `initAnalytics(app)` — browser-only `getAnalytics` with the SSR guard.

Each app's client-init module shrinks to reading its own env names and passing the values in.

## Why not now

1. Not a launch blocker: the first app's module works and is tested, and a migration risks an App
   Check regression that surfaces only in a deployed environment.
2. No second consumer yet, so the duplication does not exist.
3. The `initAppCheck` / `initAnalytics` API (options, defaults, emulator handling) is best designed
   against two concrete consumers.
4. Env-var reading stays app-side regardless, so the win is real but capped.

## When to revisit

- A second app starts integrating the packages and needs Firebase client init — design the helpers
  against both apps.
- Or an App Check init bug turns up that every app would need fixed.
- Or opportunistically in a quiet stretch after launch.

## Related

- `packages/firebase-helpers/src/client/firebase-init.ts` — the existing client helper.
- `packages/firebase-helpers/src/server/admin-init.ts` — the server equivalent, already adopted.
