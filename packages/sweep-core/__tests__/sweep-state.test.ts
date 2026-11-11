import { describe, expect, it } from 'vitest';
import {
  AUTH_FULL_SCAN_EXAMINED_PER_RUN,
  AUTH_LIST_USERS_PAGE_SIZE,
  SWEEP_STATE_MAX_DEFERRED,
  SweepRollingCursorSchema,
  SweepStateSchema,
} from '../src/sweep-state.js';

const row = (key: string) => ({ key, nextAttemptAt: 10, attemptCount: 1 });

describe('the saved-position schema', () => {
  it('drops a field it does not name, at the top and inside every nested part', () => {
    const parsed = SweepStateSchema.parse({
      updatedAt: 5,
      stray: true,
      fullScanLap: { pageToken: 't', lapStartedAt: 1, stray: 1 },
      rollingCursor: { state: 'inLap', afterKey: 'a', lapStartedAt: 1, stray: 'x' },
      deferred: [{ ...row('a'), stray: 2 }],
    });
    expect(parsed).toEqual({
      updatedAt: 5,
      fullScanLap: { pageToken: 't', lapStartedAt: 1 },
      rollingCursor: { state: 'inLap', afterKey: 'a', lapStartedAt: 1 },
      deferred: [row('a')],
    });
  });

  it.each([
    ['a fractional time', { updatedAt: 1.5 }],
    ['a negative time', { updatedAt: -1 }],
    ['a fractional last full scan', { updatedAt: 1, fullScanLastRunAt: 2.5 }],
    ['a negative lap start', { updatedAt: 1, fullScanLap: { pageToken: 't', lapStartedAt: -3 } }],
    ['a fractional retry time', { updatedAt: 1, deferred: [{ ...row('a'), nextAttemptAt: 1.1 }] }],
  ])('refuses %s', (_label, value) => {
    expect(SweepStateSchema.safeParse(value).success).toBe(false);
  });

  it('holds a null position value, which Firestore orders before every number', () => {
    expect(
      SweepStateSchema.parse({
        updatedAt: 1,
        rollingCursor: { state: 'inLap', afterKey: 'a', afterValue: null, lapStartedAt: 1 },
        deferred: [{ ...row('b'), value: null }],
      }),
    ).toMatchObject({ rollingCursor: { afterValue: null }, deferred: [{ value: null }] });
    expect(
      SweepStateSchema.safeParse({
        updatedAt: 1,
        rollingCursor: { state: 'inLap', afterKey: 'a', afterValue: 'x', lapStartedAt: 1 },
      }).success,
    ).toBe(false);
  });

  it('holds at most the retry-list cap of rows', () => {
    const full = Array.from({ length: SWEEP_STATE_MAX_DEFERRED }, (_, i) => row(`k${i}`));
    expect(SweepStateSchema.safeParse({ updatedAt: 1, deferred: full }).success).toBe(true);
    expect(
      SweepStateSchema.safeParse({ updatedAt: 1, deferred: [...full, row('one-more')] }).success,
    ).toBe(false);
  });

  it('holds a row on the retry list at most once', () => {
    const result = SweepStateSchema.safeParse({ updatedAt: 1, deferred: [row('a'), row('a')] });
    expect(result.success).toBe(false);
  });

  it('refuses a finished lap that completes before it started', () => {
    expect(
      SweepRollingCursorSchema.safeParse({ state: 'done', lapStartedAt: 10, lapCompletedAt: 9 })
        .success,
    ).toBe(false);
    expect(
      SweepRollingCursorSchema.safeParse({ state: 'done', lapStartedAt: 10, lapCompletedAt: 10 })
        .success,
    ).toBe(true);
  });

  it('holds the three numbers both products share', () => {
    expect([
      SWEEP_STATE_MAX_DEFERRED,
      AUTH_LIST_USERS_PAGE_SIZE,
      AUTH_FULL_SCAN_EXAMINED_PER_RUN,
    ]).toEqual([50, 1000, 2000]);
  });
});
