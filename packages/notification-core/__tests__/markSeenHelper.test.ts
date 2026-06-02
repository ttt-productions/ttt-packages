import { describe, it, expect, vi } from 'vitest';
import { markSeenHelper } from '../src/server/markSeenHelper';
import type { ServerFirestore, ServerDocRef } from '../src/server/types';

// A db mock that tracks every batch.update and batch.commit across chunks.
function createBatchTrackingDb() {
  const updateCalls: Array<{ ref: ServerDocRef; data: Record<string, unknown> }> = [];
  let commits = 0;

  const db: ServerFirestore = {
    collection: vi.fn(),
    doc: vi.fn(),
    batch: vi.fn(() => ({
      set: vi.fn(() => ({} as any)),
      update: vi.fn((ref: ServerDocRef, data: Record<string, unknown>) => {
        updateCalls.push({ ref, data });
        return {} as any;
      }),
      delete: vi.fn(() => ({} as any)),
      commit: vi.fn(async () => { commits++; }),
    })),
  };

  return { db, updateCalls, commitCount: () => commits };
}

function makeRef(id: string): ServerDocRef {
  return {
    id,
    set: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    get: vi.fn(),
  } as unknown as ServerDocRef;
}

describe('markSeenHelper', () => {
  it('stamps seenAt on every supplied ref', async () => {
    const { db, updateCalls } = createBatchTrackingDb();
    const refs = [makeRef('a'), makeRef('b'), makeRef('c')];

    const result = await markSeenHelper(db, refs, 123);

    expect(result).toEqual({ updated: 3 });
    expect(updateCalls).toHaveLength(3);
    updateCalls.forEach((call) => expect(call.data).toEqual({ seenAt: 123 }));
  });

  it('chunks updates at ≤500 per commit', async () => {
    const { db, updateCalls, commitCount } = createBatchTrackingDb();
    const refs = Array.from({ length: 1001 }, (_v, i) => makeRef(`r${i}`));

    const result = await markSeenHelper(db, refs, 1);

    expect(result.updated).toBe(1001);
    expect(updateCalls).toHaveLength(1001);
    // 1001 refs → three commits (500 + 500 + 1).
    expect(commitCount()).toBe(3);
  });

  it('does nothing for an empty ref array', async () => {
    const { db, updateCalls, commitCount } = createBatchTrackingDb();

    const result = await markSeenHelper(db, [], 1);

    expect(result).toEqual({ updated: 0 });
    expect(updateCalls).toHaveLength(0);
    expect(commitCount()).toBe(0);
  });
});
