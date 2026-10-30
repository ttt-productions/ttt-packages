# Adopt @ttt-productions/repo-guards 0.1.38

**What:** The live Firestore subscription guard no longer flags a store source such as query-core's `LiveSessionSource` (`{ read, subscribe }`).
**Severity:** low
**Came from:** the ttt-packages repo-guards session (ttt-prod scope)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.38.
- **Release:** `./scripts/release-multiple.sh repo-guards patch`.
- **What changed:** `firestoreLiveSubscriptions` skips a `subscribe` key (written out or as the shorthand) in an object literal that also holds a `read` key — an external store source, such as the session source passed to query-core's `MutationSessionProvider`. No Firestore read hook takes a `read` option, so live mode on a read hook is still flagged exactly as before.
- **What the app must change:** Install `@ttt-productions/repo-guards@latest` wherever it is declared. If Q-Sports' guard config holds a `firestoreLiveSubscriptions` allowlist entry only for a session source, the guard now reports it stale: delete it.
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.38 or later, no allowlist entry covers only a session source, and the gate is green.
