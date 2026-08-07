import { describe, it, expect } from 'vitest';
import {
  REJECTION_LIKELIHOODS,
  TEXT_MODERATION_MIN_LENGTH,
} from '../src/constants/moderation';
import {
  REJECTED_MEDIA_RETENTION_DAYS,
  PENDING_MEDIA_ARCHIVE_AFTER_DAYS,
  ORPHAN_UPLOAD_TTL_HOURS,
} from '../src/constants/retention';

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

describe('REJECTED_MEDIA_RETENTION_DAYS', () => {
  it('is the ruled 90-day window for moderation-rejected bytes', () => {
    expect(REJECTED_MEDIA_RETENTION_DAYS).toBe(90);
  });

  it('outlives the terminal pendingMedia archive move — appeal evidence survives archiving', () => {
    // The rejected row is archived out of `pendingMedia` long before its bytes go; an
    // appellant must still be able to view the file the decision was made on.
    expect(REJECTED_MEDIA_RETENTION_DAYS).toBeGreaterThan(PENDING_MEDIA_ARCHIVE_AFTER_DAYS);
  });

  it('is far longer than the ORPHAN staging TTL — a rejected file is evidence, not an orphan', () => {
    expect(REJECTED_MEDIA_RETENTION_DAYS * 24).toBeGreaterThan(ORPHAN_UPLOAD_TTL_HOURS);
  });
});
