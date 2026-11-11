# Adopt @ttt-productions/firebase-helpers 0.12.27

**What:** `initFirebaseClient` gains an opt-in `firestoreLogLevel` option that sets the Firestore SDK's log level.
**Severity:** low

- **Package and version:** `@ttt-productions/firebase-helpers` 0.12.27.
- **Release:** `./scripts/release-multiple.sh beacon-core firebase-helpers monitoring-core notification-core query-core repo-guards q-core patch`.
- **What changed:** `InitFirebaseClientOptions` (`./client`) has a new optional `firestoreLogLevel`,
  typed as `firebase/firestore`'s `LogLevel`. When it is passed, `initFirebaseClient` calls the
  SDK's `setLogLevel` with it before Firestore is created; when it is left out, nothing changes.
- **What the app must change:** the install. The option is additive and opt-in; ttt-prod passes
  nothing new.
- **Done when:** the lockfiles name `@ttt-productions/firebase-helpers` 0.12.27 or later and the
  typechecks are clean.
