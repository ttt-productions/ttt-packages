import { describe, it, expect } from 'vitest';
import { ACTIVE_LIMITS, CHARTER_LIMITS, FULL_LIMITS } from '../src/constants/app-mode';

describe('app-mode rate-limit buckets', () => {
  it('admin uploads have the ruled values (60/h charter, 120/h full — DJ ruling 2026-07-25)', () => {
    expect(CHARTER_LIMITS.rateLimits.ADMIN_UPLOAD).toEqual({ maxRequests: 60, window: '1 h' });
    expect(FULL_LIMITS.rateLimits.ADMIN_UPLOAD).toEqual({ maxRequests: 120, window: '1 h' });
  });

  it('ADMIN_UPLOAD is a HIGHER bucket than UPLOAD in every mode — never an exemption', () => {
    for (const limits of [CHARTER_LIMITS, FULL_LIMITS, ACTIVE_LIMITS]) {
      const { UPLOAD, ADMIN_UPLOAD } = limits.rateLimits;
      expect(ADMIN_UPLOAD.window).toBe(UPLOAD.window);
      expect(ADMIN_UPLOAD.maxRequests).toBeGreaterThan(UPLOAD.maxRequests);
      expect(Number.isFinite(ADMIN_UPLOAD.maxRequests)).toBe(true);
    }
  });
});
