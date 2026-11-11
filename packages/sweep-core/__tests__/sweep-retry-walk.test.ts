import { describe, expect, it, vi } from 'vitest';
import type { ServerDocSnapshot } from '@ttt-productions/firebase-helpers/server';
import { SWEEP_STATE_MAX_DEFERRED } from '../src/sweep-state.js';
import type { SweepDeferredRow } from '../src/sweep-state.js';
import {
  firestoreIdSource,
  firestoreValueSource,
  rereadDocuments,
} from '../src/server/sweep-sources.js';
import { walkSweepWithRetryList } from '../src/server/sweep-retry-walk.js';
import type { SweepRetryTiming, SweepRowOutcome } from '../src/server/sweep-retry-walk.js';
import type { SweepReport } from '../src/server/sweep-report.js';
import { statePath, sweepFixture } from './helpers.js';

type Fixture = ReturnType<typeof sweepFixture>;

function seedRows(
  memory: Fixture['memory'],
  ids: readonly string[],
  data: Record<string, unknown> = {},
) {
  for (const id of ids) memory.seed(`rows/${id}`, data);
}

function walk(
  fixture: Fixture,
  options: {
    now: number;
    outcome: (key: string) => SweepRowOutcome;
    retry?: SweepRetryTiming;
    pageSize?: number;
    pages?: number;
    onRetryListFull?: () => void;
    byValue?: boolean;
    report?: SweepReport;
    store?: Fixture['store'];
  },
) {
  const seen: string[] = [];
  const query = fixture.db.collection('rows');
  const run = walkSweepWithRetryList({
    store: options.store ?? fixture.store,
    name: 'alpha',
    source: options.byValue ? firestoreValueSource(query, 'at') : firestoreIdSource(query),
    pageSize: options.pageSize ?? 10,
    pages: options.pages ?? 1,
    now: options.now,
    retry: options.retry ?? { kind: 'nextRun' },
    reread: rereadDocuments(
      () => fixture.db,
      (key) => fixture.db.doc(`rows/${key}`),
    ),
    examine: async (row: { key: string; item: ServerDocSnapshot }) => {
      seen.push(row.key);
      return options.outcome(row.key);
    },
    onRetryListFull: options.onRetryListFull ?? (() => {}),
    report: options.report ?? (() => {}),
  });
  return { run, seen };
}

const listed = (key: string, nextAttemptAt: number, attemptCount: number): SweepDeferredRow => ({
  key,
  nextAttemptAt,
  attemptCount,
});

