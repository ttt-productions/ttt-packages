import { describe, it, expect, beforeEach } from 'vitest';
import { AggregateField, FieldPath, Timestamp } from 'firebase-admin/firestore';
import { makeInMemoryFirestore } from '../src/server/testing/in-memory-firestore.js';

const fs = makeInMemoryFirestore();

beforeEach(() => fs.reset());

describe('transactions follow real Firestore semantics', () => {
  it('an update of a missing document fails the commit, and none of its other writes land', async () => {
    await expect(
      fs.db.runTransaction(async (txn) => {
        txn.set(fs.db.doc('probe/written'), { a: 1 });
        txn.update(fs.db.doc('probe/missing'), { a: 1 });
      }),
    ).rejects.toThrow('NOT_FOUND');
    expect(fs.read('probe/written')).toBeUndefined();
  });

  it('a create over an existing document fails the whole commit', async () => {
    fs.seed('probe/existing', { a: 1 });
    await expect(
      fs.db.runTransaction(async (txn) => {
        txn.set(fs.db.doc('probe/other'), { b: 1 });
        txn.create(fs.db.doc('probe/existing'), { a: 2 });
      }),
    ).rejects.toThrow('ALREADY_EXISTS');
    expect(fs.read('probe/existing')).toEqual({ a: 1 });
    expect(fs.read('probe/other')).toBeUndefined();
  });

  it('a transaction whose read changed before its commit re-runs against the fresh state', async () => {
    fs.seed('probe/counter', { n: 1 });
    fs.afterRead('probe/counter', async () => fs.seed('probe/counter', { n: 5 }));
    await fs.db.runTransaction(async (txn) => {
      const snap = await txn.get(fs.db.doc('probe/counter'));
      txn.set(fs.db.doc('probe/counter'), { n: Number(snap.get('n')) + 1 });
    });
    expect(fs.read('probe/counter')).toEqual({ n: 6 });
    expect(fs.transactionAttempts()).toBe(2);
  });

  it('a read after a write in a transaction throws', async () => {
    await expect(
      fs.db.runTransaction(async (txn) => {
        txn.set(fs.db.doc('probe/a'), { a: 1 });
        await txn.get(fs.db.doc('probe/b'));
      }),
    ).rejects.toThrow('all reads to be executed before all writes');
  });
});

