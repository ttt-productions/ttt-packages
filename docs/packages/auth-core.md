# @ttt-productions/auth-core

Generic Firebase Auth package.

## Owns

- Auth provider and hooks
- Claims parsing helpers
- Server-side `createAssertAuth<TUser, TAdmin, TAdminOptions>(config)` factory pattern. The factory, `AssertAuthConfig`, `AssertAuthFn`, and `AuthRequirements<TAdminOptions>` are generic over the consuming app's admin-check options (`TAdminOptions`, what `requirements.admin` carries and `config.requireAdmin` receives) and result (`TAdmin`, surfaced on `AuthContext<TUser, TAdmin>`); the package defines neither, and the consumer supplies both. `TAdminOptions` defaults to `never`, so an app that declares no admin options type cannot pass `requirements.admin`.
- Generic auth floors such as signed-in, email-verified, banned/status handling, and admin requirements supplied by the consuming app. When a callable requests `requirements.admin`, the factory delegates to `config.requireAdmin` and surfaces its result on `ctx.admin` (left `undefined` when no admin check ran).
- The email-verification refusal. A callable that requires `emailVerified` refuses a caller whose token is not email-verified with `failed-precondition` whose `AuthAssertionError.details` is `{ reason: 'email-verification-required' }`; the message text is not part of the contract. The app forwards `details` into its `HttpsError`, and `isEmailVerificationRequiredError` (root) recognizes the refusal on either side by code and `details.reason`, never by message. Both structured refusals share one failed-precondition code set (server and client-SDK spellings), and each recognizer rejects the other's details.
- The sign-in refusal. A caller with no `request.auth` is refused with `unauthenticated` whose `AuthAssertionError.details` is `{ reason: 'sign-in-required' }`; the app forwards `details` into its `HttpsError`, and marks every other `unauthenticated` refusal it sends itself with the same reason. `isSignInRequiredError` (root) recognizes it by code and `details.reason`. `isPlatformTokenRefusal` (root) is the other side: an `unauthenticated` refusal that carries no app reason, which only the callable runtime sends — before the handler runs — when it refuses the request's tokens. Neither reads the message.
- An optional acceptance-level gate. An app whose users must accept published documents configures `acceptance: { claimKey, requiredLevel }`: the caller's accepted level is read from that ID-token claim, the required level from the app's reader (which must be cheap — a cached snapshot, never a Firestore read per call), and a caller below it is refused with `failed-precondition` whose `AuthAssertionError.details` is `{ reason: 'acceptance-required', requiredLevel, acceptedLevel }`. The app forwards `details` into its `HttpsError` so the client can answer with its acceptance prompt; `isAcceptanceRequiredError` (root) recognizes the refusal on either side. Levels normalize through `normalizeAcceptanceLevel`: an unreadable accepted level is 0 (fails closed), an unreadable required level requires nothing. Callables that must work before acceptance pass `requirements.allowUnaccepted`. The gate runs after the status check and before the admin check; without `acceptance` config nothing changes. The claim name, what raises the level, and which callables opt out are the app's.
- Claims that belong to the current session (`AuthProvider` on `./react`). Claims are held with the signed-in session they were read for — the Firebase `User` instance, which carries the uid and is replaced on every sign-in — and `claims` / `claimsLoading` are derived from them at render: a render never pairs one account's `user` with another account's claims, and `claimsLoading` stays true until the current session's claims resolve (a direct account switch, or the same uid signing back in, reads again). Every read — the initial one and `refreshClaims` — takes a generation; a read that settles after its session ended, or after a newer read applied, is dropped. A failed read leaves the session's claims as they are, or settles an unread session on `defaultClaims`. `refreshClaims` force-refreshes the ID token of the user signed in when it is CALLED (`config.auth.currentUser`), never the user of the render that produced it: a registration flow holds the callback from before its account existed, and must still refresh the new account onto the claims the server just set.
- An optional readiness gate (`readyGate` on `AuthProvider`). Until the gate settles, `loading` stays true and the context exposes `user: null`, `isAuthenticated: false` and `defaultClaims` even for a restored session, so a uid-keyed subscription cannot mount into the window the gate exists to close; claims are still read underneath. The gate fails open: a rejection is reported through `onError('readyGate')` and the session is then exposed.
- Route protection (`useAuthGuard` on `./react`). Public routes come ENTIRELY from the caller's `publicRoutes` config, matched by prefix, so a dynamic public section is listed as its prefix (`'/share/'`). The hook holds no built-in or implicit public route — an app-specific path baked in here would be a RULE-STD-ARCH-201 violation and would silently override the consumer's own config. A signed-out visit to a protected route saves the path for the post-login redirect; a session END (an observed signed-in → signed-out transition, whatever caused it) saves nothing for the pathname it ended on and clears any saved path, so the next account to sign in on the device never lands on the previous account's page. Every redirect-key storage access is guarded: a blocked store reads as nothing saved, and a blocked write keeps the path in memory for the page's life.
- Normalized auth-error mapping (`normalizeAuthError`, `getErrorMessage`) and environment helpers (`getAppEnvironment`, `isDevelopment`, `isProduction`). Consumers call `getErrorMessage()` instead of restating provider-code maps. Email-action (`oobCode`) failures — expired and invalid/already-used links — map to stable generic copy that names the recovery step and never discloses whether an account exists. Every failure no mapped code covers (`AUTH_UNKNOWN`) gets the one fixed `UNKNOWN_AUTH_ERROR_MESSAGE`, never the error's own message — for an unclassified Firebase failure that text is the SDK's internal diagnostic. The consumer reports such a failure to its own monitoring; the package stays monitoring-agnostic.

## Boundary

`auth-core` is app-agnostic. It knows no app's domain objects, roles, memberships, per-resource actions, or Firestore paths.

Consuming apps wire the generic factory at their boundary: the app's own assert-auth module binds its user-profile path and user-status/admin semantics. App-specific checks (role or capability assertions, per-domain action permissions) live in the app, not in this package.

## Entry points

The root is pure: it exposes only contracts, normalized errors, and environment helpers, and never loads `firebase/auth` at runtime or in its types. Client/Admin/React runtimes each live behind an explicit subpath.

- `.` — pure contracts, errors, env helpers, and the email-verification, acceptance, and sign-in refusal contracts (server-safe).
- `./client` — Firebase **client** auth runtime (`onAuthStateChanged` wrapper, `getAuthUser`) and the ID-token claims helpers typed on `firebase/auth` (`getIdTokenClaims`, `refreshClaims`, `refreshClaimsFromAuth`, `parseClaims`, `IdTokenClaims`, `ParsedClaims`); importing it pulls `firebase/auth`.
- `./react` — React auth provider and hooks.
- `./server` — Admin SDK / Functions helpers, including `createAssertAuth`.

## Does not own

- an app's admin tiers or admin check modes (`TAdminOptions` is the app's type)
- membership, role, or capability requirements
- per-resource action permissions, or any resource context on `ctx`
- imports from an application-data package

If a future app needs domain authorization, add it in that app or in an appropriate app-specific package. Do not leak the domain into `auth-core`.
