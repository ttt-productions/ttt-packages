import { describe, expect, it } from 'vitest';
import {
  checkPassword,
  definePasswordPolicy,
  passwordIssueMessage,
} from '../src/password-policy.js';

const POLICY = definePasswordPolicy({ minLength: 6, maxLength: 74 });

describe('a product password policy', () => {
  it('is exactly the lengths the product gives', () => {
    expect(POLICY).toEqual({ minLength: 6, maxLength: 74 });
    expect(definePasswordPolicy({ minLength: 8, maxLength: 10 })).toEqual({
      minLength: 8,
      maxLength: 10,
    });
  });

  it('accepts a password at each bound and refuses one past each', () => {
    expect(checkPassword('a'.repeat(6), POLICY)).toEqual({ ok: true });
    expect(checkPassword('a'.repeat(74), POLICY)).toEqual({ ok: true });
    expect(checkPassword('a'.repeat(5), POLICY)).toEqual({ ok: false, issue: 'tooShort' });
    expect(checkPassword('a'.repeat(75), POLICY)).toEqual({ ok: false, issue: 'tooLong' });
  });

  it('asks for no composition: spaces, letters only, and any script pass', () => {
    expect(checkPassword('      ', POLICY)).toEqual({ ok: true });
    expect(checkPassword('abcdef', POLICY)).toEqual({ ok: true });
    expect(checkPassword('пароль!', POLICY)).toEqual({ ok: true });
  });

  it('refuses a policy no password can meet', () => {
    expect(() => definePasswordPolicy({ minLength: 10, maxLength: 9 })).toThrow(TypeError);
    expect(() => definePasswordPolicy({ minLength: 0, maxLength: 9 })).toThrow(TypeError);
    expect(() => definePasswordPolicy({ minLength: 6, maxLength: 7.5 })).toThrow(TypeError);
  });
});

describe('the issue message', () => {
  it('names the bound of the policy it is given', () => {
    const policy = definePasswordPolicy({ minLength: 8, maxLength: 10 });
    expect(passwordIssueMessage('tooShort', policy)).toBe(
      'Password must be at least 8 characters.',
    );
    expect(passwordIssueMessage('tooLong', policy)).toBe(
      'Password must be no more than 10 characters.',
    );
  });
});
