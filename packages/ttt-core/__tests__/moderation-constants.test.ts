import { describe, it, expect } from 'vitest';
import {
  REJECTION_LIKELIHOODS,
  TEXT_MODERATION_MIN_LENGTH,
} from '../src/constants/moderation';

describe('REJECTION_LIKELIHOODS', () => {
  it('is a Set', () => {
    expect(REJECTION_LIKELIHOODS).toBeInstanceOf(Set);
  });

  it('contains "LIKELY"', () => {
    expect(REJECTION_LIKELIHOODS.has('LIKELY')).toBe(true);
  });

  it('contains "VERY_LIKELY"', () => {
    expect(REJECTION_LIKELIHOODS.has('VERY_LIKELY')).toBe(true);
  });

  it('contains exactly 2 values', () => {
    expect(REJECTION_LIKELIHOODS.size).toBe(2);
  });

  it('does not contain "POSSIBLE"', () => {
    expect(REJECTION_LIKELIHOODS.has('POSSIBLE')).toBe(false);
  });

  it('does not contain "UNLIKELY"', () => {
    expect(REJECTION_LIKELIHOODS.has('UNLIKELY')).toBe(false);
  });
});

describe('TEXT_MODERATION_MIN_LENGTH', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(TEXT_MODERATION_MIN_LENGTH)).toBe(true);
    expect(TEXT_MODERATION_MIN_LENGTH).toBeGreaterThan(0);
  });

  it('is 3', () => {
    expect(TEXT_MODERATION_MIN_LENGTH).toBe(3);
  });
});
