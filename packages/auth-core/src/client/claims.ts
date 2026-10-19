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
 *
 * STALE-VERIFICATION RECONCILIATION: when the ACCOUNT says the email is
 * verified but the cached token claim still says it is not, force-mint a fresh
 * token and return ITS claims. Firebase ID tokens live for up to an hour and a
 * backend-side `emailVerified` flip (verification link applied elsewhere, or an
 * Admin SDK update) never invalidates them — without this, the UI (account
 * state) believes the user is verified while every backend call (token claim)
 * rejects with "Email must be verified" until the token happens to rotate.
 * One forced mint converges the two (the fresh token carries
 * `email_verified: true`); the check is directional, so an already-consistent
 * user never pays a forced refresh.
 */
export async function getIdTokenClaims(user: User | null): Promise<IdTokenClaims | null> {
  if (!user) return null;
  const res = await user.getIdTokenResult(false);
  if (user.emailVerified === true && res.claims.email_verified !== true) {
    const fresh = await user.getIdTokenResult(true);
    return fresh.claims;
  }
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
