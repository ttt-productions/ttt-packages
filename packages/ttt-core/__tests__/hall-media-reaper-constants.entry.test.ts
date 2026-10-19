import { describe, it, expect } from 'vitest';
import {
  HALL_MEDIA_ORPHAN_GRACE_MS,
  HALL_MEDIA_REAPER_BACKOFF_BASE_MS,
  HALL_MEDIA_REAPER_BACKOFF_MAX_MS,
  HALL_MEDIA_REAPER_CLAIM_LEASE_MS,
  SWEEP_STATE_MAX_DEFERRED,
  HALL_MEDIA_REAPER_PAGE_SIZE,
} from '../src/constants/scheduled-jobs.js';
import * as constantsBarrel from '../src/constants/index.js';

describe('Hall-media orphan reaper policy constants', () => {
  it('is importable from the constants entry', () => {
    expect(constantsBarrel.HALL_MEDIA_ORPHAN_GRACE_MS).toBe(HALL_MEDIA_ORPHAN_GRACE_MS);
    expect(constantsBarrel.HALL_MEDIA_REAPER_PAGE_SIZE).toBe(HALL_MEDIA_REAPER_PAGE_SIZE);
    expect(constantsBarrel.HALL_MEDIA_REAPER_BACKOFF_BASE_MS).toBe(HALL_MEDIA_REAPER_BACKOFF_BASE_MS);
    expect(constantsBarrel.HALL_MEDIA_REAPER_BACKOFF_MAX_MS).toBe(HALL_MEDIA_REAPER_BACKOFF_MAX_MS);
    expect(constantsBarrel.SWEEP_STATE_MAX_DEFERRED).toBe(SWEEP_STATE_MAX_DEFERRED);
    expect(constantsBarrel.HALL_MEDIA_REAPER_CLAIM_LEASE_MS).toBe(HALL_MEDIA_REAPER_CLAIM_LEASE_MS);
  });
});
