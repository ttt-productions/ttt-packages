import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PASSWORD_POLICY,
  checkPassword,
  definePasswordPolicy,
  passwordIssueMessage,
} from '../src/password-policy.js';

describe('the default password policy', () => {
  it('is 6 to 74 characters, length only', () => {
    expect(DEFAULT_PASSWORD_POLICY).toEqual({ minLength: 6, maxLength: 74 });
  });

  it('accepts a password at each bound and refuses one past each', () => {
    expect(checkPassword('a'.repeat(6), DEFAULT_PASSWORD_POLICY)).toEqual({ ok: true });
    expect(checkPassword('a'.repeat(74), DEFAULT_PASSWORD_POLICY)).toEqual({ ok: true });
    expect(checkPassword('a'.repeat(5), DEFAULT_PASSWORD_POLICY)).toEqual({
      ok: false,
      issue: 'tooShort',
    });
    expect(checkPassword('a'.repeat(75), DEFAULT_PASSWORD_POLICY)).toEqual({
      ok: false,
      issue: 'tooLong',
    });
  });

  it('asks for no composition: spaces, letters only, and any script pass', () => {
    expect(checkPassword('      ', DEFAULT_PASSWORD_POLICY)).toEqual({ ok: true });
    expect(checkPassword('abcdef', DEFAULT_PASSWORD_POLICY)).toEqual({ ok: true });
    expect(checkPassword('пароль!', DEFAULT_PASSWORD_POLICY)).toEqual({ ok: true });
  });
});

describe('a product override', () => {
  it('replaces only the values it names', () => {
    expect(definePasswordPolicy({ minLength: 8 })).toEqual({ minLength: 8, maxLength: 74 });
    expect(definePasswordPolicy()).toEqual(DEFAULT_PASSWORD_POLICY);
  });

  it('is what the check reads', () => {
    const policy = definePasswordPolicy({ minLength: 8, maxLength: 10 });
    expect(checkPassword('a'.repeat(7), policy)).toEqual({ ok: false, issue: 'tooShort' });
    expect(checkPassword('a'.repeat(11), policy)).toEqual({ ok: false, issue: 'tooLong' });
    expect(checkPassword('a'.repeat(9), policy)).toEqual({ ok: true });
  });

  it('refuses a policy no password can meet', () => {
    expect(() => definePasswordPolicy({ minLength: 10, maxLength: 9 })).toThrow(TypeError);
    expect(() => definePasswordPolicy({ minLength: 0 })).toThrow(TypeError);
    expect(() => definePasswordPolicy({ maxLength: 7.5 })).toThrow(TypeError);
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
