// The media sweep's deferral policy: the picture-retirement and stale-upload passes each keep their
// position in their own sweep-state document, and a row a pass keeps or fails on is retried on a
// backoff that starts at the sweep's own cadence and stops growing at a day.

import { describe, it, expect } from 'vitest';
import {
  MEDIA_SWEEP_BACKOFF_BASE_MS,
  MEDIA_SWEEP_BACKOFF_MAX_MS,
  PICTURE_RETIREMENT_PAGE_SIZE,
  STALE_PENDING_MEDIA_PAGE_SIZE,
} from '../src/constants/media';
import { SWEEP_STATE_MAX_DEFERRED, SWEEP_STATE_NAMES } from '../src/constants/scheduled-jobs';
import * as packageRoot from '../src/index';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
// The media maintenance schedule's cadence ("every 15 minutes"), declared in the app's Functions,
// which this package cannot import.
const MEDIA_SWEEP_CADENCE_MS = 15 * MINUTE_MS;

describe('the media sweep deferral backoff', () => {
  it('starts at one sweep run, since any shorter delay is simply the next run', () => {
    expect(MEDIA_SWEEP_BACKOFF_BASE_MS).toBe(MEDIA_SWEEP_CADENCE_MS);
  });

  it('stops growing at a day', () => {
    expect(MEDIA_SWEEP_BACKOFF_MAX_MS).toBe(DAY_MS);
    expect(MEDIA_SWEEP_BACKOFF_MAX_MS).toBeGreaterThanOrEqual(MEDIA_SWEEP_BACKOFF_BASE_MS);
  });

  it('keeps retrying a full deferred set cheaper than one page of either pass', () => {
    expect(SWEEP_STATE_MAX_DEFERRED).toBeGreaterThan(0);
    expect(SWEEP_STATE_MAX_DEFERRED).toBeLessThanOrEqual(PICTURE_RETIREMENT_PAGE_SIZE);
    expect(SWEEP_STATE_MAX_DEFERRED).toBeLessThan(STALE_PENDING_MEDIA_PAGE_SIZE);
  });

  it('is importable from the package root', () => {
    expect(packageRoot.MEDIA_SWEEP_BACKOFF_BASE_MS).toBe(MEDIA_SWEEP_BACKOFF_BASE_MS);
    expect(packageRoot.MEDIA_SWEEP_BACKOFF_MAX_MS).toBe(MEDIA_SWEEP_BACKOFF_MAX_MS);
  });
});

describe('the sweep-state documents', () => {
  it('gives the picture-retirement and stale-upload passes a position each, never shared', () => {
    expect(SWEEP_STATE_NAMES).toEqual(expect.arrayContaining(['pictureRetirement', 'stalePendingMedia']));
    expect(new Set(SWEEP_STATE_NAMES).size).toBe(SWEEP_STATE_NAMES.length);
  });
});
