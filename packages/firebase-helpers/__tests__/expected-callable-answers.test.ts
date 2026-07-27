import { describe, it, expect } from 'vitest';
import {
  EXPECTED_CALLABLE_ANSWER_CODES,
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
