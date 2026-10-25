import { describe, it, expect } from 'vitest';
import { EMAIL_VERIFICATION_REQUIRED_REASON } from '../src/email-verification.js';
import {
  SIGN_IN_REQUIRED_REASON,
  isPlatformTokenRefusal,
  isSignInRequiredDetails,
  isSignInRequiredError,
} from '../src/sign-in.js';

const details = { reason: SIGN_IN_REQUIRED_REASON };

describe('isSignInRequiredDetails', () => {
  it('recognizes the refusal details', () => {
    expect(isSignInRequiredDetails(details)).toBe(true);
  });

  it.each([
    [undefined],
    [null],
    ['sign-in-required'],
    [{}],
    [{ reason: 'other' }],
    [{ reason: EMAIL_VERIFICATION_REQUIRED_REASON }],
  ])('rejects %j', (value) => {
    expect(isSignInRequiredDetails(value)).toBe(false);
  });
});

describe('isSignInRequiredError', () => {
  it.each([['unauthenticated'], ['functions/unauthenticated']])(
    'recognizes the app sign-in refusal (%s)',
    (code) => {
      expect(isSignInRequiredError({ code, details })).toBe(true);
    },
  );

  it('rejects another code carrying the same details', () => {
    expect(isSignInRequiredError({ code: 'functions/permission-denied', details })).toBe(false);
    expect(isSignInRequiredError({ code: 'functions/failed-precondition', details })).toBe(false);
  });

  it('never recognizes by message text', () => {
    expect(
      isSignInRequiredError({
        code: 'functions/unauthenticated',
        message: 'You must be authenticated',
      }),
    ).toBe(false);
  });
});

describe('isPlatformTokenRefusal', () => {
  it.each([['unauthenticated'], ['functions/unauthenticated']])(
    'is an unauthenticated refusal that carries no app reason (%s)',
    (code) => {
      expect(isPlatformTokenRefusal({ code, message: 'Unauthenticated' })).toBe(true);
      expect(isPlatformTokenRefusal({ code, details: undefined })).toBe(true);
    },
  );

  it('is never the app sign-in refusal', () => {
    expect(isPlatformTokenRefusal({ code: 'functions/unauthenticated', details })).toBe(false);
  });

  it('is never another code, whatever its message', () => {
    expect(
      isPlatformTokenRefusal({ code: 'functions/permission-denied', message: 'Unauthenticated' }),
    ).toBe(false);
    expect(isPlatformTokenRefusal(new Error('Unauthenticated'))).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isPlatformTokenRefusal(null)).toBe(false);
    expect(isPlatformTokenRefusal(undefined)).toBe(false);
    expect(isPlatformTokenRefusal('functions/unauthenticated')).toBe(false);
  });
});
