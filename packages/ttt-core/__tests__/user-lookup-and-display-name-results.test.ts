import { describe, it, expect } from 'vitest';
import {
  CheckDisplayNameAvailableResultSchema,
  LookupUserByEmailOrUidResultSchema,
  detectUserSearchKind,
} from '../src/schemas/users';

describe('CheckDisplayNameAvailableResultSchema', () => {
  it('answers available, or unavailable with one of the three reasons', () => {
    expect(CheckDisplayNameAvailableResultSchema.safeParse({ available: true }).success).toBe(true);
    for (const reason of ['taken', 'reserved', 'disallowed']) {
      expect(CheckDisplayNameAvailableResultSchema.safeParse({ available: false, reason }).success).toBe(true);
    }
  });

  it('refuses a reason the availability check never gives', () => {
    expect(CheckDisplayNameAvailableResultSchema.safeParse({ available: false, reason: 'tooLong' }).success).toBe(false);
  });
});

describe('LookupUserByEmailOrUidResultSchema', () => {
  const user = { uid: 'u'.repeat(28), displayName: 'Jane', email: 'jane@example.com', status: 'suspended', isAdmin: false };

  it('carries the one matched account, or null when none resolves', () => {
    expect(LookupUserByEmailOrUidResultSchema.parse({ user })).toEqual({ user });
    expect(LookupUserByEmailOrUidResultSchema.parse({ user: null })).toEqual({ user: null });
  });

  it('refuses an account with no status or an unknown one — never read as active', () => {
    const { status: _status, ...noStatus } = user;
    expect(LookupUserByEmailOrUidResultSchema.safeParse({ user: noStatus }).success).toBe(false);
    expect(LookupUserByEmailOrUidResultSchema.safeParse({ user: { ...user, status: 'paused' } }).success).toBe(false);
  });
});

describe('detectUserSearchKind', () => {
  it('routes a full email to the exact lookup', () => {
    expect(detectUserSearchKind('  jane@example.com ')).toBe('email');
  });

  it('routes a 28-character uid to the exact lookup', () => {
    expect(detectUserSearchKind('aB3'.repeat(9) + 'z')).toBe('uid');
  });

  it('routes anything else to the display-name search', () => {
    expect(detectUserSearchKind('Jane')).toBe('name');
    expect(detectUserSearchKind('a'.repeat(27))).toBe('name');
    expect(detectUserSearchKind('a'.repeat(29))).toBe('name');
    expect(detectUserSearchKind('jane@example')).toBe('name');
  });
});
