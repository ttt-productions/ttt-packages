# Adopt @ttt-productions/auth-core 1.6.20

**What:** auth-core owns the password policy and a registration that finishes or fails: a server engine, a registration hold, and the register-then-sign-in client flow.
**Severity:** high
**Came from:** the Q-Sports registration-finishes-or-fails ttt-packages session

- **Package and version:** `@ttt-productions/auth-core` 1.6.20.
- **Release:** `./scripts/release-multiple.sh auth-core ttt-core q-core media-viewer patch`.
- **What changed:**
  - Root: `DEFAULT_PASSWORD_POLICY` (6 to 74 characters, length only), `definePasswordPolicy`,
    `checkPassword`, `passwordIssueMessage`; `DEFAULT_REGISTRATION_ENGINE_SETTINGS` (a 60-second
    function timeout) and `defineRegistrationEngineSettings`; the registration refusal contract
    (`registrationRefusalReason`, `REGISTRATION_REFUSAL_CODES`: `email-already-registered` →
    `already-exists`, `password-refused` → `invalid-argument`).
  - `./server`: `registerAccount(adapter, request)` — checks the password, runs the app's
    pre-checks, creates the login with the Admin SDK (display name set), runs the app's
    one-transaction account write, and deletes the login when that write fails or refuses
    (a failed delete goes to `onLoginDeleteFailure`). Refusals throw `RegistrationRefusalError`
    with `code` and `details` the app forwards into its `HttpsError`.
  - `./react`: the auth context gains `registering`, `beginRegistration` / `endRegistration`
    and `holdRegistration(work)`. While a hold is open `useAuth` reports signed out, not loading.
  - `./client`: `registerAndSignIn({ auth, email, password, register, isUnknownOutcome })` and
    `RegistrationNotCompletedError`.
- **What the app must change:** ttt-prod builds the same registration from this release; its
  design is its item `docs/work/waiting-to-be-implemented/registration-finishes-or-fails.md`. Every
  password check reads the policy ttt-core declares (6 to 74) instead of ttt-core's removed
  constants (see `ttt-core-0.79.134.md`). auth-core's `DEFAULT_PASSWORD_POLICY` and
  `DEFAULT_REGISTRATION_ENGINE_SETTINGS` are not used: a later auth-core release removes them, since
  each product provides its own values. A fake of the auth
  context in tests gains the four new members. Until ttt-prod builds its item, the install alone
  changes no behavior: no hold is opened and the new exports are unused.
- **Done when:** The lockfiles name `@ttt-productions/auth-core` 1.6.20 or later and the app's
  test fakes of the auth context type-check.
