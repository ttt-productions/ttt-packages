# Adopt @ttt-productions/firebase-helpers 0.12.28

**What:** `initFirebaseClient` no longer takes the `firestoreLogLevel` option added in 0.12.27.
**Severity:** low
**Came from:** the Q-Sports Firestore-diagnostics ttt-packages session

- **Package and version:** `@ttt-productions/firebase-helpers` 0.12.28.
- **Release:** `./scripts/release-multiple.sh firebase-helpers monitoring-core notification-core patch`
- **What changed:** `InitFirebaseClientOptions` (`./client`) no longer has `firestoreLogLevel`, and
  `initFirebaseClient` no longer calls the Firestore SDK's `setLogLevel`. The option was added in
  0.12.27 and is removed because the Firestore SDK's debug output is not safe to turn on in a
  browser: at `debug` level it writes request headers and token values to the console.
- **What the app must change:** the install. An app that had started passing `firestoreLogLevel`
  removes it.
- **Done when:** the lockfiles name `@ttt-productions/firebase-helpers` 0.12.28 or later and the
  typechecks are clean.
