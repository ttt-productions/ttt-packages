import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { createPendingMediaSchemas } from '@ttt-productions/media-schemas';
import {
  claimPendingMediaForProcessing,
  finalizePendingMedia,
  finalizePendingMediaInTransaction,
  finalizeUnparsablePendingMedia,
} from '../src/server/pending-media.js';

const NOW = 1_700_000_000_000;
const POLICY = { leaseMs: 12 * 60 * 1000, maxAttempts: 2 };

const { PendingMediaSchema } = createPendingMediaSchemas({
  fileOriginSchema: z.enum(['avatar']),
  domainEventSchema: z.object({ type: z.literal('test.event') }).strict(),
});

const rawBase = {
  id: 'doc-1',
  userId: 'user-1',
  fileOrigin: 'avatar',
  originalFileName: 'photo.jpg',
  pendingStoragePath: 'uploads/avatar/user-1/doc-1',
  clientContext: { surface: 'profile' },
  createdAt: NOW - 1_000,
  updatedAt: NOW - 1_000,
};

const ref = { id: 'doc-1' } as never;

/** A transaction whose `get` returns a row (null = no row), recording every call in order. */
function makeTxn(row: unknown | null) {
  const calls: string[] = [];
  const get = vi.fn(async () => {
    calls.push('get');
    return { exists: row != null, data: () => row ?? undefined };
  });
  const update = vi.fn(() => {
    calls.push('update');
  });
  return { transaction: { get, update } as never, get, update, calls };
}

describe('claimPendingMediaForProcessing (transactional wrapper)', () => {
  const claim = (row: unknown | null) => {
    const t = makeTxn(row);
    return { ...t, run: () => claimPendingMediaForProcessing(t.transaction, ref, { schema: PendingMediaSchema, policy: POLICY, now: NOW }) };
  };

  it('returns missing (no write) when the row does not exist', async () => {
    const { run, update } = claim(null);
    expect(await run()).toEqual({ kind: 'missing' });
    expect(update).not.toHaveBeenCalled();
  });

  it('returns missing (no write) when the current row no longer parses', async () => {
    const { run, update } = claim({ id: 'doc-1', status: 'processing' });
    expect(await run()).toEqual({ kind: 'missing' });
    expect(update).not.toHaveBeenCalled();
  });

  it('claims a pending row and writes the exact claim payload in the transaction', async () => {
    const { run, update } = claim({ ...rawBase, status: 'pending' });
    expect((await run()).kind).toBe('claimed');
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(ref, {
      status: 'processing',
      processingAttemptCount: 1,
      processingStartedAt: NOW,
      processingLeaseExpiresAt: NOW + POLICY.leaseMs,
      updatedAt: NOW,
    });
  });

  it('performs no write for a busy row', async () => {
    const { run, update } = claim({
      ...rawBase,
      status: 'processing',
      processingStartedAt: NOW - 1_000,
      processingAttemptCount: 1,
      processingLeaseExpiresAt: NOW + 60_000,
    });
    expect((await run()).kind).toBe('busy');
    expect(update).not.toHaveBeenCalled();
  });
});

