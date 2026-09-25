import { describe, it, expect } from 'vitest';
import {
  HALL_MEDIA_ORPHAN_GRACE_MS,
  HALL_MEDIA_REAPER_BACKOFF_BASE_MS,
  HALL_MEDIA_REAPER_BACKOFF_MAX_MS,
  HALL_MEDIA_REAPER_CLAIM_LEASE_MS,
  HALL_MEDIA_REAPER_MAX_DEFERRED,
  HALL_MEDIA_REAPER_PAGE_SIZE,
} from '../src/constants/scheduled-jobs.js';
import * as constantsBarrel from '../src/constants/index.js';
import * as packageRoot from '../src/index.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// The `timeoutSeconds` of the app's reaper function `reapOrphanedHallMediaCopies`, which this
// package cannot import.
const REAPER_FUNCTION_TIMEOUT_MS = 300 * 1000;

describe('Hall-media orphan reaper policy constants', () => {
  it('leaves Hall-media copies alone for 14 days, far past the day-long retry window of the publish trigger', () => {
    expect(HALL_MEDIA_ORPHAN_GRACE_MS).toBe(14 * DAY_MS);
    expect(HALL_MEDIA_ORPHAN_GRACE_MS).toBeGreaterThan(DAY_MS);
  });

  it('takes up at most 100 candidates per phase per pass', () => {
    expect(HALL_MEDIA_REAPER_PAGE_SIZE).toBe(100);
  });

  it('backs a deferral off from the daily cadence to a 14-day cap', () => {
    expect(HALL_MEDIA_REAPER_BACKOFF_BASE_MS).toBe(DAY_MS);
    expect(HALL_MEDIA_REAPER_BACKOFF_MAX_MS).toBe(14 * DAY_MS);
    expect(HALL_MEDIA_REAPER_BACKOFF_MAX_MS).toBeGreaterThanOrEqual(HALL_MEDIA_REAPER_BACKOFF_BASE_MS);
  });

  it('keeps retrying a full deferred set cheaper than one page of its own', () => {
    expect(Number.isInteger(HALL_MEDIA_REAPER_MAX_DEFERRED)).toBe(true);
    expect(HALL_MEDIA_REAPER_MAX_DEFERRED).toBeGreaterThan(0);
    expect(HALL_MEDIA_REAPER_MAX_DEFERRED).toBeLessThan(HALL_MEDIA_REAPER_PAGE_SIZE);
  });

  it('holds a copy-intent claim for one hour', () => {
    expect(HALL_MEDIA_REAPER_CLAIM_LEASE_MS).toBe(HOUR_MS);
  });

  it('holds a claim at least ten times the reaper function timeout, so a live pass never loses it', () => {
    expect(HALL_MEDIA_REAPER_CLAIM_LEASE_MS).toBeGreaterThanOrEqual(10 * REAPER_FUNCTION_TIMEOUT_MS);
  });

  it('expires a claim inside the day-long retry budget of the publish trigger', () => {
    expect(HALL_MEDIA_REAPER_CLAIM_LEASE_MS).toBeLessThan(DAY_MS);
  });

  it('is importable from the constants barrel and the package root', () => {
    for (const surface of [constantsBarrel, packageRoot]) {
      expect(surface.HALL_MEDIA_ORPHAN_GRACE_MS).toBe(HALL_MEDIA_ORPHAN_GRACE_MS);
      expect(surface.HALL_MEDIA_REAPER_PAGE_SIZE).toBe(HALL_MEDIA_REAPER_PAGE_SIZE);
      expect(surface.HALL_MEDIA_REAPER_BACKOFF_BASE_MS).toBe(HALL_MEDIA_REAPER_BACKOFF_BASE_MS);
      expect(surface.HALL_MEDIA_REAPER_BACKOFF_MAX_MS).toBe(HALL_MEDIA_REAPER_BACKOFF_MAX_MS);
      expect(surface.HALL_MEDIA_REAPER_MAX_DEFERRED).toBe(HALL_MEDIA_REAPER_MAX_DEFERRED);
      expect(surface.HALL_MEDIA_REAPER_CLAIM_LEASE_MS).toBe(HALL_MEDIA_REAPER_CLAIM_LEASE_MS);
    }
  });
});
