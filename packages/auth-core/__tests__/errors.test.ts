import { describe, it, expect } from 'vitest';
import { normalizeAuthError, getErrorMessage } from '../src/errors';

describe('normalizeAuthError', () => {
  describe('known Firebase error codes', () => {
    it('maps auth/network-request-failed', () => {
      const result = normalizeAuthError({ code: 'auth/network-request-failed' });
      expect(result.code).toBe('AUTH_NETWORK_ERROR');
      expect(result.firebaseCode).toBe('auth/network-request-failed');
      expect(result.message).toContain('Network error');
    });

    it('maps auth/too-many-requests', () => {
      const result = normalizeAuthError({ code: 'auth/too-many-requests' });
      expect(result.code).toBe('AUTH_TOO_MANY_REQUESTS');
      expect(result.message).toContain('Too many attempts');
    });

    it('maps auth/popup-closed-by-user', () => {
      const result = normalizeAuthError({ code: 'auth/popup-closed-by-user' });
      expect(result.code).toBe('AUTH_POPUP_CLOSED');
      expect(result.message).toContain('popup was closed');
    });

    it('maps auth/popup-blocked', () => {
      const result = normalizeAuthError({ code: 'auth/popup-blocked' });
      expect(result.code).toBe('AUTH_POPUP_BLOCKED');
      expect(result.message).toContain('blocked');
    });

    it('maps auth/cancelled-popup-request', () => {
      const result = normalizeAuthError({ code: 'auth/cancelled-popup-request' });
      expect(result.code).toBe('AUTH_CANCELLED');
    });

    it('maps auth/user-disabled', () => {
      const result = normalizeAuthError({ code: 'auth/user-disabled' });
      expect(result.code).toBe('AUTH_USER_DISABLED');
      expect(result.message).toContain('disabled');
    });

    it('maps auth/user-not-found', () => {
      const result = normalizeAuthError({ code: 'auth/user-not-found' });
      expect(result.code).toBe('AUTH_USER_NOT_FOUND');
    });

    it('maps auth/wrong-password', () => {
      const result = normalizeAuthError({ code: 'auth/wrong-password' });
      expect(result.code).toBe('AUTH_WRONG_PASSWORD');
    });

    it('maps auth/invalid-email', () => {
      const result = normalizeAuthError({ code: 'auth/invalid-email' });
      expect(result.code).toBe('AUTH_INVALID_EMAIL');
    });

    it('maps auth/email-already-in-use', () => {
      const result = normalizeAuthError({ code: 'auth/email-already-in-use' });
      expect(result.code).toBe('AUTH_EMAIL_ALREADY_IN_USE');
    });

    it('maps auth/weak-password', () => {
      const result = normalizeAuthError({ code: 'auth/weak-password' });
      expect(result.code).toBe('AUTH_WEAK_PASSWORD');
    });

    it('maps auth/requires-recent-login', () => {
      const result = normalizeAuthError({ code: 'auth/requires-recent-login' });
      expect(result.code).toBe('AUTH_REQUIRES_RECENT_LOGIN');
    });

    it('maps auth/invalid-credential', () => {
      const result = normalizeAuthError({ code: 'auth/invalid-credential' });
      expect(result.code).toBe('AUTH_INVALID_CREDENTIAL');
    });

    it('maps auth/account-exists-with-different-credential', () => {
      const result = normalizeAuthError({ code: 'auth/account-exists-with-different-credential' });
      expect(result.code).toBe('AUTH_ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL');
    });

    it('maps auth/provider-already-linked', () => {
      const result = normalizeAuthError({ code: 'auth/provider-already-linked' });
      expect(result.code).toBe('AUTH_PROVIDER_ALREADY_LINKED');
    });

    it('maps auth/credential-already-in-use', () => {
      const result = normalizeAuthError({ code: 'auth/credential-already-in-use' });
      expect(result.code).toBe('AUTH_CREDENTIAL_ALREADY_IN_USE');
    });
  });

  describe('unknown / unmapped inputs', () => {
    it('returns AUTH_UNKNOWN for unknown Firebase code', () => {
      const result = normalizeAuthError({ code: 'auth/some-unknown-code' });
      expect(result.code).toBe('AUTH_UNKNOWN');
      expect(result.firebaseCode).toBe('auth/some-unknown-code');
    });

    it('returns AUTH_UNKNOWN for null', () => {
      const result = normalizeAuthError(null);
      expect(result.code).toBe('AUTH_UNKNOWN');
    });

    it('returns AUTH_UNKNOWN for undefined', () => {
      const result = normalizeAuthError(undefined);
      expect(result.code).toBe('AUTH_UNKNOWN');
    });

    it('returns AUTH_UNKNOWN for plain string', () => {
      const result = normalizeAuthError('some error string');
      expect(result.code).toBe('AUTH_UNKNOWN');
    });

    it('returns AUTH_UNKNOWN for number', () => {
      const result = normalizeAuthError(42);
      expect(result.code).toBe('AUTH_UNKNOWN');
    });

    it('uses message from Error object when code is unknown', () => {
      const err = new Error('Custom error message');
      const result = normalizeAuthError(err);
      expect(result.code).toBe('AUTH_UNKNOWN');
      expect(result.message).toBe('Custom error message');
    });

    it('uses default message when err has no message property', () => {
      const result = normalizeAuthError({});
      expect(result.code).toBe('AUTH_UNKNOWN');
      expect(result.message).toBe('Authentication error. Please try again.');
    });

    it('uses default message when err.message is not a string', () => {
      const result = normalizeAuthError({ message: 123 });
      expect(result.code).toBe('AUTH_UNKNOWN');
      expect(result.message).toBe('Authentication error. Please try again.');
    });
  });

  describe('details passthrough', () => {
    it('includes details when provided', () => {
      const details = { userId: 'abc', extra: true };
      const result = normalizeAuthError({ code: 'auth/wrong-password' }, details);
      expect(result.details).toEqual(details);
    });

    it('details is undefined when not provided', () => {
      const result = normalizeAuthError({ code: 'auth/wrong-password' });
      expect(result.details).toBeUndefined();
    });

    it('includes details for unknown errors too', () => {
      const details = { context: 'login' };
      const result = normalizeAuthError(null, details);
      expect(result.details).toEqual(details);
    });
  });

  describe('firebaseCode field', () => {
    it('sets firebaseCode for known code', () => {
      const result = normalizeAuthError({ code: 'auth/wrong-password' });
      expect(result.firebaseCode).toBe('auth/wrong-password');
    });

    it('firebaseCode is undefined when no code on error', () => {
      const result = normalizeAuthError({});
      expect(result.firebaseCode).toBeUndefined();
    });

    it('firebaseCode is undefined for null input', () => {
      const result = normalizeAuthError(null);
      expect(result.firebaseCode).toBeUndefined();
    });
  });
});

describe('getErrorMessage', () => {
  it('returns message for known Firebase error', () => {
    const msg = getErrorMessage({ code: 'auth/wrong-password' });
    expect(msg).toBe('Incorrect password.');
  });

  it('returns default message for unknown error', () => {
    const msg = getErrorMessage({});
    expect(msg).toBe('Authentication error. Please try again.');
  });

  it('returns Error.message for unmapped errors', () => {
    const msg = getErrorMessage(new Error('Something broke'));
    expect(msg).toBe('Something broke');
  });

  it('returns default message for null', () => {
    const msg = getErrorMessage(null);
    expect(msg).toBe('Authentication error. Please try again.');
  });
});
