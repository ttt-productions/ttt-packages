import { describe, it, expect, vi } from 'vitest';
import { createAuditWriter } from '../src/server/write-audit-event.js';
import type { Firestore, WriteBatch, Transaction } from 'firebase-admin/firestore';

function makeMockDb(collectionPath: string) {
  const set = vi.fn().mockResolvedValue(undefined);
  const doc = vi.fn(() => ({ set }));
  const collection = vi.fn(() => ({ doc }));
  const db = { collection } as unknown as Firestore;
  return { db, collection, doc, set };
}

describe('createAuditWriter', () => {
  it('writes audit event and returns the generated id', async () => {
    const { db, collection, doc, set } = makeMockDb('myCollection');
    const { writeAuditEvent } = createAuditWriter({
      db,
      collectionPath: 'myCollection',
      idGenerator: () => 'test-id-1',
    });

    const id = await writeAuditEvent({ type: 'x.y', actor: 'u1' });

    expect(id).toBe('test-id-1');
    expect(collection).toHaveBeenCalledWith('myCollection');
    expect(doc).toHaveBeenCalledWith('test-id-1');
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-id-1', type: 'x.y', actor: 'u1' }),
    );
  });

  it('applies default fields correctly', async () => {
    const { db, set } = makeMockDb('events');
    const { writeAuditEvent } = createAuditWriter({
      db,
      collectionPath: 'events',
      idGenerator: () => 'test-id-2',
    });

    await writeAuditEvent({ type: 'a.b', actor: 'user123' });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'success',
        target: null,
        metadata: {},
        schemaVersion: 1,
        correlationId: null,
        failureReason: null,
        ip: null,
        userAgent: null,
        region: null,
      }),
    );
  });

  it('uses batch.set instead of ref.set when batch is provided', async () => {
    const { db } = makeMockDb('events');
    const batchSet = vi.fn();
    const batch = { set: batchSet } as unknown as WriteBatch;
    const { writeAuditEvent } = createAuditWriter({
      db,
      collectionPath: 'events',
      idGenerator: () => 'test-id-3',
    });

    await writeAuditEvent({ type: 'c.d', actor: 'u2', batch });

    expect(batchSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'c.d' }),
    );
  });

  it('uses transaction.set instead of ref.set when transaction is provided', async () => {
    const { db } = makeMockDb('events');
    const txSet = vi.fn();
    const transaction = { set: txSet } as unknown as Transaction;
    const { writeAuditEvent } = createAuditWriter({
      db,
      collectionPath: 'events',
      idGenerator: () => 'test-id-4',
    });

    await writeAuditEvent({ type: 'e.f', actor: 'u3', transaction });

    expect(txSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'e.f' }),
    );
  });

  it('throws when both batch and transaction are provided', async () => {
    const { db } = makeMockDb('events');
    const { writeAuditEvent } = createAuditWriter({ db, collectionPath: 'events' });
    const batch = { set: vi.fn() } as unknown as WriteBatch;
    const transaction = { set: vi.fn() } as unknown as Transaction;

    await expect(
      writeAuditEvent({ type: 'x.y', actor: 'u4', batch, transaction }),
    ).rejects.toThrow('writeAuditEvent: pass either batch or transaction, not both.');
  });

  it('TEventType generic constraint — @ts-expect-error for invalid type', async () => {
    const { db } = makeMockDb('events');
    const { writeAuditEvent } = createAuditWriter<'a' | 'b'>({ db, collectionPath: 'events', idGenerator: () => 'id' });

    // @ts-expect-error — 'c' is not assignable to type '"a" | "b"'
    await writeAuditEvent({ type: 'c', actor: 'u5' });
  });
});
