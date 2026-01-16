import type { Auth, User, IdTokenResult } from "firebase/auth";

export type IdTokenClaims = IdTokenResult["claims"];

export type ParsedClaims = {
  // common defaults (kept generic)
  roles: string[];
  // raw claims for app-level decisions
  raw: IdTokenClaims;
};

/**
 * Get the current user's ID token claims.
 * Returns null if no current user.
 */
export async function getIdTokenClaims(user: User | null): Promise<IdTokenClaims | null> {
  if (!user) return null;
  const res = await user.getIdTokenResult(false);
  return res.claims;
}

/**
 * Forces refresh of ID token + claims.
 * Returns null if no current user.
 */
export async function refreshClaims(user: User | null): Promise<IdTokenClaims | null> {
  if (!user) return null;
  const res = await user.getIdTokenResult(true);
  return res.claims;
}

/**
 * Convenience helper when you only have Auth.
 */
export async function refreshClaimsFromAuth(auth: Auth): Promise<IdTokenClaims | null> {
  return refreshClaims(auth.currentUser);
}

/**
 * Keep parsing intentionally minimal and generic:
 * - normalize "roles" into string[]
 * - keep raw claims attached
 */
export function parseClaims(claims: IdTokenClaims | null | undefined): ParsedClaims {
  const raw = (claims ?? {}) as IdTokenClaims;

  const rolesValue = (raw as any).roles;
  const roles =
    Array.isArray(rolesValue) ? rolesValue.filter((x) => typeof x === "string") :
    typeof rolesValue === "string" ? [rolesValue] :
    [];

  return { roles, raw };
}