describe('failure and observation hooks', () => {
  it('a failed read throws the error it was given, inside and outside a transaction', async () => {
    const failure = new Error('holds unavailable');
    fs.seed('probe/held', { a: 1 });
    fs.failReads((path) => path === 'probe/held', failure);

    await expect(fs.db.doc('probe/held').get()).rejects.toBe(failure);
    await expect(fs.db.runTransaction((txn) => txn.get(fs.db.doc('probe/held')))).rejects.toBe(
      failure,
    );
  });

  it('a failed query throws its error even when the collection holds no documents', async () => {
    const failure = new Error('query failed');
    fs.failQueries((source) => source === 'empty', failure);

    await expect(fs.db.collection('empty').get()).rejects.toBe(failure);
    await expect(fs.db.collection('empty').count().get()).rejects.toBe(failure);
    await expect(fs.db.collection('other').get()).resolves.toMatchObject({ empty: true });
  });

  it('every executed query is recorded with its source and limit', async () => {
    await fs.db.collection('a').limit(3).get();
    await fs.db.collectionGroup('b').get();

    expect(fs.queries()).toEqual([
      { source: 'a', group: false, limit: 3, filters: [], orders: [] },
      { source: 'b', group: true, limit: Infinity, filters: [], orders: [] },
    ]);
  });

  it('a failed next transaction rejects without running its body, and the one after runs', async () => {
    const failure = new Error('firestore unavailable');
    fs.failNextTransaction(failure);
    let ran = 0;

    await expect(fs.db.runTransaction(async () => ran++)).rejects.toBe(failure);
    await fs.db.runTransaction(async () => ran++);

    expect(ran).toBe(1);
  });

  it('an after-commit hook runs once, after the write has landed', async () => {
    const seen: Array<Record<string, unknown> | undefined> = [];
    fs.afterCommit(() => {
      seen.push(fs.read('probe/doc'));
    });

    await fs.db.doc('probe/doc').set({ a: 1 });
    await fs.db.doc('probe/doc').set({ a: 2 });

    expect(seen).toEqual([{ a: 1 }]);
  });

  it('an after-commit hook given paths waits for the first commit that touches one of them', async () => {
    const seen: string[] = [];
    fs.afterCommit(
      () => {
        seen.push('watched');
      },
      (path) => path === 'probe/watched',
    );

    await fs.db.doc('probe/other').set({ a: 1 });
    expect(seen).toEqual([]);
    await fs.db.doc('probe/watched').delete();
    expect(seen).toEqual(['watched']);
  });

  it('every committed write is logged in commit order, a failed commit logs nothing', async () => {
    fs.seed('probe/doc', { a: 1 });
    await fs.db.doc('probe/doc').update({ a: 2 });
    await expect(fs.db.doc('probe/missing').update({ a: 1 })).rejects.toThrow('NOT_FOUND');
    await fs.db.doc('probe/doc').delete();

    expect(fs.writes()).toEqual([
      { kind: 'update', path: 'probe/doc', data: { a: 2 } },
      { kind: 'delete', path: 'probe/doc' },
    ]);
  });

  it('a before-read hook changes the document the read then returns, and a transaction does not contend on it', async () => {
    fs.seed('probe/doc', { n: 1 });
    fs.beforeRead('probe/doc', () => {});
    fs.beforeRead('probe/doc', () => fs.seed('probe/doc', { n: 2 }));
    await expect(fs.db.doc('probe/doc').get()).resolves.toMatchObject({ exists: true });
    const seen = await fs.db.runTransaction(async (txn) => {
      const n: unknown = (await txn.get(fs.db.doc('probe/doc'))).get('n');
      txn.set(fs.db.doc('probe/doc'), { n: Number(n) + 1 });
      return n;
    });
    expect(seen).toBe(2);
    expect(fs.read('probe/doc')).toEqual({ n: 3 });
    expect(fs.transactionAttempts()).toBe(1);
  });

  it('reset clears the documents and every hook', async () => {
    fs.seed('probe/doc', { a: 1 });
    fs.failReads(() => true);
    fs.reset();

    await expect(fs.db.doc('probe/doc').get()).resolves.toMatchObject({ exists: false });
    expect(fs.queries()).toEqual([]);
    expect(fs.transactionAttempts()).toBe(0);
  });
});

describe('aggregate queries follow real Firestore semantics', () => {
  it('counts the matches, and sums and averages only their numeric values', async () => {
    fs.seed('orders/a', { amount: 3, open: true });
    fs.seed('orders/b', { amount: 5, open: true });
    fs.seed('orders/c', { amount: 'n/a', open: true });
    fs.seed('orders/d', { amount: 100, open: false });
    const snap = await fs.db
      .collection('orders')
      .where('open', '==', true)
      .aggregate({
        matches: AggregateField.count(),
        total: AggregateField.sum('amount'),
        mean: AggregateField.average('amount'),
      })
      .get();
    expect(snap.data()).toEqual({ matches: 3, total: 8, mean: 4 });
  });

  it('a sum over no numeric values is 0 and an average is null', async () => {
    const snap = await fs.db
      .collection('empty')
      .aggregate({ total: AggregateField.sum('amount'), mean: AggregateField.average('amount') })
      .get();
    expect(snap.data()).toEqual({ total: 0, mean: null });
  });

  it('an aggregate read inside a transaction sees the stored documents', async () => {
    fs.seed('orders/a', { amount: 2 });
    fs.seed('orders/b', { amount: 7 });
    const total = await fs.db.runTransaction(async (txn) => {
      const snap = await txn.get(
        fs.db.collection('orders').aggregate({ total: AggregateField.sum('amount') }),
      );
      return snap.data().total;
    });
    expect(total).toBe(9);
  });
});

