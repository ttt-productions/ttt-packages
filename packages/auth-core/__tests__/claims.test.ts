import { describe, it, expect } from 'vitest';
import { parseClaims } from '../src/claims';

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
