import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_EMAIL_MAX_LENGTH,
  accountEmailSchema,
  accountPasswordSchema,
} from '../src/account-schemas.js';
import { definePasswordPolicy } from '../src/password-policy.js';

type Parsed = { success: boolean; error?: { issues: { message: string }[] } };

function issue(result: Parsed) {
  return result.success ? null : (result.error?.issues[0]?.message ?? null);
}

function issues(result: Parsed) {
  return result.error?.issues.map(({ message }) => message) ?? [];
}

describe('the account email schema', () => {
  it('takes an address up to 320 characters and refuses a longer one', () => {
    const local = 'a'.repeat(64);
    const domain = `${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.${'e'.repeat(63)}`;
    const longest = `${local}@${domain}`;
    expect(longest).toHaveLength(320);
    expect(ACCOUNT_EMAIL_MAX_LENGTH).toBe(320);
    expect(accountEmailSchema.safeParse(longest).success).toBe(true);
    expect(issues(accountEmailSchema.safeParse(`${local}@${domain}.f`))).toContain(
      'That email is too long.',
    );
  });

  it('refuses something that is not an email', () => {
    expect(issue(accountEmailSchema.safeParse('not an email'))).toBe('Please enter a valid email.');
  });
});

describe('the account password schema', () => {
  it('holds a password to the policy it is built from, with the shared messages', () => {
    const schema = accountPasswordSchema(definePasswordPolicy({ minLength: 8, maxLength: 10 }));
    expect(schema.safeParse('a'.repeat(8)).success).toBe(true);
    expect(schema.safeParse('a'.repeat(10)).success).toBe(true);
    expect(issue(schema.safeParse('a'.repeat(7)))).toBe('Password must be at least 8 characters.');
    expect(issue(schema.safeParse('a'.repeat(11)))).toBe(
      'Password must be no more than 10 characters.',
    );
  });
});
