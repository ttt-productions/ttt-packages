# Adopt @ttt-productions/auth-core 1.6.19

**What:** The signed-out refusal carries a sign-in-required reason, so the app can tell it from the callable runtime's own token refusal.
**Severity:** medium
**Came from:** the ttt-prod shared-standards Phase 3 repair session (fifth package release)

- **Package and version:** `@ttt-productions/auth-core` 1.6.19.
- **Release:** `./scripts/release-multiple.sh auth-core dev-standards monitoring-core repo-guards ttt-core patch`.
- **What changed:**
  - `assertAuth`'s refusal of a caller with no `request.auth` now carries `AuthAssertionError.details` `{ reason: 'sign-in-required' }` (`SIGN_IN_REQUIRED_REASON`, root).
  - Root exports `isSignInRequiredError` (an `unauthenticated` refusal carrying that reason) and `isPlatformTokenRefusal` (an `unauthenticated` refusal carrying no app reason — the one the callable runtime sends, before the handler runs, when it refuses the request's ID or App Check token). Both read the code and `details.reason`, never the message.
- **What the app must change:**
  - Install.
  - The app's `assertAuth` wrapper must forward `details` into the `HttpsError` it builds (as it already does for the acceptance and email-verification refusals).
  - Every other `unauthenticated` refusal the app's backend sends itself carries `details: { reason: SIGN_IN_REQUIRED_REASON }`; otherwise the client would read it as a platform token refusal.
  - Optional: the client callable policy can use `isPlatformTokenRefusal` to treat a refused token as a fault worth capturing, with copy telling the user to reload, instead of an expected answer.
- **Done when:** The lockfiles name `@ttt-productions/auth-core` 1.6.19 or later, no backend `unauthenticated` refusal goes out without the reason, and the gate is green.
