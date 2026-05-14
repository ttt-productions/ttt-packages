// packages/auth-core/src/server/index.ts
//
// Public surface of @ttt-productions/auth-core/server.

export { createAssertAuth } from "./assertAuth.js";
export type {
  AssertAuthConfig,
  AssertAuthFn,
  AuthContext,
  AuthRequirements,
  AdminCheckOptions,
  UserStatus,
} from "./types.js";
