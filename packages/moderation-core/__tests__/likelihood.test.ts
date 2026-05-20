import { describe, it, expect } from 'vitest';
import { likelihoodToString, isRejectionLikelihood } from '../src/likelihood.js';

describe('likelihoodToString', () => {
  it('maps numeric 0 to UNKNOWN', () => {
    expect(likelihoodToString(0)).toBe('UNKNOWN');
  });

  it('maps numeric 1 to VERY_UNLIKELY', () => {
    expect(likelihoodToString(1)).toBe('VERY_UNLIKELY');
  });

  it('maps numeric 5 to VERY_LIKELY', () => {
    expect(likelihoodToString(5)).toBe('VERY_LIKELY');
  });

  it('passes through valid string value VERY_LIKELY', () => {
    expect(likelihoodToString('VERY_LIKELY')).toBe('VERY_LIKELY');
  });

  it('passes through valid string value POSSIBLE', () => {
    expect(likelihoodToString('POSSIBLE')).toBe('POSSIBLE');
  });

  it('returns UNKNOWN for null', () => {
    expect(likelihoodToString(null)).toBe('UNKNOWN');
  });

  it('returns UNKNOWN for undefined', () => {
    expect(likelihoodToString(undefined)).toBe('UNKNOWN');
  });
});

describe('isRejectionLikelihood', () => {
  const threshold = new Set(['LIKELY', 'VERY_LIKELY']);

  it('returns true for LIKELY string', () => {
    expect(isRejectionLikelihood('LIKELY', threshold)).toBe(true);
  });

  it('returns true for numeric 5 (VERY_LIKELY)', () => {
    expect(isRejectionLikelihood(5, threshold)).toBe(true);
  });

  it('returns false for UNLIKELY string', () => {
    expect(isRejectionLikelihood('UNLIKELY', threshold)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isRejectionLikelihood(null, threshold)).toBe(false);
  });

  it('returns false for numeric 2 (UNLIKELY)', () => {
    expect(isRejectionLikelihood(2, threshold)).toBe(false);
  });
});
