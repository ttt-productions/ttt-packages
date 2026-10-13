import { describe, it, expect } from 'vitest';
import {
  ABSENT_USER_ACCOUNT_STATUS,
  UserAccountStatusSchema,
  parseUserAccountStatus,
} from '../src/doc-schemas/user';

describe('parseUserAccountStatus', () => {
  it('reads every account status as itself', () => {
    for (const status of UserAccountStatusSchema.options) {
      expect(parseUserAccountStatus(status)).toBe(status);
    }
  });

  it('reads an absent status as an active account', () => {
    expect(ABSENT_USER_ACCOUNT_STATUS).toBe('active');
    expect(parseUserAccountStatus(undefined)).toBe('active');
  });

  it('refuses a status that is not an account status, so it is never enforced as one', () => {
    for (const malformed of ['Banned', 'deleted', '', null, 0, true, { status: 'banned' }]) {
      expect(() => parseUserAccountStatus(malformed)).toThrow();
    }
  });
});
