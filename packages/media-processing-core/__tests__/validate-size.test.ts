import { describe, it, expect } from 'vitest';
import { validateSize } from '../src/validation/validate-size';

describe('validateSize', () => {
  it('returns true when bytes are under the limit', () => {
    expect(validateSize(500, 1000)).toBe(true);
  });

  it('returns true when bytes equal the limit (inclusive)', () => {
    expect(validateSize(1000, 1000)).toBe(true);
  });

  it('returns false when bytes exceed the limit', () => {
    expect(validateSize(1001, 1000)).toBe(false);
  });

  it('returns true for 0 bytes', () => {
    expect(validateSize(0, 1000)).toBe(true);
  });

  it('returns true when both are 0', () => {
    expect(validateSize(0, 0)).toBe(true);
  });

  it('returns false when size is 1 and limit is 0', () => {
    expect(validateSize(1, 0)).toBe(false);
  });

  it('handles large file sizes (10MB)', () => {
    const tenMb = 10 * 1024 * 1024;
    expect(validateSize(tenMb, tenMb)).toBe(true);
    expect(validateSize(tenMb + 1, tenMb)).toBe(false);
    expect(validateSize(tenMb - 1, tenMb)).toBe(true);
  });
});
