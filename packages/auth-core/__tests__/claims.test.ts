import { describe, it, expect, vi } from 'vitest';
import { getIdTokenClaims, parseClaims } from '../src/claims';
import type { User } from 'firebase/auth';

function makeUser(opts: {
  emailVerified: boolean;
  cachedClaims: Record<string, unknown>;
  freshClaims?: Record<string, unknown>;
}) {
  const getIdTokenResult = vi.fn(async (force?: boolean) => ({
    claims: force ? (opts.freshClaims ?? opts.cachedClaims) : opts.cachedClaims,
  }));
  return { user: { emailVerified: opts.emailVerified, getIdTokenResult } as unknown as User, getIdTokenResult };
}

describe('getIdTokenClaims — stale-verification reconciliation', () => {
  it('returns null for a null user', async () => {
    await expect(getIdTokenClaims(null)).resolves.toBeNull();
  });

  it('returns cached claims without a forced mint when account and token agree (verified)', async () => {
    const { user, getIdTokenResult } = makeUser({
      emailVerified: true,
      cachedClaims: { email_verified: true, sub: 'u1' },
    });
    await expect(getIdTokenClaims(user)).resolves.toEqual({ email_verified: true, sub: 'u1' });
    expect(getIdTokenResult).toHaveBeenCalledTimes(1);
    expect(getIdTokenResult).toHaveBeenCalledWith(false);
  });

  it('returns cached claims without a forced mint when the account is unverified', async () => {
    const { user, getIdTokenResult } = makeUser({
      emailVerified: false,
      cachedClaims: { email_verified: false },
    });
    await expect(getIdTokenClaims(user)).resolves.toEqual({ email_verified: false });
    expect(getIdTokenResult).toHaveBeenCalledTimes(1);
  });

  it('force-mints a fresh token when the ACCOUNT is verified but the cached token claim is not (the backend-flip / emailed-link disconnect)', async () => {
    const { user, getIdTokenResult } = makeUser({
      emailVerified: true,
      cachedClaims: { email_verified: false, sub: 'u1' },
      freshClaims: { email_verified: true, sub: 'u1' },
    });
    await expect(getIdTokenClaims(user)).resolves.toEqual({ email_verified: true, sub: 'u1' });
    expect(getIdTokenResult).toHaveBeenCalledTimes(2);
    expect(getIdTokenResult).toHaveBeenNthCalledWith(1, false);
    expect(getIdTokenResult).toHaveBeenNthCalledWith(2, true);
  });

  it('also reconciles when the cached token has NO email_verified claim at all', async () => {
    const { user, getIdTokenResult } = makeUser({
      emailVerified: true,
      cachedClaims: { sub: 'u1' },
      freshClaims: { email_verified: true, sub: 'u1' },
    });
    await expect(getIdTokenClaims(user)).resolves.toEqual({ email_verified: true, sub: 'u1' });
    expect(getIdTokenResult).toHaveBeenCalledTimes(2);
  });
});

describe('parseClaims', () => {
  it('returns empty roles and empty raw for null input', () => {
    const result = parseClaims(null);
    expect(result.roles).toEqual([]);
    expect(result.raw).toEqual({});
  });

  it('returns empty roles for undefined input', () => {
    const result = parseClaims(undefined);
    expect(result.roles).toEqual([]);
  });

  it('passes through roles as string[]', () => {
    const result = parseClaims({ roles: ['admin', 'editor'] });
    expect(result.roles).toEqual(['admin', 'editor']);
  });

  it('wraps single string role in array', () => {
    const result = parseClaims({ roles: 'admin' } as any);
    expect(result.roles).toEqual(['admin']);
  });

  it('returns empty array when roles is absent', () => {
    const result = parseClaims({ sub: 'user123' });
    expect(result.roles).toEqual([]);
  });

  it('filters out non-string items from roles array', () => {
    const result = parseClaims({ roles: ['admin', 42, null, 'editor', true] } as any);
    expect(result.roles).toEqual(['admin', 'editor']);
  });

  it('returns empty roles for empty roles array', () => {
    const result = parseClaims({ roles: [] });
    expect(result.roles).toEqual([]);
  });

  it('preserves raw claims', () => {
    const claims = { roles: ['admin'], sub: 'user123', customField: 'value' };
    const result = parseClaims(claims);
    expect(result.raw).toEqual(claims);
    expect(result.raw.sub).toBe('user123');
    expect((result.raw as any).customField).toBe('value');
  });

  it('returns empty array when roles is a number', () => {
    const result = parseClaims({ roles: 123 } as any);
    expect(result.roles).toEqual([]);
  });

  it('returns empty array when roles is an object', () => {
    const result = parseClaims({ roles: { key: 'value' } } as any);
    expect(result.roles).toEqual([]);
  });

  it('handles claims with only non-string values in roles', () => {
    const result = parseClaims({ roles: [1, 2, 3] } as any);
    expect(result.roles).toEqual([]);
  });
});
