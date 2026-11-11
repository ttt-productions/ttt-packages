# Adopt @ttt-productions/firebase-helpers 0.12.31

**What:** The root exports the one list of App Check codes that mean a callable was never sent, in two kinds, with a predicate for each.
**Severity:** low

- **Package and version:** `@ttt-productions/firebase-helpers` 0.12.31.
- **Release:** `./scripts/release-multiple.sh theme-core ui-core mobile-core firebase-helpers query-core q-core site-core dev-standards repo-guards patch`.
- **What changed:** additive exports only, on the root beside `APP_CHECK_THROTTLE_CODES`:
  `APP_CHECK_NEVER_SENT_CODES` (`connectionFailed`: the token fetch's network failure,
  `appCheck/fetch-network-error`; `tokenFailed`: the throttle codes and every other way the token
  fetch fails), its types `AppCheckNeverSentKind` and `AppCheckNeverSentCode`, and the predicates
  `isAppCheckConnectionFailure` and `isAppCheckTokenFailure`. `isAppCheckThrottleError` and
  `callCallable`'s limited-use fallback (still triggered by the throttle codes alone) are unchanged.
- **What the app must change:** the install. ttt-prod reaches these through query-core's
  `createCallablePolicy`, which ships in the same release, so no app code needs to import them
  directly.
- **Done when:** the lockfiles name `@ttt-productions/firebase-helpers` 0.12.31 or later and the
  typechecks are clean.
