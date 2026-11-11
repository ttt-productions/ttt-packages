# Adopt @ttt-productions/auth-core 1.6.21

**What:** auth-core holds no password policy or engine settings of its own, owns the account email and password schemas, and owns the maintenance refusal and check.
**Severity:** high

- **Package and version:** `@ttt-productions/auth-core` 1.6.21.
- **Release:** `./scripts/release-multiple.sh auth-core q-core media-viewer repo-guards dev-standards patch`.
- **What changed:**
  - `DEFAULT_PASSWORD_POLICY` and `DEFAULT_REGISTRATION_ENGINE_SETTINGS` are gone.
    `definePasswordPolicy(values)` and `defineRegistrationEngineSettings(values)` take every value;
    a call with no argument no longer compiles.
  - Root: `ACCOUNT_EMAIL_MAX_LENGTH` (320), `accountEmailSchema`, and
    `accountPasswordSchema(policy)`, each with the shared messages. auth-core now depends on `zod`.
  - Root: the maintenance refusal — `MAINTENANCE_REFUSAL_CODE` (`unavailable`),
    `MAINTENANCE_REFUSAL_REASON` (`maintenance`), `MaintenanceRefusalDetails`,
    `isMaintenanceRefusalDetails`, `isMaintenanceRefusalError`.
  - `./server`: `createMaintenanceCheck({ read, isAdmin })` returns a check that passes everyone
    while maintenance is off, and while it is on passes only a caller `isAdmin` names, refusing anyone
    else — or no caller — with the product's message as an `AuthAssertionError` (code
    `unavailable`, details `{ reason: 'maintenance' }`). `createAssertAuth` takes it as
    `maintenance` and runs it after the status check, before acceptance and the admin check.
    `AuthAssertionErrorCode` gains `unavailable`.
- **What the app must change:** ttt-prod's items `docs/work/waiting-to-be-implemented/registration-finishes-or-fails.md`
  and `maintenance-is-one-shared-mechanism.md` build on this. ttt-core declares its own policy
  (6 to 74) and engine settings (60 s) through the two define functions with every value; ttt-core's
  copy of the maintenance refusal and ttt-prod's `assertNotInMaintenance` go, replaced by the
  `maintenance` gate on `createAssertAuth` and the check with no caller on the entry points that
  have no signed-in caller; ttt-prod's email and password field schemas read auth-core's.
- **Done when:** the lockfiles name `@ttt-productions/auth-core` 1.6.21 or later, nothing in
  ttt-prod or ttt-core names a removed default, and ttt-prod's two items are built.
