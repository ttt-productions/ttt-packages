import { describe, it, expect } from 'vitest';
import {
  MEDIA_PROCESSING_MAX_ATTEMPTS,
  MEDIA_PROCESSING_LEASE_MS,
} from '../src/constants/media-processing.js';

describe('media-processing policy constants', () => {
  it('allows the first attempt plus one crash retry', () => {
    expect(MEDIA_PROCESSING_MAX_ATTEMPTS).toBe(2);
  });

  it('sets a 12-minute lease covering the 540s timeout plus margin', () => {
    expect(MEDIA_PROCESSING_LEASE_MS).toBe(12 * 60 * 1000);
    expect(MEDIA_PROCESSING_LEASE_MS).toBeGreaterThan(540 * 1000);
  });
});
