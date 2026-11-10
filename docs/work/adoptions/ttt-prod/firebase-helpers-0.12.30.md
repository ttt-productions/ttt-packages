# Adopt @ttt-productions/firebase-helpers 0.12.30

**What:** `./client` exports the Auth boot guard's request fragments, retry delays and attempt count.
**Severity:** low
**Came from:** the Q-Sports auth-boot ttt-packages session

- **Package and version:** `@ttt-productions/firebase-helpers` 0.12.30.
- **Release:** `./scripts/release-multiple.sh firebase-helpers patch`.
- **What changed:** additive exports only, beside `installAuthBootLookupGuard` and
  `classifyBootLookupFailure` on `./client`: `BOOT_LOOKUP_URL_FRAGMENT` and
  `BOOT_TOKEN_REFRESH_URL_FRAGMENT` (the two boot requests the guard guards),
  `BOOT_REQUEST_RETRY_DELAYS_MS` (the wait before each retry) and `BOOT_REQUEST_ATTEMPTS` (the
  attempts one guarded request makes, derived from the delays). The guard's behaviour is unchanged.
- **What the app must change:** the install. Code that restates any of these values can import
  them instead.
- **Done when:** the lockfiles name `@ttt-productions/firebase-helpers` 0.12.30 or later and the
  typechecks are clean.
