import { describe, it, expect } from 'vitest';
import { formatLargeNumber } from '../src/lib/format-numbers';

describe('formatLargeNumber', () => {
  it('returns raw string for numbers under 10,000', () => {
    expect(formatLargeNumber(0)).toBe('0');
    expect(formatLargeNumber(999)).toBe('999');
    expect(formatLargeNumber(9_999)).toBe('9999');
  });

  it('formats 10,000 as "10k"', () => {
    expect(formatLargeNumber(10_000)).toBe('10k');
  });

  it('formats 12,345 as "12.3k"', () => {
    expect(formatLargeNumber(12_345)).toBe('12.3k');
  });

  it('strips trailing .0 in k range', () => {
    expect(formatLargeNumber(20_000)).toBe('20k');
    expect(formatLargeNumber(100_000)).toBe('100k');
  });

  it('formats 999,999 as "1000k"', () => {
    expect(formatLargeNumber(999_999)).toBe('1000k');
  });

  it('formats 1,000,000 as "1M"', () => {
    expect(formatLargeNumber(1_000_000)).toBe('1M');
  });

  it('formats 1,200,000 as "1.2M"', () => {
    expect(formatLargeNumber(1_200_000)).toBe('1.2M');
  });

  it('strips trailing .0 in M range', () => {
    expect(formatLargeNumber(5_000_000)).toBe('5M');
  });

  it('formats 10,000,000 as "10M"', () => {
    expect(formatLargeNumber(10_000_000)).toBe('10M');
  });
});
