import { describe, it, expect, vi, beforeEach } from 'vitest';
import { commitInBatches } from '../src/firestore/batch';
import { writeBatch } from 'firebase/firestore';

// writeBatch is mocked in test/setup.ts globally

describe('commitInBatches', () => {
  let mockBatch: {
    set: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    commit: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockBatch = {
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };
    (writeBatch as ReturnType<typeof vi.fn>).mockReturnValue(mockBatch);
  });

  it('returns success for empty items array', async () => {
    const db = {} as any;
    const apply = vi.fn();
    const result = await commitInBatches(db, [], { apply });
    expect(result.success).toBe(true);
    expect(result.totalOps).toBe(0);
    expect(result.committedOps).toBe(0);
    expect(result.totalBatches).toBe(0);
    expect(result.committedBatches).toBe(0);
    expect(apply).not.toHaveBeenCalled();
  });

  it('commits a single batch for small item sets', async () => {
    const db = {} as any;
    const items = [1, 2, 3];
    const apply = vi.fn();
    const result = await commitInBatches(db, items, { apply });
    expect(result.success).toBe(true);
    expect(result.totalOps).toBe(3);
    expect(result.committedOps).toBe(3);
    expect(result.totalBatches).toBe(1);
    expect(result.committedBatches).toBe(1);
    expect(apply).toHaveBeenCalledTimes(3);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('calls commit for each batch group', async () => {
    const db = {} as any;
    const items = Array.from({ length: 5 }, (_, i) => i);
    const apply = vi.fn();
    const result = await commitInBatches(db, items, { batchSize: 2, apply });
    // 5 items / 2 per batch = 3 batches (2+2+1)
    expect(result.totalBatches).toBe(3);
    expect(result.committedBatches).toBe(3);
    expect(result.totalOps).toBe(5);
    expect(result.committedOps).toBe(5);
    expect(mockBatch.commit).toHaveBeenCalledTimes(3);
  });

  it('applies all items with the apply function', async () => {
    const db = {} as any;
    const items = ['a', 'b', 'c'];
    const applied: string[] = [];
    await commitInBatches(db, items, {
      apply: (_, item) => { applied.push(item); },
    });
    expect(applied).toEqual(['a', 'b', 'c']);
  });

  it('returns success:false and partial counts when commit fails', async () => {
    const db = {} as any;
    let callCount = 0;
    (writeBatch as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn(async () => {
        callCount++;
        if (callCount >= 2) throw new Error('Firestore error');
      }),
    }));

    const items = Array.from({ length: 6 }, (_, i) => i);
    const apply = vi.fn();
    const result = await commitInBatches(db, items, { batchSize: 2, apply });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    // First batch committed, second failed
    expect(result.committedBatches).toBe(1);
    expect(result.committedOps).toBe(2);
    expect(result.totalOps).toBe(6);
  });

  it('uses default batchSize of 450', async () => {
    const db = {} as any;
    const items = Array.from({ length: 450 }, (_, i) => i);
    const apply = vi.fn();
    const result = await commitInBatches(db, items, { apply });
    expect(result.totalBatches).toBe(1);
    expect(result.committedBatches).toBe(1);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('supports async apply function', async () => {
    const db = {} as any;
    const items = [1, 2];
    const apply = vi.fn(async () => { /* async */ });
    const result = await commitInBatches(db, items, { apply });
    expect(result.success).toBe(true);
    expect(apply).toHaveBeenCalledTimes(2);
  });
});
