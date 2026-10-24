import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { createPendingMediaSchemas } from '@ttt-productions/media-schemas';
import {
  claimPendingMediaForProcessing,
  finalizePendingMedia,
  finalizePendingMediaInTransaction,
  finalizeUnparsablePendingMedia,
  type PendingMediaExtraWrites,
} from '../src/server/pending-media.js';
import type {
  ServerDocRef,
  ServerDocSnapshot,
  ServerFirestore,
  ServerQuery,
  ServerQuerySnapshot,
  ServerTransaction,
} from '@ttt-productions/firebase-helpers/server';

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

const notInFake = (what: string) => (): never => {
  throw new Error(`${what} is not part of this fake`);
};

const ref: ServerDocRef = {
  id: 'doc-1',
  set: notInFake('set'),
  update: notInFake('update'),
  create: notInFake('create'),
  delete: notInFake('delete'),
  get: notInFake('get'),
};

type Row = Record<string, unknown> | null;

function makeTxn(row: Row) {
  const calls: string[] = [];
  function read(target: ServerDocRef): Promise<ServerDocSnapshot>;
  function read(target: ServerQuery): Promise<ServerQuerySnapshot>;
  function read(): Promise<ServerDocSnapshot | ServerQuerySnapshot> {
    calls.push('get');
    return Promise.resolve({ id: ref.id, exists: row != null, data: () => row ?? undefined, ref });
  }
  const update = vi.fn((_ref: ServerDocRef, _data: Record<string, unknown>) => {
    calls.push('update');
    return transaction;
  });
  const transaction: ServerTransaction = {
    get: read,
    set: notInFake('set'),
    update,
    delete: notInFake('delete'),
  };
  return { transaction, update, calls };
}

function dbRunning(transaction: ServerTransaction) {
  const runs = { count: 0 };
  const db: ServerFirestore = {
    collection: notInFake('collection'),
    doc: notInFake('doc'),
    batch: notInFake('batch'),
    runTransaction: (fn) => {
      runs.count += 1;
      return fn(transaction);
    },
  };
  return { db, runs };
}

describe('claimPendingMediaForProcessing (transactional wrapper)', () => {
  const claim = (row: Row) => {
    const t = makeTxn(row);
    return {
      ...t,
      run: () =>
        claimPendingMediaForProcessing(t.transaction, ref, {
          schema: PendingMediaSchema,
          policy: POLICY,
          now: NOW,
        }),
    };
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
    const res = await finalizePendingMediaInTransaction(transaction, ref, 'completed', {
      extraFields: { result: 1 },
      now: 9,
    });
    expect(res).toEqual({ decision: 'applied' });
    expect(update).toHaveBeenCalledWith(
      ref,
      expect.objectContaining({ status: 'completed', completedAt: 9, terminalAt: 9, result: 1 }),
    );
  });

  it('noop: the same terminal status is an idempotent replay and writes nothing', async () => {
    const { transaction, update } = makeTxn({ status: 'completed' });
    expect(await finalizePendingMediaInTransaction(transaction, ref, 'completed')).toEqual({
      decision: 'noop',
      currentStatus: 'completed',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('conflict: never writes', async () => {
    const { transaction, update } = makeTxn({ status: 'failed' });
    expect(await finalizePendingMediaInTransaction(transaction, ref, 'completed')).toEqual({
      decision: 'conflict',
      currentStatus: 'failed',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('missing: never writes', async () => {
    const { transaction, update } = makeTxn(null);
    expect(await finalizePendingMediaInTransaction(transaction, ref, 'failed')).toEqual({
      decision: 'missing',
    });
    expect(update).not.toHaveBeenCalled();
  });

  describe('caller-supplied extra writes', () => {
    it('prepare in the READ phase, apply after the terminal write, and surface the result', async () => {
      const { transaction, calls } = makeTxn({ status: 'processing' });
      const extraWrites = vi.fn<PendingMediaExtraWrites<{ releasedBytes: number }>>(async (tx) => {
        await tx.get(ref);
        calls.push('prepare');
        return () => {
          calls.push('apply');
          return { releasedBytes: 42 };
        };
      });

      const res = await finalizePendingMediaInTransaction(transaction, ref, 'failed', {
        extraWrites,
        now: 5,
      });

      expect(res).toEqual({ decision: 'applied', extra: { releasedBytes: 42 } });
      expect(calls).toEqual(['get', 'get', 'prepare', 'update', 'apply']);
      expect(extraWrites.mock.calls[0][2]).toEqual({ targetStatus: 'failed', unparsable: false });
    });

    it('a prepare that finds nothing to write leaves only the terminal write', async () => {
      const { transaction, update } = makeTxn({ status: 'pending' });
      const res = await finalizePendingMediaInTransaction(transaction, ref, 'failed', {
        extraWrites: async () => undefined,
      });
      expect(res).toEqual({ decision: 'applied' });
      expect(update).toHaveBeenCalledTimes(1);
    });

    it.each([['completed'], ['rejected']])(
      'never runs on a row already %s (exactly once)',
      async (status) => {
        const { transaction } = makeTxn({ status });
        const extraWrites = vi.fn(async () => () => 'x');
        await finalizePendingMediaInTransaction(transaction, ref, 'failed', { extraWrites });
        expect(extraWrites).not.toHaveBeenCalled();
      },
    );
  });
});

describe('finalizePendingMedia (standalone)', () => {
  it('runs its own transaction and applies the terminal write', async () => {
    const { transaction, update } = makeTxn({ status: 'pending' });
    const { db, runs } = dbRunning(transaction);
    const res = await finalizePendingMedia(db, ref, 'failed', {
      extraFields: { errorCategory: 'system' },
    });
    expect(res).toEqual({ decision: 'applied' });
    expect(runs.count).toBe(1);
    expect(update).toHaveBeenCalledWith(
      ref,
      expect.objectContaining({ status: 'failed', errorCategory: 'system' }),
    );
  });
});

describe('finalizeUnparsablePendingMedia', () => {
  const runWith = (row: Row, extraWrites?: PendingMediaExtraWrites<unknown>) => {
    const t = makeTxn(row);
    const { db } = dbRunning(t.transaction);
    return {
      ...t,
      done: finalizeUnparsablePendingMedia(db, ref, {
        extraFields: { errorCategory: 'validation' },
        extraWrites,
        now: 3,
      }),
    };
  };

  it.each([[{}], [{ status: 'pending' }], [{ status: 'processing' }]])(
    'fails a row with no or a non-terminal status (%j)',
    async (row) => {
      const { done, update } = runWith(row);
      await done;
      expect(update).toHaveBeenCalledWith(
        ref,
        expect.objectContaining({ status: 'failed', failedAt: 3, errorCategory: 'validation' }),
      );
    },
  );

  it.each([[{ status: 'completed' }], [{ status: 'unknown-value' }], [null]])(
    'leaves %j untouched',
    async (row) => {
      const { done, update } = runWith(row);
      await done;
      expect(update).not.toHaveBeenCalled();
    },
  );

  it('runs the extra writes flagged as unparsable', async () => {
    const apply = vi.fn();
    const extraWrites = vi.fn<PendingMediaExtraWrites<unknown>>(async () => apply);
    const { done } = runWith({ status: 'pending' }, extraWrites);
    await done;
    expect(extraWrites.mock.calls[0][2]).toEqual({ targetStatus: 'failed', unparsable: true });
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
