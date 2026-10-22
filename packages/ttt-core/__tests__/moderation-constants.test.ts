import { describe, it, expect } from 'vitest';
import {
  REJECTED_MEDIA_RETENTION_DAYS,
  PENDING_MEDIA_ARCHIVE_AFTER_DAYS,
  ORPHAN_UPLOAD_TTL_HOURS,
  PUBLIC_LOOKUP_ABSENT_STALE_TIME_MS,
  PUBLIC_USERS_STALE_TIME_MS,
} from '../src/constants/retention.js';

describe('REJECTED_MEDIA_RETENTION_DAYS', () => {
  it('is the ruled 90-day window for moderation-rejected bytes', () => {
    expect(REJECTED_MEDIA_RETENTION_DAYS).toBe(90);
  });

  it('outlives the terminal pendingMedia archive move — appeal evidence survives archiving', () => {
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
