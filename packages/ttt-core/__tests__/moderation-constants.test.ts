import { describe, it, expect } from 'vitest';
import {
  REJECTION_LIKELIHOODS,
  TEXT_MODERATION_MIN_LENGTH,
} from '../src/constants/moderation';
import {
  REJECTED_MEDIA_RETENTION_DAYS,
  PENDING_MEDIA_ARCHIVE_AFTER_DAYS,
  ORPHAN_UPLOAD_TTL_HOURS,
  PUBLIC_LOOKUP_ABSENT_STALE_TIME_MS,
  PUBLIC_USERS_STALE_TIME_MS,
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

describe('PUBLIC_LOOKUP_ABSENT_STALE_TIME_MS', () => {
  it('is a short negative-cache window (15-30 seconds)', () => {
    expect(PUBLIC_LOOKUP_ABSENT_STALE_TIME_MS).toBeGreaterThanOrEqual(15 * 1000);
    expect(PUBLIC_LOOKUP_ABSENT_STALE_TIME_MS).toBeLessThanOrEqual(30 * 1000);
  });

  it('is far shorter than the PRESENT-document window — an absent doc can appear at any moment', () => {
    expect(PUBLIC_LOOKUP_ABSENT_STALE_TIME_MS).toBeLessThan(PUBLIC_USERS_STALE_TIME_MS);
  });
});
