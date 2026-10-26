import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  commit: vi.fn<() => Promise<void>>(async () => undefined),
}));

// A real write batch records its writes locally; only its commit would reach a server.
vi.mock(import('firebase/firestore'), async (importOriginal) => {
  const { passThroughModule } = await import('@ttt-productions/dev-standards/testing');
  const actual = await importOriginal();
  return passThroughModule(importOriginal, {
    writeBatch: (firestore) => {
      const batch = actual.writeBatch(firestore);
      batch.commit = h.commit;
      return batch;
    },
  });
});

import { doc, getFirestore } from 'firebase/firestore';
import { commitInBatches } from '../src/firestore-client/batch.js';

// The real app SDK, though the shared test setup mocks 'firebase/app'.
const { initializeApp } = await vi.importActual<typeof import('firebase/app')>('firebase/app');
const db = getFirestore(initializeApp({ projectId: 'demo-batch' }, 'commit-in-batches'));
const write = (batch: import('firebase/firestore').WriteBatch, item: number | string) => {
  batch.set(doc(db, 'items', String(item)), { item });
};

beforeEach(() => {
  h.commit.mockReset();
  h.commit.mockResolvedValue(undefined);
});

describe('commitInBatches', () => {
  it('returns success for empty items array', async () => {
    const apply = vi.fn(write);
    const result = await commitInBatches(db, [], { apply });
    expect(result.success).toBe(true);
    expect(result.totalOps).toBe(0);
    expect(result.committedOps).toBe(0);
    expect(result.totalBatches).toBe(0);
    expect(result.committedBatches).toBe(0);
    expect(apply).not.toHaveBeenCalled();
  });

  it('commits a single batch for small item sets', async () => {
    const apply = vi.fn(write);
    const result = await commitInBatches(db, [1, 2, 3], { apply });
    expect(result.success).toBe(true);
    expect(result.totalOps).toBe(3);
    expect(result.committedOps).toBe(3);
    expect(result.totalBatches).toBe(1);
    expect(result.committedBatches).toBe(1);
    expect(apply).toHaveBeenCalledTimes(3);
    expect(h.commit).toHaveBeenCalledTimes(1);
  });

  it('calls commit for each batch group', async () => {
    const items = Array.from({ length: 5 }, (_, i) => i);
    const result = await commitInBatches(db, items, { batchSize: 2, apply: write });
    expect(result.totalBatches).toBe(3);
    expect(result.committedBatches).toBe(3);
    expect(result.totalOps).toBe(5);
    expect(result.committedOps).toBe(5);
    expect(h.commit).toHaveBeenCalledTimes(3);
  });

  it('applies all items with the apply function', async () => {
    const applied: string[] = [];
    await commitInBatches(db, ['a', 'b', 'c'], {
      apply: (batch, item) => {
        write(batch, item);
        applied.push(item);
      },
    });
    expect(applied).toEqual(['a', 'b', 'c']);
  });

  it('returns success:false and partial counts when commit fails', async () => {
    h.commit.mockResolvedValueOnce(undefined).mockRejectedValue(new Error('Firestore error'));
    const items = Array.from({ length: 6 }, (_, i) => i);
    const result = await commitInBatches(db, items, { batchSize: 2, apply: write });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.committedBatches).toBe(1);
    expect(result.committedOps).toBe(2);
    expect(result.totalOps).toBe(6);
  });

  it('uses default batchSize of 450', async () => {
    const items = Array.from({ length: 450 }, (_, i) => i);
    const result = await commitInBatches(db, items, { apply: write });
    expect(result.totalBatches).toBe(1);
    expect(result.committedBatches).toBe(1);
    expect(h.commit).toHaveBeenCalledTimes(1);
  });

  it('supports async apply function', async () => {
    const apply = vi.fn(async (batch: import('firebase/firestore').WriteBatch, item: number) => {
      await Promise.resolve();
      write(batch, item);
    });
    const result = await commitInBatches(db, [1, 2], { apply });
    expect(result.success).toBe(true);
    expect(apply).toHaveBeenCalledTimes(2);
  });
});
