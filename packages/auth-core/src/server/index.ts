// Public surface of @ttt-productions/auth-core/server.

export { createAssertAuth } from "./assertAuth.js";
export { AuthAssertionError } from "./authError.js";
export type { AuthAssertionErrorCode } from "./authError.js";
export type {
  AssertAuthConfig,
  AssertAuthFn,
  AuthContext,
  AuthRequirements,
  AdminCheckOptions,
  UserStatus,
} from "./types.js";
