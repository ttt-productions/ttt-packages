import { describe, it, expect } from 'vitest';
import { GROUP_GAP_SEC } from '../src/types';

describe('GROUP_GAP_SEC', () => {
  it('is a number', () => {
    expect(typeof GROUP_GAP_SEC).toBe('number');
  });

  it('equals 120', () => {
    expect(GROUP_GAP_SEC).toBe(120);
  });

  it('is positive', () => {
    expect(GROUP_GAP_SEC).toBeGreaterThan(0);
  });

  it('represents 2 minutes in seconds', () => {
    expect(GROUP_GAP_SEC).toBe(2 * 60);
  });
});
