import { describe, it, expect } from 'vitest';
import { validateDuration } from '../src/validation/validate-duration';

describe('validateDuration', () => {
  it('returns true when duration is under the limit', () => {
    expect(validateDuration(30, 60)).toBe(true);
  });

  it('returns true when duration equals the limit (inclusive)', () => {
    expect(validateDuration(60, 60)).toBe(true);
  });

  it('returns false when duration exceeds the limit', () => {
    expect(validateDuration(61, 60)).toBe(false);
  });

  it('returns true for 0 duration', () => {
    expect(validateDuration(0, 60)).toBe(true);
  });

  it('returns true when both are 0', () => {
    expect(validateDuration(0, 0)).toBe(true);
  });

  it('returns false when duration is 1 and limit is 0', () => {
    expect(validateDuration(1, 0)).toBe(false);
  });

  it('handles fractional seconds', () => {
    expect(validateDuration(59.9, 60)).toBe(true);
    expect(validateDuration(60.1, 60)).toBe(false);
  });

  it('handles long durations (feature film length)', () => {
    const twoHours = 7200;
    expect(validateDuration(twoHours, twoHours)).toBe(true);
    expect(validateDuration(twoHours + 1, twoHours)).toBe(false);
  });
});