describe('document-id filters follow real Firestore semantics', () => {
  it('a collection query resolves bare ids and references against its own collection', async () => {
    fs.seed('cases/a', { n: 1 });
    fs.seed('cases/b', { n: 2 });
    fs.seed('cases/c', { n: 3 });
    fs.seed('other/a', { n: 9 });
    const byIds = await fs.db
      .collection('cases')
      .where(FieldPath.documentId(), 'in', ['a', fs.db.doc('cases/c')])
      .get();
    expect(byIds.docs.map((d) => d.ref.path).sort()).toEqual(['cases/a', 'cases/c']);
  });
});

describe('stored Timestamps follow real Firestore semantics', () => {
  it('a Timestamp written by set, merge-set, or update reads back as a Timestamp', async () => {
    const at = Timestamp.fromMillis(1_700_000_000_000);
    await fs.db.doc('jobs/set').set({ expireAt: at });
    await fs.db.doc('jobs/merge').set({ nested: { expireAt: at } }, { merge: true });
    fs.seed('jobs/update', { status: 'open' });
    await fs.db.doc('jobs/update').update({ expireAt: at });

    for (const read of [
      fs.read('jobs/set')?.expireAt,
      (fs.read('jobs/merge')?.nested as { expireAt?: unknown } | undefined)?.expireAt,
      (await fs.db.doc('jobs/update').get()).get('expireAt'),
    ]) {
      expect(read).toBeInstanceOf(Timestamp);
      expect((read as Timestamp).toMillis()).toBe(1_700_000_000_000);
    }
  });

  it('a query orders and ranges over Timestamps by their time', async () => {
    fs.seed('jobs/late', { at: Timestamp.fromMillis(3_000) });
    fs.seed('jobs/early', { at: Timestamp.fromMillis(1_000) });
    fs.seed('jobs/mid', { at: Timestamp.fromMillis(2_000) });

    const snap = await fs.db
      .collection('jobs')
      .where('at', '>', Timestamp.fromMillis(1_000))
      .orderBy('at')
      .get();

    expect(snap.docs.map((d) => d.id)).toEqual(['mid', 'late']);
  });
});

describe('the query log', () => {
  it('records each executed query with its filters and sort order', async () => {
    await fs.db
      .collection('jobs')
      .where('caseId', 'in', ['c-1', 'c-2'])
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    expect(fs.queries()).toEqual([
      {
        source: 'jobs',
        group: false,
        limit: 5,
        filters: [{ field: 'caseId', op: 'in', value: ['c-1', 'c-2'] }],
        orders: [{ field: 'createdAt', direction: 'desc' }],
      },
    ]);
  });
});

describe('update times and delete preconditions follow real Firestore semantics', () => {
  it('a document read back has the update time of its last write, and a rewrite moves it', async () => {
    fs.seed('queue/a', { n: 1 });
    const first = (await fs.db.collection('queue').get()).docs[0].updateTime;
    await fs.db.doc('queue/a').update({ n: 2 });
    const second = (await fs.db.doc('queue/a').get()).updateTime;

    expect(first).toBeInstanceOf(Timestamp);
    expect(second?.isEqual(first)).toBe(false);
    expect((await fs.db.doc('queue/missing').get()).updateTime).toBeUndefined();
  });

  it('a delete guarded by the read update time removes an unchanged document', async () => {
    fs.seed('queue/a', { n: 1 });
    const [doc] = (await fs.db.collection('queue').get()).docs;

    await doc.ref.delete({ lastUpdateTime: doc.updateTime });

    expect(fs.read('queue/a')).toBeUndefined();
  });

  it('a delete guarded by a stale update time fails FAILED_PRECONDITION and keeps the rewrite', async () => {
    fs.seed('queue/a', { n: 1 });
    const [doc] = (await fs.db.collection('queue').get()).docs;
    await fs.db.doc('queue/a').update({ n: 2 });

    await expect(doc.ref.delete({ lastUpdateTime: doc.updateTime })).rejects.toMatchObject({
      code: 9,
    });
    expect(fs.read('queue/a')).toEqual({ n: 2 });
  });
});
