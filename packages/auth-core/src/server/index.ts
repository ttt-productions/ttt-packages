export { createAssertAuth } from './assertAuth.js';
export { AuthAssertionError } from './authError.js';
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
  UserStatus,
} from './types.js';
