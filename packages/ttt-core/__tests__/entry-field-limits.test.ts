import { describe, expect, it } from 'vitest';
import { EMAIL_MAX_LENGTH, MAX_ACCOUNT_ID_LENGTH } from '../src/constants/business-user.js';
import { MAX_SEARCH_QUERY_LENGTH } from '../src/constants/business-platform.js';
import {
  MAX_NCII_CONTACT_EMAIL_LENGTH,
  MAX_USER_SEARCH_QUERY_LENGTH,
} from '../src/constants/business-admin.js';
import { UserPrivateDataSchema } from '../src/doc-schemas/user.js';
import { userIdSchema } from '../src/schemas/atoms.js';

const emailOfLength = (length: number) =>
  `${'a'.repeat(length - '@example.com'.length)}@example.com`;
const privateDataWithEmail = (email: string) => {
  const result = UserPrivateDataSchema.shape.email.safeParse(email);
  return result.success;
};

describe('an email address is at most EMAIL_MAX_LENGTH characters', () => {
  it('keeps the RFC 5321 ceiling of 320', () => {
    expect(EMAIL_MAX_LENGTH).toBe(320);
  });

  it('stores an email at the limit and refuses one a character over it', () => {
    expect(privateDataWithEmail(emailOfLength(EMAIL_MAX_LENGTH))).toBe(true);
    expect(privateDataWithEmail(emailOfLength(EMAIL_MAX_LENGTH + 1))).toBe(false);
  });

  it('the take-it-down contact email reads the same limit', () => {
    expect(MAX_NCII_CONTACT_EMAIL_LENGTH).toBe(EMAIL_MAX_LENGTH);
  });
});

describe('an account id is at most MAX_ACCOUNT_ID_LENGTH characters', () => {
  it("keeps Firebase Auth's uid limit of 128", () => {
    expect(MAX_ACCOUNT_ID_LENGTH).toBe(128);
  });

  it('accepts a uid at the limit and refuses one a character over it', () => {
    expect(userIdSchema.safeParse('u'.repeat(MAX_ACCOUNT_ID_LENGTH)).success).toBe(true);
    expect(userIdSchema.safeParse('u'.repeat(MAX_ACCOUNT_ID_LENGTH + 1)).success).toBe(false);
  });
});

describe('a search query is at most MAX_SEARCH_QUERY_LENGTH characters', () => {
  it('the user search reads the one search limit', () => {
    expect(MAX_USER_SEARCH_QUERY_LENGTH).toBe(MAX_SEARCH_QUERY_LENGTH);
  });
});
