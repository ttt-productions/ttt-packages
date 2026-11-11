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
- Route protection (`useAuthGuard` on `./react`). Public routes come ENTIRELY from the caller's `publicRoutes` config, matched by prefix, so a dynamic public section is listed as its prefix (`'/share/'`). The hook holds no built-in or implicit public route — an app-specific path baked in here would be a RULE-STD-ARCH-201 violation and would silently override the consumer's own config. A signed-out visit to a protected route saves the path for the post-login redirect; a session END (an observed signed-in → signed-out transition, whatever caused it) saves nothing for the pathname it ended on and clears any saved path, so the next account to sign in on the device never lands on the previous account's page. The saved path lives under `redirectKey`, the app's whole storage key, which the caller always hands in (the package types no key), and is read and written through storage-core's guarded `readStoredValue` / `writeStoredValue`: a blocked store reads as nothing saved, a blocked write keeps the path in memory for the page's life, and the app's own reads and writes of the same key through storage-core see the same path. `@ttt-productions/storage-core` is an optional peer, used only by `./react`.
- The password policy (root): its shape (`PasswordPolicy`, length only), `definePasswordPolicy`, which takes every value and refuses lengths no password can meet, `checkPassword`, and `passwordIssueMessage`. The package holds no policy value: each product's application-data package declares its own policy, and every form, the password reset, and the registration engine read that one declaration. Admin `createUser` applies no hosted password policy, which is why the engine checks it itself; each project's console password policy is set to the product's policy so a password reset is held to the same lengths.
- The account schemas (root): `accountEmailSchema` (an email up to `ACCOUNT_EMAIL_MAX_LENGTH`, 320 characters) and `accountPasswordSchema(policy)`, built from the policy a product provides, each with the shared messages. Every product form and registration input reads them; no product keeps a copy.
- Maintenance (root and `./server`). The refusal is `unavailable` with `details` `{ reason: 'maintenance' }` (`MAINTENANCE_REFUSAL_CODE`, `MAINTENANCE_REFUSAL_REASON`, `MaintenanceRefusalDetails`); `isMaintenanceRefusalError` (root) recognizes it on either side by code and `details.reason`, never by message. The check (`createMaintenanceCheck(config)` on `./server`) reads the product's maintenance state (`config.read`, `{ on, message }`, which must be cheap — a cached snapshot) and passes everyone while it is off; while it is on it passes only a caller the product's `config.isAdmin` names, and refuses anyone else, or no caller at all, with the product's message. A read that fails fails the check. `createAssertAuth` runs it as a configured gate (`maintenance`), after the status check and before the acceptance and admin checks; an entry point with no signed-in caller calls the check itself with no caller. The message, how maintenance is read, and who is an admin are the product's.
- Registration that finishes or fails (`registerAccount` on `./server`). Given the app's adapter, the engine checks the password against the product's policy, runs the app's pre-checks (cheap refusals, so a refused press usually creates no login), creates the login with the Admin SDK (setting the display name), and runs the app's one-transaction account write under the new uid. When that write fails or refuses, it deletes the login before answering — a failed delete goes to the adapter's `onLoginDeleteFailure` — so a failed registration leaves no login. An email that already has a login and a password Auth refuses come back as `RegistrationRefusalError`, whose `code` and `details.reason` the app forwards into its `HttpsError`; `registrationRefusalReason` (root) recognizes them on either side. The password never appears in a refusal. The engine's settings shape (`RegistrationEngineSettings`, its function timeout) and `defineRegistrationEngineSettings`, which takes every value, sit at the root; each product declares its own, with the timeout below the client's callable deadline, so a client deadline means the server has finished either way.
- The registration hold (`AuthProvider` on `./react`): `registering`, `beginRegistration` / `endRegistration` (each token ends only its own hold), and `holdRegistration(work)`, which holds for a whole press. While any hold is open, `useAuth` reports signed out — `user: null`, default claims, not loading — to every reader, so the page behind a registration does not change until the press has finished; when the last hold ends the session underneath is exposed as it is. A press reads the uid its own sign-in returned, never `useAuth`.
- The client registration flow (`registerAndSignIn` on `./client`): it calls the app's entry point and, on its answer, signs in with the same email and password. An outcome the app's `isUnknownOutcome` calls unknown (a deadline, a dropped answer) is settled by that same sign-in: one that works means the account exists, and one Auth refuses throws `RegistrationNotCompletedError`. A refusal from the entry point is rethrown and no sign-in is tried.
- The account's Auth claims and disabled flag kept in step with what the product stores (`./server`,
  with the queue entry schema on the root). The product hands in its Firestore, its Auth (an
  `AccountRepairAuth`: the Admin SDK's Auth is one), the `name` every log line starts with, its
  paths, its statuses, how the stored status is read, its other claims, its audit writer, its
  logger and capture with its log field name, and its saved position for the full scan.
  - **The claim writer.** `updateClaim(auth, uid, patch)` merges a change into the claims the
    account holds and removes a claim set to `false`.
  - **The repair queue.** `createAccountRepairQueueEntrySchemas({ statusEffect, claimEffects,
    statusSchema })` (root) builds the entry schemas from the product's effect names and status
    schema: plain objects, discriminated on `authEffect`, keyed by the account's document id with
    no `uid` field. A status entry requires `reason: 'statusChangePending'`, the target status and
    the `writeId` that fences its removal; any other effect requires
    `reason: 'postCommitAuthEffectFailed'`. Every time is a whole non-negative number. A status
    change writes its entry in its own transaction (`accountStatusQueueEntry`,
    `writeAccountStatusQueueEntry`, `mintStatusQueueWriteId`); `queueAccountClaimsRepair` queues an
    account whose claim change did not reach Auth, once (an entry already there is recognised by
    `firebase-helpers`' `isAlreadyExistsError`), and never throws.
  - **The repair** (`createAccountRepair(config)`). The status claim holds the status; an account
    that was never restricted (no claim, the product's unrestricted status, not disabled) is not
    drift, and after an unban the claim holds the unrestricted status. The disabled flag follows
    the statuses the product says disable the account. Each other claim the product hands in is a
    `KeptClaim`: its source is read once a run, its check names the patch that repairs it, and it
    may re-read before the write (`confirm`) and settle after it (`settle`). Token revocation is one
    rule: a change to the status (its claim or its disabled flag), or to a claim whose
    `revokesTokens` is true, revokes; a claim for the person's own benefit does not. Each thing
    repaired is one audit record, handed to the product's writer. A status change applied by the
    status callable's own post-commit step (`convergeAccountAfterStatusChange`) logs
    `statusChangeAppliedLog(name)` (`<name>: applied the status change to Auth`) and is not
    audited as a repair; every real repair (by the drain, by the full scan, or another claim
    repaired during a status change) logs `authDriftRepairedLog(name)` (`<name>: re-applied Auth
    drift`). Both products hand in `reconcileAccountStatus`, so the two lines read the same in
    both. A status change that also repairs another claim logs both, each
    naming what it applied. A claim whose source or check cannot be read leaves the outcome failed,
    so the account stays queued, while the status still converges. The post-commit step never
    throws, and settles only the entry its own status change wrote.
  - **The drain** (`drainQueue`) reads up to `ACCOUNT_REPAIR_DRAIN_PER_RUN` (200) entries, fewest
    attempts first; a failed repair raises the entry's attempt count in a transaction, only while the
    entry, of either kind, is unchanged since the drain read it (it exists, its `updateTime` is
    exactly the one the drain read, compared with `isEqual`, and a status entry's `writeId` is the same); an entry deleted, re-queued or
    rewritten by a newer status change meanwhile keeps its own count and is still counted retained.
    A converged entry is
    deleted only if it is unchanged since it was read. An entry whose account has an Auth user but
    no profile is deleted after a warning, logged and captured at warning level with only the
    account id; an account with no Auth user is deleted without one. **The full scan** (`runFullScan`) runs
    `sweep-core`'s Auth full scan over every account and repairs each one the same way.
- **The role-claims trigger's core** (`runRoleClaimsSync` on `./server`). From the list before and
  after an edit, the accounts whose roles changed (`changedRoleAccounts`); for each, the claims the
  list now gives it are written and its tokens revoked, then it is recorded. An account with no Auth
  user is recorded and skipped; any other failure is recorded, queues the account for repair and
  fails the trigger once every account has been tried, so the platform retries. The product hands
  in how the roles are read from its list, the claim patch, the record writer and the queueing, and
  declares the trigger on the list's create, change and delete.
- Normalized auth-error mapping (`normalizeAuthError`, `getErrorMessage`) and environment helpers (`getAppEnvironment`, `isDevelopment`, `isProduction`). Consumers call `getErrorMessage()` instead of restating provider-code maps. Email-action (`oobCode`) failures — expired and invalid/already-used links — map to stable generic copy that names the recovery step and never discloses whether an account exists. Every failure no mapped code covers (`AUTH_UNKNOWN`) gets the one fixed `UNKNOWN_AUTH_ERROR_MESSAGE`, never the error's own message — for an unclassified Firebase failure that text is the SDK's internal diagnostic. The consumer reports such a failure to its own monitoring; the package stays monitoring-agnostic.

## Boundary

`auth-core` is app-agnostic. It knows no app's domain objects, roles, memberships, per-resource actions, or Firestore paths: the account-repair mechanism takes every status, claim name, path, audit event and log field from the product. It depends on `firebase-helpers` for the server Firestore contract and on `sweep-core` for the Auth full scan.

Consuming apps wire the generic factory at their boundary: the app's own assert-auth module binds its user-profile path and user-status/admin semantics. App-specific checks (role or capability assertions, per-domain action permissions) live in the app, not in this package.

## Entry points

The root is pure: it exposes only contracts, normalized errors, and environment helpers, and never loads `firebase/auth` at runtime or in its types. Client/Admin/React runtimes each live behind an explicit subpath.

- `.` — pure contracts, errors, env helpers, the email-verification, acceptance, sign-in, maintenance, and registration refusal contracts, the password policy, the account schemas, the registration engine settings, and the account-repair queue entry schemas (server-safe).
- `./client` — Firebase **client** auth runtime (`onAuthStateChanged` wrapper, `getAuthUser`), the ID-token claims helpers typed on `firebase/auth` (`getIdTokenClaims`, `refreshClaims`, `refreshClaimsFromAuth`, `parseClaims`, `IdTokenClaims`, `ParsedClaims`), and `registerAndSignIn`; importing it pulls `firebase/auth`.
- `./react` — React auth provider (with the registration hold) and hooks.
- `./server` — Admin SDK / Functions helpers, including `createAssertAuth`, `createMaintenanceCheck`, `registerAccount`, `updateClaim`, `createAccountRepair`, and `runRoleClaimsSync`.

## Does not own

- an app's admin tiers or admin check modes (`TAdminOptions` is the app's type)
- membership, role, or capability requirements
- per-resource action permissions, or any resource context on `ctx`
- imports from an application-data package

If a future app needs domain authorization, add it in that app or in an appropriate app-specific package. Do not leak the domain into `auth-core`.
