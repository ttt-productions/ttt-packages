import { describe, expect, it } from 'vitest';
import { statePath, sweepFixture } from './helpers.js';

const CURSOR = { state: 'inLap', afterKey: 'k9', lapStartedAt: 100 } as const;
const LAP = { pageToken: 'tok', lapStartedAt: 50 };
const ROW = { key: 'r1', nextAttemptAt: 300, attemptCount: 2 };

function seededFixture() {
  const fixture = sweepFixture();
  fixture.memory.seed(statePath('alpha'), {
    updatedAt: 10,
    fullScanLastRunAt: 40,
    fullScanLap: LAP,
    rollingCursor: CURSOR,
    deferred: [ROW],
  });
  return fixture;
}

describe('the saved-position reader', () => {
  it('reads a sweep that never ran as nothing saved', async () => {
    const { store } = sweepFixture();
    await expect(store.read('beta')).resolves.toBeUndefined();
  });

  it('refuses a stored position that breaks the schema', async () => {
    const { memory, store } = sweepFixture();
    memory.seed(statePath('alpha'), { updatedAt: 1.5 });
    await expect(store.read('alpha')).rejects.toThrow();
  });
});

describe('the saved-position writer never drops another part', () => {
  it('keeps the retry list, the Auth lap and the last full scan when the cursor moves', async () => {
    const { memory, store } = seededFixture();
    const cursor = { state: 'inLap', afterKey: 'k12', lapStartedAt: 100 } as const;
    await store.update('alpha', { rollingCursor: cursor }, 500);
    expect(memory.read(statePath('alpha'))).toEqual({
      updatedAt: 500,
      fullScanLastRunAt: 40,
      fullScanLap: LAP,
      rollingCursor: cursor,
      deferred: [ROW],
    });
  });

  it('keeps the cursor and the Auth lap when the retry list changes', async () => {
    const { memory, store } = seededFixture();
    await store.update('alpha', { deferred: [] }, 500);
    expect(memory.read(statePath('alpha'))).toEqual({
      updatedAt: 500,
      fullScanLastRunAt: 40,
      fullScanLap: LAP,
      rollingCursor: CURSOR,
    });
  });

  it('keeps the cursor and the retry list when the Auth lap ends', async () => {
    const { memory, store } = seededFixture();
    await store.update('alpha', { fullScanLap: null, fullScanLastRunAt: 500 }, 500);
    expect(memory.read(statePath('alpha'))).toEqual({
      updatedAt: 500,
      fullScanLastRunAt: 500,
      rollingCursor: CURSOR,
      deferred: [ROW],
    });
  });

  it('writes nothing when the change breaks the schema', async () => {
    const { memory, store } = seededFixture();
    await expect(store.update('alpha', { fullScanLastRunAt: -1 }, 500)).rejects.toThrow();
    expect(memory.read(statePath('alpha'))).toMatchObject({ updatedAt: 10 });
  });
});
