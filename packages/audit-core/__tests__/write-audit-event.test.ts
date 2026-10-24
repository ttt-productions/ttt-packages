import { describe, it, expect, vi } from 'vitest';
import { createAuditWriter } from '../src/server/write-audit-event.js';
import type {
  ServerCollectionRef,
  ServerDocRef,
  ServerFirestore,
  ServerTransaction,
  ServerWriteBatch,
} from '@ttt-productions/firebase-helpers/server';

const notInFake = (what: string) => (): never => {
  throw new Error(`${what} is not part of this fake`);
};

function makeMockDb() {
  const set = vi.fn<ServerDocRef['set']>().mockResolvedValue(undefined);
  const doc = vi.fn((id?: string): ServerDocRef => ({
    id: id ?? 'auto',
    set,
    update: notInFake('update'),
    create: notInFake('create'),
    delete: notInFake('delete'),
    get: notInFake('get'),
  }));
  const collection = vi.fn((): ServerCollectionRef => ({
    doc,
    add: notInFake('add'),
    where: notInFake('where'),
    orderBy: notInFake('orderBy'),
    limit: notInFake('limit'),
  }));
  const db: ServerFirestore = {
    collection,
    doc: notInFake('doc'),
    batch: notInFake('batch'),
    runTransaction: notInFake('runTransaction'),
  };
  return { db, collection, doc, set };
}

function makeBatch(set: ServerWriteBatch['set']): ServerWriteBatch {
  return {
    set,
    update: notInFake('update'),
    delete: notInFake('delete'),
    commit: notInFake('commit'),
  };
}

function makeTransaction(set: ServerTransaction['set']): ServerTransaction {
  return { get: notInFake('get'), set, update: notInFake('update'), delete: notInFake('delete') };
}

describe('createAuditWriter', () => {
  it('writes audit event and returns the generated id', async () => {
    const { db, collection, doc, set } = makeMockDb();
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

  it('fills every field the caller omits with its default', async () => {
    const { db, set } = makeMockDb();
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
    const { db } = makeMockDb();
    const batchSet = vi.fn<ServerWriteBatch['set']>();
    const batch = makeBatch(batchSet);
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
    const { db } = makeMockDb();
    const txSet = vi.fn<ServerTransaction['set']>();
    const transaction = makeTransaction(txSet);
    const { writeAuditEvent } = createAuditWriter({
      db,
      collectionPath: 'events',
      idGenerator: () => 'test-id-4',
    });

    await writeAuditEvent({ type: 'e.f', actor: 'u3', transaction });

    expect(txSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'e.f' }));
  });

  it('throws when both batch and transaction are provided', async () => {
    const { db } = makeMockDb();
    const { writeAuditEvent } = createAuditWriter({ db, collectionPath: 'events' });
    const batch = makeBatch(vi.fn<ServerWriteBatch['set']>());
    const transaction = makeTransaction(vi.fn<ServerTransaction['set']>());

    await expect(writeAuditEvent({ type: 'x.y', actor: 'u4', batch, transaction })).rejects.toThrow(
      'writeAuditEvent: pass either batch or transaction, not both.',
    );
  });

  it('rejects an event type outside the TEventType union at compile time', async () => {
    const { db } = makeMockDb();
    const { writeAuditEvent } = createAuditWriter<'a' | 'b'>({
      db,
      collectionPath: 'events',
      idGenerator: () => 'id',
    });

    // @ts-expect-error — 'c' is not assignable to type '"a" | "b"'
    await writeAuditEvent({ type: 'c', actor: 'u5' });
  });
});
