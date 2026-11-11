import { describe, expect, it, vi } from 'vitest';
import {
  firestoreIdSource,
  firestoreValueSource,
  storageListingSource,
} from '../src/server/sweep-sources.js';
import type { SweepObjectLister, SweepObjectListQuery } from '../src/server/sweep-sources.js';
import { openSweepPage, walkSweep } from '../src/server/sweep-walk.js';
import { statePath, sweepFixture } from './helpers.js';

const report = vi.fn();

function seedRows(
  memory: ReturnType<typeof sweepFixture>['memory'],
  rows: Record<string, Record<string, unknown>>,
) {
  for (const [id, data] of Object.entries(rows)) memory.seed(`rows/${id}`, data);
}

const keptVisit = async () => 'kept' as const;

describe('a Firestore query ordered by id', () => {
  it('resumes after the saved id and records it as the lap goes', async () => {
    const { memory, store, db } = sweepFixture();
    seedRows(memory, { a: {}, b: {}, c: {}, d: {}, e: {} });
    memory.seed(statePath('alpha'), {
      updatedAt: 1,
      rollingCursor: { state: 'inLap', afterKey: 'b', lapStartedAt: 1 },
    });
    const seen: string[] = [];
    const run = await walkSweep({
      store,
      name: 'alpha',
      source: firestoreIdSource(db.collection('rows')),
      pageSize: 2,
      now: 50,
      limits: { pages: 1 },
      report,
      visit: async (row) => {
        seen.push(row.key);
        return 'kept';
      },
    });
    expect(seen).toEqual(['c', 'd']);
    expect(run).toMatchObject({ endedBy: 'pageLimit', lapComplete: false, examined: 2 });
    expect(memory.read(statePath('alpha'))).toMatchObject({
      rollingCursor: { state: 'inLap', afterKey: 'd', lapStartedAt: 1 },
    });
  });

  it('marks the lap done when the source ends, and starts the next lap from the first row', async () => {
    const { memory, store, db } = sweepFixture();
    seedRows(memory, { a: {}, b: {} });
    const walk = (now: number) =>
      walkSweep({
        store,
        name: 'alpha',
        source: firestoreIdSource(db.collection('rows')),
        pageSize: 5,
        now,
        limits: { pages: 3 },
        report,
        visit: keptVisit,
      });
    expect(await walk(10)).toMatchObject({ lapComplete: true, examined: 2 });
    expect(memory.read(statePath('alpha'))).toMatchObject({
      rollingCursor: { state: 'done', lapStartedAt: 10, lapCompletedAt: 10 },
    });
    expect(await walk(20)).toMatchObject({ lapComplete: true, examined: 2 });
  });

  it('waits out the minimum time between laps', async () => {
    const { memory, store, db } = sweepFixture();
    seedRows(memory, { a: {} });
    memory.seed(statePath('alpha'), {
      updatedAt: 1,
      rollingCursor: { state: 'done', lapStartedAt: 1, lapCompletedAt: 100 },
    });
    const walk = (now: number) =>
      walkSweep({
        store,
        name: 'alpha',
        source: firestoreIdSource(db.collection('rows')),
        pageSize: 5,
        now,
        limits: { pages: 1 },
        minLapIntervalMs: 50,
        report,
        visit: keptVisit,
      });
    expect((await walk(149)).ran).toBe(false);
    expect((await walk(150)).ran).toBe(true);
  });
});

