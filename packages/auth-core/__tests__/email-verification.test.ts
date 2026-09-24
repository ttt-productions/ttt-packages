import { describe, it, expect } from 'vitest';
import {
  ACCEPTANCE_REQUIRED_REASON,
  EMAIL_VERIFICATION_REQUIRED_REASON,
  isEmailVerificationRequiredDetails,
  isEmailVerificationRequiredError,
} from '../src/index';

describe('isEmailVerificationRequiredDetails', () => {
  it('recognizes the refusal details', () => {
    expect(isEmailVerificationRequiredDetails({ reason: EMAIL_VERIFICATION_REQUIRED_REASON })).toBe(true);
  });

  it.each([
    [undefined],
    [null],
    ['email-verification-required'],
    [{}],
    [{ reason: 'other' }],
    [{ reason: ACCEPTANCE_REQUIRED_REASON, requiredLevel: 2, acceptedLevel: 1 }],
  ])('rejects %j', (details) => {
    expect(isEmailVerificationRequiredDetails(details)).toBe(false);
  });
});

describe('isEmailVerificationRequiredError', () => {
  const details = { reason: EMAIL_VERIFICATION_REQUIRED_REASON };

  it('recognizes the server-side refusal code', () => {
    expect(isEmailVerificationRequiredError({ code: 'failed-precondition', details })).toBe(true);
  });

  it('recognizes the Firebase client callable error code', () => {
    expect(isEmailVerificationRequiredError({ code: 'functions/failed-precondition', details })).toBe(true);
  });

  it('rejects a different code carrying the same details', () => {
    expect(isEmailVerificationRequiredError({ code: 'permission-denied', details })).toBe(false);
    expect(isEmailVerificationRequiredError({ code: 'functions/unauthenticated', details })).toBe(false);
  });

  it('rejects a failed-precondition with no details', () => {
    expect(isEmailVerificationRequiredError({ code: 'functions/failed-precondition' })).toBe(false);
  });

  it('never recognizes by message text', () => {
    expect(
      isEmailVerificationRequiredError({ code: 'functions/failed-precondition', message: 'Email must be verified' }),
    ).toBe(false);
    expect(isEmailVerificationRequiredError(new Error('Email must be verified'))).toBe(false);
  });

  it.each([['failed-precondition'], ['functions/failed-precondition']])(
    'rejects the acceptance refusal (%s)',
    (code) => {
      const acceptance = { reason: ACCEPTANCE_REQUIRED_REASON, requiredLevel: 3, acceptedLevel: 0 };
      expect(isEmailVerificationRequiredError({ code, details: acceptance })).toBe(false);
    },
  );

  it('rejects non-objects', () => {
    expect(isEmailVerificationRequiredError(null)).toBe(false);
    expect(isEmailVerificationRequiredError(undefined)).toBe(false);
    expect(isEmailVerificationRequiredError('failed-precondition')).toBe(false);
    expect(isEmailVerificationRequiredError(412)).toBe(false);
  });
});
