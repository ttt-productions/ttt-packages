import { describe, it, expect } from 'vitest';
import {
  PERSPECTIVE_THRESHOLDS,
  REJECTION_LIKELIHOODS,
  TEXT_MODERATION_MIN_LENGTH,
} from '../src/constants/moderation';

describe('PERSPECTIVE_THRESHOLDS', () => {
  it('all values are numbers', () => {
    for (const value of Object.values(PERSPECTIVE_THRESHOLDS)) {
      expect(typeof value).toBe('number');
    }
  });

  it('all values are between 0 and 1 (exclusive)', () => {
    for (const value of Object.values(PERSPECTIVE_THRESHOLDS)) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('severeToxicity threshold is defined', () => {
    expect(typeof PERSPECTIVE_THRESHOLDS.severeToxicity).toBe('number');
  });

  it('identityAttack threshold is defined', () => {
    expect(typeof PERSPECTIVE_THRESHOLDS.identityAttack).toBe('number');
  });

  it('threat threshold is defined', () => {
    expect(typeof PERSPECTIVE_THRESHOLDS.threat).toBe('number');
  });

  it('toxicity threshold is defined', () => {
    expect(typeof PERSPECTIVE_THRESHOLDS.toxicity).toBe('number');
  });
});

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
