// Pure root: contracts, normalized errors, environment helpers.
// Nothing here imports firebase/auth at runtime.
//
// Client auth runtime (onAuthStateChanged wrapper, getAuthUser, ID-token claims) lives behind
// "@ttt-productions/auth-core/client". Admin/Functions helpers live behind
// "@ttt-productions/auth-core/server". React hooks live behind
// "@ttt-productions/auth-core/react".
export * from "./errors.js";
export * from "./env.js";
export * from "./acceptance.js";
export * from "./email-verification.js";