describe('a Firestore query ordered by a value and then id', () => {
  it('resumes after both, so a row tied on the value across the saved position is not skipped', async () => {
    const { memory, store, db } = sweepFixture();
    seedRows(memory, { a: { at: 5 }, b: { at: 5 }, c: { at: 5 }, d: { at: 7 } });
    memory.seed(statePath('alpha'), {
      updatedAt: 1,
      rollingCursor: { state: 'inLap', afterKey: 'a', afterValue: 5, lapStartedAt: 1 },
    });
    const seen: string[] = [];
    await walkSweep({
      store,
      name: 'alpha',
      source: firestoreValueSource(db.collection('rows'), 'at'),
      pageSize: 2,
      now: 9,
      limits: { pages: 1 },
      report,
      visit: async (row) => {
        seen.push(row.key);
        return 'kept';
      },
    });
    expect(seen).toEqual(['b', 'c']);
    expect(memory.read(statePath('alpha'))).toMatchObject({
      rollingCursor: { state: 'inLap', afterKey: 'c', afterValue: 5 },
    });
  });

  it('fails loudly on a value that is neither a number nor null, after saving the rows before it', async () => {
    const { memory, store, db } = sweepFixture();
    seedRows(memory, { a: { at: 5 }, b: { at: 6 }, c: { at: 'late' } });
    const seen: string[] = [];
    await expect(
      walkSweep({
        store,
        name: 'alpha',
        source: firestoreValueSource(db.collection('rows'), 'at'),
        pageSize: 5,
        now: 9,
        limits: { pages: 1 },
        report,
        visit: async (row) => {
          seen.push(row.key);
          return 'kept';
        },
      }),
    ).rejects.toMatchObject({ name: 'SweepPositionValueError', field: 'at', key: 'c' });
    expect(seen).toEqual(['a', 'b']);
    expect(memory.read(statePath('alpha'))).toMatchObject({
      rollingCursor: { state: 'inLap', afterKey: 'b', afterValue: 6 },
    });
  });

  it('fails at once when the first row it reads holds a value that is neither a number nor null', async () => {
    const { memory, store, db } = sweepFixture();
    seedRows(memory, { a: { at: true } });
    const visit = vi.fn(async () => 'kept' as const);
    await expect(
      walkSweep({
        store,
        name: 'alpha',
        source: firestoreValueSource(db.collection('rows'), 'at'),
        pageSize: 5,
        now: 9,
        limits: { pages: 1 },
        report,
        visit,
      }),
    ).rejects.toMatchObject({ field: 'at', key: 'a' });
    expect(visit).not.toHaveBeenCalled();
  });

  it('reaches past a run of null values longer than one run, examining nothing twice', async () => {
    const { memory, store, db } = sweepFixture();
    seedRows(memory, {
      n1: { at: null },
      n2: { at: null },
      n3: { at: null },
      n4: { at: null },
      n5: { at: null },
      v1: { at: 1 },
      v2: { at: 2 },
    });
    const seen: string[] = [];
    const run = () =>
      walkSweep({
        store,
        name: 'alpha',
        source: firestoreValueSource(db.collection('rows'), 'at'),
        pageSize: 2,
        now: 9,
        limits: { pages: 2 },
        report,
        visit: async (row) => {
          seen.push(row.key);
          return 'kept';
        },
      });
    await run();
    expect(seen).toEqual(['n1', 'n2', 'n3', 'n4']);
    expect(memory.read(statePath('alpha'))).toMatchObject({
      rollingCursor: { state: 'inLap', afterKey: 'n4', afterValue: null },
    });
    await run();
    expect(seen).toEqual(['n1', 'n2', 'n3', 'n4', 'n5', 'v1', 'v2']);
  });

  it('resumes after a saved null position without skipping a row tied on null', async () => {
    const { memory, store, db } = sweepFixture();
    seedRows(memory, { a: { at: null }, b: { at: null }, c: { at: null } });
    memory.seed(statePath('alpha'), {
      updatedAt: 1,
      rollingCursor: { state: 'inLap', afterKey: 'a', afterValue: null, lapStartedAt: 1 },
    });
    const seen: string[] = [];
    await walkSweep({
      store,
      name: 'alpha',
      source: firestoreValueSource(db.collection('rows'), 'at'),
      pageSize: 5,
      now: 9,
      limits: { pages: 1 },
      report,
      visit: async (row) => {
        seen.push(row.key);
        return 'kept';
      },
    });
    expect(seen).toEqual(['b', 'c']);
  });
});

interface StoredFile {
  readonly name: string;
}

function bucket(names: readonly string[]) {
  const queries: SweepObjectListQuery[] = [];
  const lister: SweepObjectLister<StoredFile> = {
    getFiles: async (query) => {
      queries.push(query);
      const sorted = [...names].sort();
      const from = query.pageToken
        ? Number(query.pageToken)
        : sorted.findIndex(
            (name) => name.startsWith(query.prefix) && name >= (query.startOffset ?? ''),
          );
      const start = from < 0 ? sorted.length : from;
      const page = sorted.slice(start, start + query.maxResults).map((name) => ({ name }));
      const end = start + query.maxResults;
      return [page, end < sorted.length ? { pageToken: String(end) } : null];
    },
  };
  return { lister, queries };
}

