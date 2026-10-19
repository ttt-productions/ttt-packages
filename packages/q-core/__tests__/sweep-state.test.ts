import { describe, it, expect } from 'vitest';
import { SWEEP_STATE_MAX_DEFERRED } from '../src/constants/scheduled-jobs.js';
import { SweepRollingCursorSchema, SweepStateSchema } from '../src/doc-schemas/sweep-state.js';

const row = (key: string) => ({ key, nextAttemptAt: 1, attemptCount: 1 });

describe('sweepState contract', () => {
  it('takes a pass position: a cursor in a lap, deferred rows, and when it was written', () => {
    expect(
      SweepStateSchema.safeParse({
        rollingCursor: { state: 'inLap', afterKey: 'user-9', lapStartedAt: 1 },
        deferred: [row('user-3')],
        updatedAt: 2,
      }).success,
    ).toBe(true);
    expect(SweepStateSchema.safeParse({ updatedAt: 2 }).success).toBe(true);
  });

  it('defers a row at most once', () => {
    expect(
      SweepStateSchema.safeParse({ deferred: [row('user-3'), row('user-3')], updatedAt: 2 })
        .success,
    ).toBe(false);
  });

  it('holds no more deferred rows than its cap', () => {
    const rows = Array.from({ length: SWEEP_STATE_MAX_DEFERRED + 1 }, (_, index) =>
      row(`user-${index}`),
    );
    expect(SweepStateSchema.safeParse({ deferred: rows, updatedAt: 2 }).success).toBe(false);
  });

  it('refuses a lap that completes before it started', () => {
    expect(
      SweepRollingCursorSchema.safeParse({ state: 'done', lapStartedAt: 10, lapCompletedAt: 9 })
        .success,
    ).toBe(false);
    expect(
      SweepRollingCursorSchema.safeParse({ state: 'done', lapStartedAt: 10, lapCompletedAt: 10 })
        .success,
    ).toBe(true);
    expect(
      SweepStateSchema.safeParse({
        rollingCursor: { state: 'done', lapStartedAt: 10, lapCompletedAt: 9 },
        updatedAt: 2,
      }).success,
    ).toBe(false);
  });

  it('refuses a cursor in a lap with no row to resume after', () => {
    expect(
      SweepRollingCursorSchema.safeParse({ state: 'inLap', afterKey: '', lapStartedAt: 1 }).success,
    ).toBe(false);
  });
});
