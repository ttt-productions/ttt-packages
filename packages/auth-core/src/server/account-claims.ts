export type ClaimValue = string | number | boolean;

export type ClaimPatch = Readonly<Record<string, ClaimValue>>;

export interface AccountAuthUser {
  readonly uid: string;
  readonly customClaims?: Record<string, unknown>;
  readonly disabled: boolean;
}

export interface ClaimsAuth {
  getUser(uid: string): Promise<AccountAuthUser>;
  setCustomUserClaims(uid: string, customUserClaims: Record<string, unknown> | null): Promise<void>;
}

// setCustomUserClaims replaces the whole claims object, so every claim change goes through this
// merge (RULE-STD-BACKEND-111).
export async function updateClaim(auth: ClaimsAuth, uid: string, patch: ClaimPatch): Promise<void> {
  const user = await auth.getUser(uid);
  const merged: Record<string, unknown> = { ...(user.customClaims ?? {}), ...patch };
  for (const key of Object.keys(merged)) {
    if (merged[key] === false) delete merged[key];
  }
  await auth.setCustomUserClaims(uid, merged);
}

export function isAuthUserNotFound(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'auth/user-not-found';
}
