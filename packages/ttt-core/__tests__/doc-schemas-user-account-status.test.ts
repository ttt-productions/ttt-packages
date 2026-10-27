import { describe, it, expect } from 'vitest';
import {
  ABSENT_USER_ACCOUNT_STATUS,
  FullUserSchema,
  UserAccountStatusSchema,
} from '../src/doc-schemas/user.js';

const profile = {
  uid: 'u-1',
  displayName: 'Someone',
  displayName_lowercase: 'someone',
  createdAt: 1,
};

describe('a user profile account status', () => {
  it('accepts a profile holding each account status', () => {
    for (const status of UserAccountStatusSchema.options) {
      expect(FullUserSchema.parse({ ...profile, status }).status).toBe(status);
    }
  });

  it('refuses a profile with no status, so a missing status is never read as active', () => {
    expect(FullUserSchema.safeParse(profile).success).toBe(false);
  });

  it('refuses a status that is not an account status, so it is never enforced as one', () => {
    for (const malformed of ['Banned', 'deleted', '', null, 0, true, { status: 'banned' }]) {
      expect(FullUserSchema.safeParse({ ...profile, status: malformed }).success).toBe(false);
    }
  });

  it('reads a token with no status claim as an active account', () => {
    expect(ABSENT_USER_ACCOUNT_STATUS).toBe('active');
  });
});
