import { describe, it, expect } from 'vitest';
import { mergeModeration } from '../src/moderation/merge';

describe('mergeModeration', () => {
  it('returns undefined when both are undefined', () => {
    expect(mergeModeration(undefined, undefined)).toBeUndefined();
  });

  it('returns undefined when both are null', () => {
    expect(mergeModeration(null, null)).toBeUndefined();
  });

  it('returns input when only input is provided', () => {
    const input = { status: 'passed' as const, provider: 'aws' };
    expect(mergeModeration(input, undefined)).toEqual(input);
  });

  it('returns output when only output is provided', () => {
    const output = { status: 'flagged' as const, provider: 'google' };
    expect(mergeModeration(undefined, output)).toEqual(output);
  });

  describe('status ranking: rejected > flagged > error > passed', () => {
    it('rejected beats flagged', () => {
      const a = { status: 'rejected' as const };
      const b = { status: 'flagged' as const };
      expect(mergeModeration(a, b)?.status).toBe('rejected');
    });

    it('flagged beats passed (output wins same rank)', () => {
      const a = { status: 'passed' as const };
      const b = { status: 'flagged' as const };
      expect(mergeModeration(a, b)?.status).toBe('flagged');
    });

    it('error beats passed', () => {
      const a = { status: 'error' as const };
      const b = { status: 'passed' as const };
      expect(mergeModeration(a, b)?.status).toBe('error');
    });

    it('rejected beats error', () => {
      const a = { status: 'error' as const };
      const b = { status: 'rejected' as const };
      expect(mergeModeration(a, b)?.status).toBe('rejected');
    });

    it('both rejected → rejected', () => {
      const a = { status: 'rejected' as const };
      const b = { status: 'rejected' as const };
      expect(mergeModeration(a, b)?.status).toBe('rejected');
    });

    it('both passed → passed', () => {
      const a = { status: 'passed' as const };
      const b = { status: 'passed' as const };
      expect(mergeModeration(a, b)?.status).toBe('passed');
    });
  });

  describe('reasons merging', () => {
    it('merges and deduplicates reasons', () => {
      const a = { status: 'flagged' as const, reasons: ['nudity', 'violence'] };
      const b = { status: 'flagged' as const, reasons: ['violence', 'hate_speech'] };
      const result = mergeModeration(a, b);
      expect(result?.reasons).toEqual(expect.arrayContaining(['nudity', 'violence', 'hate_speech']));
      expect(result?.reasons?.length).toBe(3);
    });

    it('returns undefined reasons when neither has reasons', () => {
      const a = { status: 'passed' as const };
      const b = { status: 'passed' as const };
      expect(mergeModeration(a, b)?.reasons).toBeUndefined();
    });

    it('includes reasons from one side only', () => {
      const a = { status: 'flagged' as const, reasons: ['nudity'] };
      const b = { status: 'passed' as const };
      expect(mergeModeration(a, b)?.reasons).toEqual(['nudity']);
    });
  });

  describe('findings concatenation', () => {
    it('concatenates findings from both', () => {
      const finding1 = { label: 'nudity', confidence: 0.9 };
      const finding2 = { label: 'violence', confidence: 0.7 };
      const a = { status: 'flagged' as const, findings: [finding1] };
      const b = { status: 'flagged' as const, findings: [finding2] };
      const result = mergeModeration(a, b);
      expect(result?.findings).toHaveLength(2);
      expect(result?.findings).toContainEqual(finding1);
      expect(result?.findings).toContainEqual(finding2);
    });

    it('returns undefined findings when neither has findings', () => {
      const a = { status: 'passed' as const };
      const b = { status: 'passed' as const };
      expect(mergeModeration(a, b)?.findings).toBeUndefined();
    });
  });

  describe('provider selection', () => {
    it('prefers output provider', () => {
      const a = { status: 'passed' as const, provider: 'aws' };
      const b = { status: 'passed' as const, provider: 'google' };
      expect(mergeModeration(a, b)?.provider).toBe('google');
    });

    it('falls back to input provider when output has none', () => {
      const a = { status: 'passed' as const, provider: 'aws' };
      const b = { status: 'passed' as const };
      expect(mergeModeration(a, b)?.provider).toBe('aws');
    });
  });

  describe('reviewedAt selection', () => {
    it('prefers output reviewedAt', () => {
      const a = { status: 'passed' as const, reviewedAt: 1000 };
      const b = { status: 'passed' as const, reviewedAt: 2000 };
      expect(mergeModeration(a, b)?.reviewedAt).toBe(2000);
    });

    it('falls back to input reviewedAt when output has none', () => {
      const a = { status: 'passed' as const, reviewedAt: 1000 };
      const b = { status: 'passed' as const };
      expect(mergeModeration(a, b)?.reviewedAt).toBe(1000);
    });
  });
});
