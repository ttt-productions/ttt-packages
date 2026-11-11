export { createAssertAuth } from './assertAuth.js';
export { AuthAssertionError } from './authError.js';
export { createMaintenanceCheck } from './maintenanceCheck.js';
export type { AuthAssertionErrorCode, AuthAssertionErrorDetails } from './authError.js';
export {
  EMAIL_ALREADY_REGISTERED_MESSAGE,
  PASSWORD_REFUSED_MESSAGE,
  RegistrationRefusalError,
  registerAccount,
} from './registerAccount.js';
export type {
  AccountRegistration,
  AccountRegistrationAdapter,
  AccountRegistrationRequest,
  RegistrationAuth,
} from './registerAccount.js';
export type {
  AcceptanceGateConfig,
  AssertAuthConfig,
  AssertAuthFn,
  AuthContext,
  AuthRequirements,
  MaintenanceCaller,
  MaintenanceCheckFn,
  MaintenanceGateConfig,
  MaintenanceState,
  UserStatus,
} from './types.js';
export { updateClaim } from './account-claims.js';
export type { AccountAuthUser, ClaimPatch, ClaimValue, ClaimsAuth } from './account-claims.js';
export {
  ACCOUNT_REPAIR_DRAIN_PER_RUN,
  authDriftRepairedLog,
  createAccountRepair,
  statusChangeAppliedLog,
} from './account-repair.js';
export type {
  AccountRepair,
  AccountRepairAuth,
  AccountRepairCapture,
  AccountRepairCaptureContext,
  AccountRepairConfig,
  AccountRepairDrain,
  AccountRepairFullScan,
  AccountRepairLog,
  AccountRepairLogFields,
  AccountRepairLogger,
  AccountRepairOutcome,
  AccountRepairQueueEntryParser,
  AccountRepairQueueTransaction,
  AccountRepairRecord,
  AccountRepairResult,
  AccountRepairSweep,
  AccountStatusConfig,
  AccountStatusDrift,
  AccountStatusQueueEntry,
  KeptClaim,
  KeptClaimAccount,
  KeptClaimCheck,
  KeptClaimDrift,
} from './account-repair.js';
export { changedRoleAccounts, runRoleClaimsSync } from './role-claims-sync.js';
export type {
  RoleClaims,
  RoleClaimsAuth,
  RoleClaimsSyncOutcome,
  RoleClaimsSyncRecord,
  RoleClaimsSyncRequest,
  RoleClaimsSyncResult,
} from './role-claims-sync.js';
