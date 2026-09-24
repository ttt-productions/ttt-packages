import { describe, it, expect } from 'vitest';
import {
  ACCEPTANCE_REQUIRED_REASON,
  EMAIL_VERIFICATION_REQUIRED_REASON,
  isAcceptanceRequiredDetails,
  isAcceptanceRequiredError,
  normalizeAcceptanceLevel,
} from '../src/index';

describe('normalizeAcceptanceLevel', () => {
  it('keeps a whole non-negative level', () => {
    expect(normalizeAcceptanceLevel(0)).toBe(0);
    expect(normalizeAcceptanceLevel(4)).toBe(4);
  });

  it('floors a fractional level', () => {
    expect(normalizeAcceptanceLevel(2.9)).toBe(2);
  });

  it.each([[undefined], [null], ['3'], [Number.NaN], [Number.POSITIVE_INFINITY], [-2], [{}], [true]])(
    'reads %s as 0',
    (value) => {
      expect(normalizeAcceptanceLevel(value)).toBe(0);
    },
  );
});

describe('isAcceptanceRequiredDetails', () => {
  it('recognizes the refusal details', () => {
    expect(
      isAcceptanceRequiredDetails({ reason: ACCEPTANCE_REQUIRED_REASON, requiredLevel: 2, acceptedLevel: 1 }),
    ).toBe(true);
  });

  it.each([
    [undefined],
    ['acceptance-required'],
    [{ reason: 'other', requiredLevel: 2, acceptedLevel: 1 }],
    [{ reason: ACCEPTANCE_REQUIRED_REASON, requiredLevel: '2', acceptedLevel: 1 }],
    [{ reason: ACCEPTANCE_REQUIRED_REASON, requiredLevel: 2 }],
  ])('rejects %j', (details) => {
    expect(isAcceptanceRequiredDetails(details)).toBe(false);
  });
});

describe('isAcceptanceRequiredError', () => {
  const details = { reason: ACCEPTANCE_REQUIRED_REASON, requiredLevel: 3, acceptedLevel: 0 };

  it('recognizes the server-side refusal code', () => {
    expect(isAcceptanceRequiredError({ code: 'failed-precondition', details })).toBe(true);
  });

  it('recognizes the Firebase client callable error code', () => {
    expect(isAcceptanceRequiredError({ code: 'functions/failed-precondition', details })).toBe(true);
  });

  it('rejects another failed-precondition (e.g. an unverified email)', () => {
    expect(isAcceptanceRequiredError({ code: 'failed-precondition', message: 'Email must be verified' })).toBe(false);
  });

  it.each([['failed-precondition'], ['functions/failed-precondition']])(
    'rejects the email-verification refusal (%s)',
    (code) => {
      expect(isAcceptanceRequiredError({ code, details: { reason: EMAIL_VERIFICATION_REQUIRED_REASON } })).toBe(false);
    },
  );

  it('rejects a different code carrying the same details', () => {
    expect(isAcceptanceRequiredError({ code: 'permission-denied', details })).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isAcceptanceRequiredError(null)).toBe(false);
    expect(isAcceptanceRequiredError('failed-precondition')).toBe(false);
  });
});
