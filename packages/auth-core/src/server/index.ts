// Public surface of @ttt-productions/auth-core/server.

export { createAssertAuth } from "./assertAuth.js";
export { AuthAssertionError } from "./authError.js";
export type { AuthAssertionErrorCode, AuthAssertionErrorDetails } from "./authError.js";
export type {
  AcceptanceGateConfig,
  AssertAuthConfig,
  AssertAuthFn,
  AuthContext,
  AuthRequirements,
  AdminCheckOptions,
  UserStatus,
} from "./types.js";
