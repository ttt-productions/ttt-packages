import { describe, it, expect } from 'vitest';
import {
  REJECTED_MEDIA_RETENTION_DAYS,
  isRejectedMediaAppealOpen,
  rejectedMediaAppealDeadline,
} from '../src/constants/retention';
import { contentViolationActions } from '../src/doc-schemas/moderation';
import * as root from '../src/index';

const DAY_MS = 24 * 60 * 60 * 1000;
const rejectedAt = 1_000_000;
const insideWindow = rejectedAt + DAY_MS;
const afterWindow = rejectedAt + REJECTED_MEDIA_RETENTION_DAYS * DAY_MS;

describe('the appeal window', () => {
  it('is the rejected-media retention window, measured from the rejection', () => {
    expect(rejectedMediaAppealDeadline(rejectedAt)).toBe(rejectedAt + REJECTED_MEDIA_RETENTION_DAYS * DAY_MS);
  });

  it('is open until the moment the retained file becomes deletable, and closed from then on', () => {
    expect(isRejectedMediaAppealOpen(rejectedAt, rejectedAt)).toBe(true);
    expect(isRejectedMediaAppealOpen(rejectedAt, afterWindow - 1)).toBe(true);
    expect(isRejectedMediaAppealOpen(rejectedAt, afterWindow)).toBe(false);
  });

  it('is exported from the package root', () => {
    expect(root.isRejectedMediaAppealOpen).toBe(isRejectedMediaAppealOpen);
  });
});

describe('the actions a violation offers', () => {
  const media = { violationType: 'media' as const, timestamp: rejectedAt };

  it('offers Appeal and Accept on an unappealed media rejection inside the window', () => {
    expect(contentViolationActions({ ...media, appealStatus: 'none' }, insideWindow)).toEqual({ appeal: true, accept: true });
  });

  it('offers only Accept once the appeal window has closed', () => {
    expect(contentViolationActions({ ...media, appealStatus: 'none' }, afterWindow)).toEqual({ appeal: false, accept: true });
  });

  it('never offers Appeal on a text rejection', () => {
    expect(
      contentViolationActions({ violationType: 'text', timestamp: rejectedAt, appealStatus: 'none' }, insideWindow),
    ).toEqual({ appeal: false, accept: true });
    expect(contentViolationActions({ timestamp: rejectedAt, appealStatus: 'none' }, insideWindow).appeal).toBe(false);
  });

  it('locks a pending appeal — no Accept, no withdrawal', () => {
    expect(contentViolationActions({ ...media, appealStatus: 'pending' }, insideWindow)).toEqual({
      appeal: false,
      accept: false,
    });
  });

  it('offers only Accept after a denial — no second appeal', () => {
    expect(contentViolationActions({ ...media, appealStatus: 'denied' }, insideWindow)).toEqual({
      appeal: false,
      accept: true,
    });
  });

  it('offers nothing after an approval', () => {
    expect(contentViolationActions({ ...media, appealStatus: 'approved' }, insideWindow)).toEqual({
      appeal: false,
      accept: false,
    });
  });
});
