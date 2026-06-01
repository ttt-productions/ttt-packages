// Pure root: contracts, claims parsing, normalized errors, environment helpers.
// Nothing here imports firebase/auth at runtime.
//
// Client auth runtime (onAuthStateChanged wrapper, getAuthUser) lives behind
// "@ttt-productions/auth-core/client". Admin/Functions helpers live behind
// "@ttt-productions/auth-core/server". React hooks live behind
// "@ttt-productions/auth-core/react".
export * from "./claims.js";
export * from "./errors.js";
export * from "./env.js";
