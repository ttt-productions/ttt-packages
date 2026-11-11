# Adopt @ttt-productions/firebase-helpers 0.12.29

**What:** The Auth boot lookup guard also guards the boot token refresh: a session the server ended reads as identity, and an outage no longer drops the session.
**Severity:** medium

- **Package and version:** `@ttt-productions/firebase-helpers` 0.12.29.
- **Release:** `./scripts/release-multiple.sh firebase-helpers patch`.
- **What changed:** when the persisted ID token has expired, the Auth SDK's boot reload refreshes it
  at the token endpoint before its `accounts:lookup`, and a refused refresh purges the session
  without any lookup. `installAuthBootLookupGuard` now runs that one boot refresh through the same
  classification and retry as the boot lookup:
  - a refusal with `TOKEN_EXPIRED`, `USER_DISABLED` or `USER_NOT_FOUND` is classed `'identity'`
    and handed to the SDK untouched, never retried, so the SDK signs the account out;
  - a transient, attestation (after a forced App Check token refresh) or network failure is
    retried with the lookup's delays, and when the retries are spent the SDK reads a network
    failure and keeps the persisted session, where before it purged it;
  - `getLastBootLookupFailureClass()` (and the `failureClass` `AuthBootPurgeSentinel` hands
    `onPurged`) carries the class of that refresh, where it was `null` before.

  A refresh later in the session is neither classified nor retried, and the lookup path is
  unchanged. `./client` adds one test seam, `__resetAuthBootLookupGuard()`, beside
  `__resetFirebaseClientCache`; no other export changed.
- **What the app must change:** the install. An app that reads the boot failure class now receives
  a class for a purge during an expired-token boot instead of `null`.
- **Done when:** the lockfiles name `@ttt-productions/firebase-helpers` 0.12.29 or later and the
  typechecks are clean.
