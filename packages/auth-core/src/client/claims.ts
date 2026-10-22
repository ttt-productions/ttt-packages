import type { Auth, User, IdTokenResult } from 'firebase/auth';

export type IdTokenClaims = IdTokenResult['claims'];

export type ParsedClaims = {
  roles: string[];
  raw: IdTokenClaims;
};

export async function getIdTokenClaims(user: User | null): Promise<IdTokenClaims | null> {
  if (!user) return null;
  const res = await user.getIdTokenResult(false);
  if (user.emailVerified === true && res.claims.email_verified !== true) {
    const fresh = await user.getIdTokenResult(true);
    return fresh.claims;
  }
  return res.claims;
}

export async function refreshClaims(user: User | null): Promise<IdTokenClaims | null> {
  if (!user) return null;
  const res = await user.getIdTokenResult(true);
  return res.claims;
}

export async function refreshClaimsFromAuth(auth: Auth): Promise<IdTokenClaims | null> {
  return refreshClaims(auth.currentUser);
}

export function parseClaims(claims: IdTokenClaims | null | undefined): ParsedClaims {
  const raw = (claims ?? {}) as IdTokenClaims;

  const rolesValue = (raw as any).roles;
  const roles = Array.isArray(rolesValue)
    ? rolesValue.filter((x) => typeof x === 'string')
    : typeof rolesValue === 'string'
      ? [rolesValue]
      : [];

  return { roles, raw };
}
