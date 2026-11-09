# Adopt @ttt-productions/ttt-core 0.79.134

**What:** ttt-core's password length constants and validator are removed; the password policy is auth-core's.
**Severity:** high
**Came from:** the Q-Sports registration-finishes-or-fails ttt-packages session

- **Package and version:** `@ttt-productions/ttt-core` 0.79.134.
- **Release:** `./scripts/release-multiple.sh auth-core ttt-core q-core media-viewer patch`.
- **What changed:** `PASSWORD_MIN_LENGTH` (7), `PASSWORD_MAX_LENGTH` (64) and
  `validateTttPassword` are gone from `constants` and `utils`. The shared policy is auth-core's
  `DEFAULT_PASSWORD_POLICY` (6 to 74 characters), read through `checkPassword` /
  `passwordIssueMessage`; neither product overrides it.
- **What the app must change:** Every reader of the removed names reads auth-core's policy instead
  (the forms, the password reset, the registration callable), as ttt-prod's
  `registration-finishes-or-fails.md` item lays out. The accepted lengths become 6 to 74.
  The console password policy of each Firebase project is set to the same lengths (a human action).
- **Done when:** The lockfiles name `@ttt-productions/ttt-core` 0.79.134 or later and nothing in
  the app names `PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH` or `validateTttPassword`.
