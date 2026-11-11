# Adopt @ttt-productions/auth-core 1.6.22

**What:** auth-core owns the mechanism that keeps an account's Auth claims and disabled flag in step with what the product stores: the claim writer, the repair queue, the repair and the role-claims trigger's core; `useAuthGuard` saves the redirect path through storage-core under the key the app hands in.
**Severity:** high

- **Package and version:** `@ttt-productions/auth-core` 1.6.22. It now depends on
  `@ttt-productions/firebase-helpers` and `@ttt-productions/sweep-core`.
- **Release:** `./scripts/release-multiple.sh dev-standards storage-core firebase-helpers
  ui-core repo-guards theme-core consent-core query-core app-config-core notification-core
  sweep-core auth-core q-core media-viewer file-input upload-core patch`.
- **What changed** (`docs/packages/auth-core.md`):
  - Root: `createAccountRepairQueueEntrySchemas({ statusEffect, claimEffects, statusSchema })`,
    `ACCOUNT_STATUS_PENDING_REASON`, `AUTH_EFFECT_FAILED_REASON`.
  - `./server`: `updateClaim(auth, uid, patch)`; `createAccountRepair(config)`, which returns
    `statusDrift`, `mintStatusQueueWriteId`, `accountStatusQueueEntry`,
    `writeAccountStatusQueueEntry`, `queueAccountClaimsRepair`,
    `convergeAccountAfterStatusChange`, `drainQueue` and `runFullScan`;
    `runRoleClaimsSync` and `changedRoleAccounts`; `statusChangeAppliedLog(name)`,
    `authDriftRepairedLog(name)`, `ACCOUNT_REPAIR_DRAIN_PER_RUN` (200).
  - `./react`: `useAuthGuard`'s `redirectKey` is required — the app's whole storage key for the
    saved path — and its default `'auth_redirect_path'` is gone. The saved path is read and written
    through storage-core's `readStoredValue` / `writeStoredValue` (its own in-memory copy is gone),
    so with site data blocked it shares one held value with every other reader of the key.
    `@ttt-productions/storage-core` is a new optional peer.
- **What ttt-prod hands in:** `name: 'reconcileAccountStatus'`, the name every log line of the
  repair starts with (Q-Sports hands in the same name, so the two required lines read the same in
  both products); its Firestore and the Admin SDK's Auth; the profile path, the
  `statusReconcileQueue` collection and entry paths, and ttt-core's bound queue entry schema; its
  status claim key (`status`), `active` as the unrestricted status, `banned` as the one status that
  disables the account (a suspended account signs in), and the stored status read
  (`UserAccountStatusSchema.parse(profile.status)`); its other claims as `KeptClaim`s — the admin
  claims (the roster read once a run, `revokesTokens: true`), the registered-member claim
  (`revokesTokens: false`), and the accepted-documents level (`revokesTokens: false`, its check
  reading the private data, `confirm` the current re-read, `settle` the write-again after); its audit
  writer, its logger and capture, `uid` as its log field name; and the `reconcileAccountStatus`
  saved position from `sweep-core` with its seven-day full-scan interval. It still declares the
  scheduled function and the trigger with its own region and options.
- **What the app must change:**
  - **ttt-core, in ttt-prod's own session:** its queue entry schema (`doc-schemas/operational.ts`)
    is built with `createAccountRepairQueueEntrySchemas({ statusEffect: 'accountStatus',
    claimEffects: ['publicDocumentsAcceptedClaim', 'adminClaims', 'registeredMemberClaim'],
    statusSchema: UserAccountStatusSchema })` and registered for the queue; its audit catalog gains
    `user.authReconciled`.
  - `updateClaim` in `functions/src/shared/admin-auth.ts` goes; callers use auth-core's
    `updateClaim(adminAuth(), uid, patch)`.
  - `functions/src/users/account-claims.ts` goes; callers use the repair's
    `queueAccountClaimsRepair(uid, effect)`.
  - `functions/src/users/reconcileAccountStatus.ts` becomes the values handed to
    `createAccountRepair` plus the scheduled function, which runs `drainQueue()` and then
    `runFullScan(now)` in their own try blocks. The status callable writes its entry with
    `writeAccountStatusQueueEntry` and, after its commit, runs
    `convergeAccountAfterStatusChange(uid, writeId)`.
  - `functions/src/auth/runSyncAdminStatusClaims.ts` becomes how the roles are read from the admin
    roster (`isAdmin` / `isJrAdmin` from its standing) plus what is handed to `runRoleClaimsSync`;
    `functions/src/auth/setAdminStatusClaim.ts` becomes an `onDocumentWritten` trigger.
- **What the app must change for the auth guard:** `src/app/client-app-shell.tsx` already hands in
  `redirectKey: REDIRECT_PATH_KEY`, so the guard's call needs no change; storage-core 0.0.2 or later
  joins ttt-prod's dependencies.
- **What changes for ttt-prod:**
  - Its saved redirect path is one store: the auth guard, the register page and the sign-in link all
    read and write `REDIRECT_PATH_KEY` through storage-core, so with site data blocked a path one of
    them saved is the path the others read for the page's life.
  - A routine ban, suspend or unban applied by the status callable's own post-commit step logs
    `reconcileAccountStatus: applied the status change to Auth` and stops logging
    `reconcileAccountStatus: re-applied Auth drift`; a repair by the drain or the full scan, or
    another claim repaired during a status change, logs the drift line, and a status change that
    also repairs another claim logs both.
  - Account repairs are audited as `user.authReconciled` (one record per thing repaired, its
    payload saying which), not `system.manualIntervention`.
  - Queue entries declare no `uid` field, and an unknown field in an entry is dropped on read where
    ttt-core's strict entry schemas refuse it today; `authEffect` and `reason` are required on every
    entry, and every time is a whole non-negative number.
  - The admin-list trigger audits each account after its claims are applied, records a failure when
    they could not be (an account with no Auth user is recorded and skipped), and runs when the
    roster is created or deleted too. A failure queues the account and fails the trigger after
    every account has been tried.
  - A failed repair raises the queue entry's attempt count only while the entry, a status entry or
    a claim entry, is unchanged since the drain read it (it exists, its `updateTime` is exactly the
    one read, compared with `isEqual`, so a rewrite in the same millisecond is caught, and a status entry's `writeId` is the same), in a transaction; ttt-prod's copy raised it
    with a plain `update()`, so an entry rewritten or re-queued meanwhile inherited the old count
    plus one, and one deleted meanwhile failed the raise.
  - A queued account with an Auth user but no profile is still removed from the queue, now after
    a warning logged and captured at warning level with only the account id.
  - Its own already-exists check for the queue (`users/account-claims.ts`) goes with that file; the
    repair recognises an entry already there with `firebase-helpers`' `isAlreadyExistsError`.
  - If the profile is gone when a converged account is settled, the entry is kept as owed with no
    error logged (ttt-prod's copy threw and logged).
- **Done when:** the lockfiles name `@ttt-productions/auth-core` 1.6.22 or later; no claim merge,
  queue, drain, drift, repair or role-claim sync logic is written in ttt-prod's own code; the two
  log lines and `user.authReconciled` behave as above; the auth guard hands in `REDIRECT_PATH_KEY`;
  and the Normal TTT Test Flow is green.