describe('a Storage listing', () => {
  it('resumes at its last object, skips that object, and pages on within the run', async () => {
    const { memory, store } = sweepFixture();
    memory.seed(statePath('alpha'), {
      updatedAt: 1,
      rollingCursor: { state: 'inLap', afterKey: 'up/b', lapStartedAt: 1 },
    });
    const { lister, queries } = bucket(['up/a', 'up/b', 'up/c', 'up/d', 'up/e']);
    const seen: string[] = [];
    const run = await walkSweep({
      store,
      name: 'alpha',
      source: storageListingSource(lister, 'up/'),
      pageSize: 2,
      now: 9,
      limits: { rowsExamined: 10 },
      report,
      visit: async (row) => {
        seen.push(row.key);
        return 'kept';
      },
    });
    expect(queries[0]).toMatchObject({ prefix: 'up/', startOffset: 'up/b', maxResults: 2 });
    expect(queries[1]?.startOffset).toBeUndefined();
    expect(seen).toEqual(['up/c', 'up/d', 'up/e']);
    expect(run).toMatchObject({ lapComplete: true, endedBy: 'end' });
  });

  it('stops at its delete limit before the next row and resumes at that row', async () => {
    const { memory, store } = sweepFixture();
    const { lister } = bucket(['up/a', 'up/b', 'up/c']);
    const run = await walkSweep({
      store,
      name: 'alpha',
      source: storageListingSource(lister, 'up/'),
      pageSize: 10,
      now: 9,
      limits: { rowsExamined: 10, deletes: 2 },
      report,
      visit: async () => 'deleted',
    });
    expect(run).toMatchObject({
      examined: 2,
      deleted: 2,
      endedBy: 'deleteLimit',
      lapComplete: false,
    });
    expect(memory.read(statePath('alpha'))).toMatchObject({
      rollingCursor: { state: 'inLap', afterKey: 'up/b' },
    });
  });

  it('stops at its rows-examined limit', async () => {
    const { store } = sweepFixture();
    const { lister } = bucket(['up/a', 'up/b', 'up/c']);
    const run = await walkSweep({
      store,
      name: 'alpha',
      source: storageListingSource(lister, 'up/'),
      pageSize: 10,
      now: 9,
      limits: { rowsExamined: 1 },
      report,
      visit: keptVisit,
    });
    expect(run).toMatchObject({ examined: 1, endedBy: 'examinedLimit' });
  });
});

describe('the walk that hands each row to the sweep', () => {
  it('prepares each page once before its rows', async () => {
    const { memory, store, db } = sweepFixture();
    seedRows(memory, { a: {}, b: {} });
    const prepared: string[][] = [];
    const contexts: number[] = [];
    await walkSweep({
      store,
      name: 'alpha',
      source: firestoreIdSource(db.collection('rows')),
      pageSize: 5,
      now: 9,
      limits: { pages: 1 },
      preparePage: async (rows) => {
        prepared.push(rows.map((row) => row.key));
        return rows.length;
      },
      report,
      visit: async (_row, size) => {
        contexts.push(size ?? -1);
        return 'kept';
      },
    });
    expect(prepared).toEqual([['a', 'b']]);
    expect(contexts).toEqual([2, 2]);
  });

  it('saves the rows passed before a row step that throws, then fails the run', async () => {
    const { memory, store, db } = sweepFixture();
    seedRows(memory, { a: {}, b: {}, c: {} });
    await expect(
      walkSweep({
        store,
        name: 'alpha',
        source: firestoreIdSource(db.collection('rows')),
        pageSize: 5,
        now: 9,
        limits: { pages: 1 },
        report,
        visit: async (row) => {
          if (row.key === 'b') throw new Error('row failed');
          return 'kept';
        },
      }),
    ).rejects.toThrow('row failed');
    expect(memory.read(statePath('alpha'))).toMatchObject({
      rollingCursor: { state: 'inLap', afterKey: 'a' },
    });
  });

  it("rethrows the row step's error and reports a failed save of the rows before it once", async () => {
    const { memory, store, db } = sweepFixture();
    seedRows(memory, { a: {}, b: {} });
    const saveFailure = new Error('save failed');
    const rowFailure = new Error('row failed');
    const reporter = vi.fn();
    await expect(
      walkSweep({
        store: {
          read: store.read,
          update: async () => {
            throw saveFailure;
          },
        },
        name: 'alpha',
        source: firestoreIdSource(db.collection('rows')),
        pageSize: 5,
        now: 9,
        limits: { pages: 1 },
        report: reporter,
        visit: async (row) => {
          if (row.key === 'b') throw rowFailure;
          return 'kept';
        },
      }),
    ).rejects.toBe(rowFailure);
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith(saveFailure, { kind: 'positionSave' });
  });

  it('refuses a walk with no page or rows-examined limit', async () => {
    const { store, db } = sweepFixture();
    await expect(
      walkSweep({
        store,
        name: 'alpha',
        source: firestoreIdSource(db.collection('rows')),
        pageSize: 5,
        now: 9,
        limits: { deletes: 1 },
        report,
        visit: keptVisit,
      }),
    ).rejects.toThrow(RangeError);
  });
});

