import { describe, it, expect } from 'vitest';
import {
  CALLABLE_DEADLINE_EXCEEDED_CODE,
  isCallableDeadlineError,
} from '../src/utils/callable-deadline.js';

describe('isCallableDeadlineError', () => {
  it('accepts the Functions SDK deadline code on an error or a plain object', () => {
    expect(
      isCallableDeadlineError(
        Object.assign(new Error('deadline'), { code: CALLABLE_DEADLINE_EXCEEDED_CODE }),
      ),
    ).toBe(true);
    expect(isCallableDeadlineError({ code: 'functions/deadline-exceeded' })).toBe(true);
  });

  it('rejects every other callable code, App Check throttles, and non-objects', () => {
    for (const value of [
      { code: 'functions/internal' },
      { code: 'functions/unavailable' },
      { code: 'appCheck/throttled' },
      { code: 'deadline-exceeded' },
      new Error('deadline-exceeded'),
      null,
      undefined,
      'functions/deadline-exceeded',
    ]) {
      expect(isCallableDeadlineError(value)).toBe(false);
    }
  });
});