describe('finalizePendingMediaInTransaction', () => {
  it('applied: re-reads, then writes the terminal fields', async () => {
    const { transaction, update } = makeTxn({ status: 'processing' });
    const res = await finalizePendingMediaInTransaction(transaction, ref, 'completed', { extraFields: { result: 1 }, now: 9 });
    expect(res).toEqual({ decision: 'applied' });
    expect(update).toHaveBeenCalledWith(ref, expect.objectContaining({ status: 'completed', completedAt: 9, terminalAt: 9, result: 1 }));
  });

  it('noop: the same terminal status is an idempotent replay and writes nothing', async () => {
    const { transaction, update } = makeTxn({ status: 'completed' });
    expect(await finalizePendingMediaInTransaction(transaction, ref, 'completed')).toEqual({ decision: 'noop', currentStatus: 'completed' });
    expect(update).not.toHaveBeenCalled();
  });

  it('conflict: never writes', async () => {
    const { transaction, update } = makeTxn({ status: 'failed' });
    expect(await finalizePendingMediaInTransaction(transaction, ref, 'completed')).toEqual({ decision: 'conflict', currentStatus: 'failed' });
    expect(update).not.toHaveBeenCalled();
  });

  it('missing: never writes', async () => {
    const { transaction, update } = makeTxn(null);
    expect(await finalizePendingMediaInTransaction(transaction, ref, 'failed')).toEqual({ decision: 'missing' });
    expect(update).not.toHaveBeenCalled();
  });

  describe('caller-supplied extra writes', () => {
    it('prepare in the READ phase, apply after the terminal write, and surface the result', async () => {
      const { transaction, calls } = makeTxn({ status: 'processing' });
      const extraWrites = vi.fn(async (tx: { get: () => Promise<unknown> }, _snapshot: unknown, _context: unknown) => {
        await tx.get();
        calls.push('prepare');
        return () => {
          calls.push('apply');
          return { releasedBytes: 42 };
        };
      });

      const res = await finalizePendingMediaInTransaction(transaction, ref, 'failed', { extraWrites: extraWrites as never, now: 5 });

      expect(res).toEqual({ decision: 'applied', extra: { releasedBytes: 42 } });
      expect(calls).toEqual(['get', 'get', 'prepare', 'update', 'apply']);
      expect(extraWrites.mock.calls[0][2]).toEqual({ targetStatus: 'failed', unparsable: false });
    });

    it('a prepare that finds nothing to write leaves only the terminal write', async () => {
      const { transaction, update } = makeTxn({ status: 'pending' });
      const res = await finalizePendingMediaInTransaction(transaction, ref, 'failed', { extraWrites: async () => undefined });
      expect(res).toEqual({ decision: 'applied' });
      expect(update).toHaveBeenCalledTimes(1);
    });

    it.each([['completed'], ['rejected']])('never runs on a row already %s (exactly once)', async (status) => {
      const { transaction } = makeTxn({ status });
      const extraWrites = vi.fn(async () => () => 'x');
      await finalizePendingMediaInTransaction(transaction, ref, 'failed', { extraWrites });
      expect(extraWrites).not.toHaveBeenCalled();
    });
  });
});

describe('finalizePendingMedia (standalone)', () => {
  it('runs its own transaction and applies the terminal write', async () => {
    const { transaction, update } = makeTxn({ status: 'pending' });
    const db = { runTransaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(transaction)) };
    const res = await finalizePendingMedia(db as never, ref, 'failed', { extraFields: { errorCategory: 'system' } });
    expect(res).toEqual({ decision: 'applied' });
    expect(db.runTransaction).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(ref, expect.objectContaining({ status: 'failed', errorCategory: 'system' }));
  });
});

describe('finalizeUnparsablePendingMedia', () => {
  const runWith = (row: unknown | null, extraWrites?: never) => {
    const t = makeTxn(row);
    const db = { runTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(t.transaction)) };
    return { ...t, done: finalizeUnparsablePendingMedia(db as never, ref, { extraFields: { errorCategory: 'validation' }, extraWrites, now: 3 }) };
  };

  it.each([[{}], [{ status: 'pending' }], [{ status: 'processing' }]])('fails a row with no or a non-terminal status (%j)', async (row) => {
    const { done, update } = runWith(row);
    await done;
    expect(update).toHaveBeenCalledWith(ref, expect.objectContaining({ status: 'failed', failedAt: 3, errorCategory: 'validation' }));
  });

  it.each([[{ status: 'completed' }], [{ status: 'unknown-value' }], [null]])('leaves %j untouched', async (row) => {
    const { done, update } = runWith(row);
    await done;
    expect(update).not.toHaveBeenCalled();
  });

  it('runs the extra writes flagged as unparsable', async () => {
    const apply = vi.fn();
    const extraWrites = vi.fn(async (_tx: unknown, _snapshot: unknown, _context: unknown) => apply);
    const { done } = runWith({ status: 'pending' }, extraWrites as never);
    await done;
    expect(extraWrites.mock.calls[0][2]).toEqual({ targetStatus: 'failed', unparsable: true });
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