describe('the walk with a retry list', () => {
  it('lists a row that comes back try-later, moves on, and completes the lap', async () => {
    const fixture = sweepFixture();
    seedRows(fixture.memory, ['a', 'b', 'c']);
    const { run } = walk(fixture, {
      now: 100,
      outcome: (key) => (key === 'b' ? 'tryLater' : 'cleared'),
    });
    expect(await run).toMatchObject({
      examined: 3,
      cleared: 2,
      triedLater: ['b'],
      lapComplete: true,
    });
    expect(fixture.memory.read(statePath('alpha'))).toEqual({
      updatedAt: 100,
      rollingCursor: { state: 'done', lapStartedAt: 100, lapCompletedAt: 100 },
      deferred: [listed('b', 100, 1)],
    });
  });

  it('retries a listed row on the next run when the sweep asks for the next run', async () => {
    const fixture = sweepFixture();
    seedRows(fixture.memory, ['b']);
    fixture.memory.seed(statePath('alpha'), {
      updatedAt: 1,
      rollingCursor: { state: 'inLap', afterKey: 'b', lapStartedAt: 1 },
      deferred: [listed('b', 100, 1)],
    });
    const { run, seen } = walk(fixture, { now: 200, outcome: () => 'tryLater' });
    await run;
    expect(seen).toEqual(['b']);
    expect(fixture.memory.read(statePath('alpha'))).toMatchObject({
      deferred: [listed('b', 200, 2)],
    });
  });

  it("waits the sweep's own growing wait before retrying a row", async () => {
    const fixture = sweepFixture();
    seedRows(fixture.memory, ['a']);
    const wait = vi.fn((now: number, attemptCount: number) => now + 10 * 2 ** attemptCount);
    const retry: SweepRetryTiming = { kind: 'growingWait', nextAttemptAt: wait };
    await walk(fixture, { now: 100, outcome: () => 'tryLater', retry }).run;
    expect(fixture.memory.read(statePath('alpha'))).toMatchObject({
      deferred: [listed('a', 120, 1)],
    });

    const early = walk(fixture, { now: 119, outcome: () => 'tryLater', retry });
    await early.run;
    expect(early.seen).toEqual([]);

    await walk(fixture, { now: 120, outcome: () => 'tryLater', retry }).run;
    expect(wait).toHaveBeenLastCalledWith(120, 2);
    expect(fixture.memory.read(statePath('alpha'))).toMatchObject({
      deferred: [listed('a', 160, 2)],
    });
  });

  it('examines due rows first, re-read the way the sweep reads them, and clears one that is gone', async () => {
    const fixture = sweepFixture();
    seedRows(fixture.memory, ['m', 'z']);
    fixture.memory.seed(statePath('alpha'), {
      updatedAt: 1,
      rollingCursor: { state: 'inLap', afterKey: 'z', lapStartedAt: 1 },
      deferred: [listed('gone', 5, 3), listed('z', 5, 1), listed('m', 999, 1)],
    });
    const { run, seen } = walk(fixture, { now: 10, outcome: () => 'cleared' });
    const result = await run;
    expect(seen).toEqual(['z']);
    expect(result.cleared).toBe(2);
    expect(fixture.memory.read(statePath('alpha'))).toMatchObject({
      deferred: [listed('m', 999, 1)],
    });
  });

  it('keeps the value of a listed row from a value-ordered source', async () => {
    const fixture = sweepFixture();
    seedRows(fixture.memory, ['a'], { at: 7 });
    await walk(fixture, { now: 10, outcome: () => 'tryLater', byValue: true }).run;
    expect(fixture.memory.read(statePath('alpha'))).toMatchObject({
      deferred: [{ key: 'a', value: 7, nextAttemptAt: 10, attemptCount: 1 }],
    });
  });

  it('holds the position at a row out of budget without counting it a failure, and keeps examining', async () => {
    const fixture = sweepFixture();
    seedRows(fixture.memory, ['a', 'b', 'c']);
    const { run, seen } = walk(fixture, {
      now: 10,
      outcome: (key) => (key === 'b' ? 'outOfBudget' : 'cleared'),
    });
    const result = await run;
    expect(seen).toEqual(['a', 'b', 'c']);
    expect(result).toMatchObject({
      outOfBudget: 1,
      triedLater: [],
      positionHeld: true,
      lapComplete: false,
    });
    expect(fixture.memory.read(statePath('alpha'))).toEqual({
      updatedAt: 10,
      rollingCursor: { state: 'inLap', afterKey: 'a', lapStartedAt: 10 },
    });
  });

  it('keeps a due row out of budget on the list, due again, with its attempt count unchanged', async () => {
    const fixture = sweepFixture();
    seedRows(fixture.memory, ['a']);
    fixture.memory.seed(statePath('alpha'), {
      updatedAt: 1,
      rollingCursor: { state: 'inLap', afterKey: 'a', lapStartedAt: 1 },
      deferred: [listed('a', 5, 2)],
    });
    await walk(fixture, { now: 10, outcome: () => 'outOfBudget' }).run;
    expect(fixture.memory.read(statePath('alpha'))).toMatchObject({
      deferred: [listed('a', 10, 2)],
    });
  });

  it('when the list is full, keeps examining the page, holds the position, and warns once', async () => {
    const fixture = sweepFixture();
    const full = Array.from({ length: SWEEP_STATE_MAX_DEFERRED }, (_, i) =>
      listed(`full${i}`, 9999, 1),
    );
    seedRows(fixture.memory, ['p1', 'p2', 'p3', 'p4']);
    fixture.memory.seed(statePath('alpha'), { updatedAt: 1, deferred: full });
    const onRetryListFull = vi.fn();
    const { run, seen } = walk(fixture, {
      now: 10,
      outcome: (key) => (key === 'p2' || key === 'p3' ? 'tryLater' : 'cleared'),
      onRetryListFull,
    });
    const result = await run;
    expect(seen).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(onRetryListFull).toHaveBeenCalledTimes(1);
    expect(onRetryListFull).toHaveBeenCalledWith({
      key: 'p2',
      retryRows: SWEEP_STATE_MAX_DEFERRED,
    });
    expect(result).toMatchObject({ retryListFull: true, positionHeld: true, lapComplete: false });
    const saved = fixture.memory.read(statePath('alpha'));
    expect(saved).toMatchObject({ rollingCursor: { state: 'inLap', afterKey: 'p1' } });
    expect((saved as { deferred: unknown[] }).deferred).toHaveLength(SWEEP_STATE_MAX_DEFERRED);
  });

  it('passes a row already on the list without examining it', async () => {
    const fixture = sweepFixture();
    seedRows(fixture.memory, ['a', 'b']);
    fixture.memory.seed(statePath('alpha'), { updatedAt: 1, deferred: [listed('a', 9999, 1)] });
    const { run, seen } = walk(fixture, { now: 10, outcome: () => 'cleared' });
    expect(await run).toMatchObject({ lapComplete: true });
    expect(seen).toEqual(['b']);
  });

  it('reads more pages within its page limit, from the last row read', async () => {
    const fixture = sweepFixture();
    seedRows(fixture.memory, ['a', 'b', 'c', 'd', 'e']);
    const { run, seen } = walk(fixture, {
      now: 10,
      outcome: () => 'cleared',
      pageSize: 2,
      pages: 2,
    });
    expect(await run).toMatchObject({ lapComplete: false });
    expect(seen).toEqual(['a', 'b', 'c', 'd']);
    expect(fixture.memory.read(statePath('alpha'))).toMatchObject({
      rollingCursor: { state: 'inLap', afterKey: 'd' },
    });
  });

  it("rethrows the row step's error and reports a failed save of its progress once", async () => {
    const fixture = sweepFixture();
    seedRows(fixture.memory, ['a', 'b']);
    const saveFailure = new Error('save failed');
    const rowFailure = new Error('row failed');
    const reporter = vi.fn();
    const { run } = walk(fixture, {
      now: 10,
      outcome: (key) => {
        if (key === 'b') throw rowFailure;
        return 'tryLater';
      },
      report: reporter,
      store: {
        read: fixture.store.read,
        update: async () => {
          throw saveFailure;
        },
      },
    });
    await expect(run).rejects.toBe(rowFailure);
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith(saveFailure, { kind: 'positionSave' });
  });

  it('lists a null-valued row with its null value', async () => {
    const fixture = sweepFixture();
    seedRows(fixture.memory, ['a'], { at: null });
    await walk(fixture, { now: 10, outcome: () => 'tryLater', byValue: true }).run;
    expect(fixture.memory.read(statePath('alpha'))).toMatchObject({
      deferred: [{ key: 'a', value: null, nextAttemptAt: 10, attemptCount: 1 }],
    });
  });
});
