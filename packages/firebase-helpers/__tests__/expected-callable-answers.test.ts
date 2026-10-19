import { describe, it, expect } from 'vitest';
import {
  EXPECTED_CALLABLE_ANSWER_CODES,
  callableRefusalCode,
  callableRefusalReason,
  isExpectedCallableAnswerCode,
} from '../src/utils/expected-callable-answers.js';

describe('isExpectedCallableAnswerCode', () => {
  it('accepts every code in the canonical set, bare and client-prefixed', () => {
    for (const code of EXPECTED_CALLABLE_ANSWER_CODES) {
      expect(isExpectedCallableAnswerCode(code)).toBe(true);
      expect(isExpectedCallableAnswerCode(`functions/${code}`)).toBe(true);
    }
  });

  it('classifies the optimistic-concurrency conflict as an expected answer', () => {
    expect(isExpectedCallableAnswerCode('aborted')).toBe(true);
    expect(isExpectedCallableAnswerCode('functions/aborted')).toBe(true);
  });

  it('rejects genuine fault codes and non-strings', () => {
    for (const code of ['internal', 'unavailable', 'data-loss', 'unknown', 'deadline-exceeded', 'cancelled']) {
      expect(isExpectedCallableAnswerCode(code)).toBe(false);
      expect(isExpectedCallableAnswerCode(`functions/${code}`)).toBe(false);
    }
    expect(isExpectedCallableAnswerCode(undefined)).toBe(false);
    expect(isExpectedCallableAnswerCode(null)).toBe(false);
    expect(isExpectedCallableAnswerCode(42)).toBe(false);
  });
});

describe('callableRefusalCode', () => {
  it('answers the bare code of a designed refusal in either form', () => {
    expect(callableRefusalCode({ code: 'functions/not-found' })).toBe('not-found');
    expect(callableRefusalCode({ code: 'failed-precondition' })).toBe('failed-precondition');
  });

  it('answers null for a fault, a missing code, and a non-object', () => {
    expect(callableRefusalCode({ code: 'functions/internal' })).toBeNull();
    expect(callableRefusalCode(new Error('not-found'))).toBeNull();
    expect(callableRefusalCode(null)).toBeNull();
    expect(callableRefusalCode('functions/not-found')).toBeNull();
  });
});

describe('callableRefusalReason', () => {
  const REASONS = ['team-full', 'season-closed'] as const;

  it('answers the details.reason of a failed-precondition refusal when it is one of the reasons', () => {
    const error = { code: 'functions/failed-precondition', details: { reason: 'team-full' } };
    expect(callableRefusalReason(error, REASONS)).toBe('team-full');
  });

  it('never reads the message', () => {
    const error = { code: 'functions/failed-precondition', message: 'team-full', details: {} };
    expect(callableRefusalReason(error, REASONS)).toBeNull();
  });

  it('answers null for a reason outside the set, another refusal code, or no details', () => {
    expect(
      callableRefusalReason({ code: 'functions/failed-precondition', details: { reason: 'other' } }, REASONS),
    ).toBeNull();
    expect(
      callableRefusalReason({ code: 'functions/permission-denied', details: { reason: 'team-full' } }, REASONS),
    ).toBeNull();
    expect(callableRefusalReason({ code: 'functions/failed-precondition', details: null }, REASONS)).toBeNull();
    expect(callableRefusalReason({ code: 'functions/internal', details: { reason: 'team-full' } }, REASONS)).toBeNull();
  });
});