describe('the open-then-save walk', () => {
  it('opens a page at the saved position and saves the position the sweep names, short of the page', async () => {
    const { memory, store, db } = sweepFixture();
    seedRows(memory, { a: {}, b: {}, c: {}, d: {} });
    memory.seed(statePath('beta'), {
      updatedAt: 1,
      deferred: [{ key: 'z', nextAttemptAt: 1, attemptCount: 1 }],
    });
    const page = await openSweepPage({
      store,
      name: 'beta',
      source: firestoreIdSource(db.collection('rows')),
      pageSize: 3,
    });
    expect(page.rows.map((row) => row.key)).toEqual(['a', 'b', 'c']);
    expect(page.reachedEnd).toBe(false);
    await page.save(page.rows[0]?.position ?? undefined, false, 40);
    expect(memory.read(statePath('beta'))).toEqual({
      updatedAt: 40,
      rollingCursor: { state: 'inLap', afterKey: 'a', lapStartedAt: 40 },
      deferred: [{ key: 'z', nextAttemptAt: 1, attemptCount: 1 }],
    });
    const next = await openSweepPage({
      store,
      name: 'beta',
      source: firestoreIdSource(db.collection('rows')),
      pageSize: 3,
    });
    expect(next.rows.map((row) => row.key)).toEqual(['b', 'c', 'd']);
  });

  it('hands out the rows before a value it cannot place, and fails the save after saving them', async () => {
    const { memory, store, db } = sweepFixture();
    seedRows(memory, { a: { at: 1 }, b: { at: 'late' } });
    const page = await openSweepPage({
      store,
      name: 'alpha',
      source: firestoreValueSource(db.collection('rows'), 'at'),
      pageSize: 5,
    });
    expect(page.rows.map((row) => row.key)).toEqual(['a']);
    await expect(page.save({ key: 'a', value: 1 }, false, 7)).rejects.toMatchObject({
      field: 'at',
      key: 'b',
    });
    expect(memory.read(statePath('alpha'))).toMatchObject({
      rollingCursor: { state: 'inLap', afterKey: 'a', afterValue: 1 },
    });
  });

  it('keeps two positions apart when a sweep works them together', async () => {
    const { memory, store, db } = sweepFixture();
    seedRows(memory, { a: {}, b: {}, c: {} });
    const left = await openSweepPage({
      store,
      name: 'alpha',
      source: firestoreIdSource(db.collection('rows')),
      pageSize: 3,
    });
    const right = await openSweepPage({
      store,
      name: 'beta',
      source: firestoreIdSource(db.collection('rows')),
      pageSize: 3,
    });
    await left.save({ key: 'b' }, false, 5);
    await right.save(undefined, true, 6);
    expect(memory.read(statePath('alpha'))).toMatchObject({
      rollingCursor: { state: 'inLap', afterKey: 'b' },
    });
    expect(memory.read(statePath('beta'))).toMatchObject({
      rollingCursor: { state: 'done', lapCompletedAt: 6 },
    });
  });
});
