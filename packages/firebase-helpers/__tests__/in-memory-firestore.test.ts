import { describe, it, expect, beforeEach } from 'vitest';
import { AggregateField, FieldPath, Filter, Timestamp } from 'firebase-admin/firestore';
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

  it('each before-read hook runs before one read of its path, in the order they were added', async () => {
    fs.seed('probe/doc', { n: 1 });
    fs.beforeRead('probe/doc', () => fs.seed('probe/doc', { n: 2 }));
    fs.beforeRead('probe/doc', () => fs.seed('probe/doc', { n: 3 }));
    expect((await fs.db.doc('probe/doc').get()).get('n')).toBe(2);
    expect((await fs.db.doc('probe/doc').get()).get('n')).toBe(3);
    expect((await fs.db.doc('probe/doc').get()).get('n')).toBe(3);
  });

  it('a before-read hook changes the document a transaction then reads, and the transaction does not contend on it', async () => {
    fs.seed('probe/doc', { n: 1 });
    fs.beforeRead('probe/doc', () => fs.seed('probe/doc', { n: 2 }));
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

const ids = (snap: { docs: Array<{ id: string }> }) => snap.docs.map((d) => d.id);

describe('filters follow real Firestore semantics', () => {
  beforeEach(() => {
    fs.seed('items/num1', { n: 1, tags: ['a', 'b'] });
    fs.seed('items/num5', { n: 5, tags: ['c'] });
    fs.seed('items/text', { n: 'x', tags: 'a' });
    fs.seed('items/nil', { n: null });
    fs.seed('items/none', { other: true });
  });

  it('an equality filter matches only a value of the same type', async () => {
    expect(ids(await fs.db.collection('items').where('n', '==', 1).get())).toEqual(['num1']);
    expect(ids(await fs.db.collection('items').where('n', '==', '1').get())).toEqual([]);
    expect(ids(await fs.db.collection('items').where('n', '==', null).get())).toEqual(['nil']);
  });

  it('!= and not-in leave out a document whose field is null or missing', async () => {
    expect(ids(await fs.db.collection('items').where('n', '!=', 1).get())).toEqual([
      'num5',
      'text',
    ]);
    expect(ids(await fs.db.collection('items').where('n', 'not-in', [5]).get())).toEqual([
      'num1',
      'text',
    ]);
  });

  it('a range filter matches only values of its operand type', async () => {
    expect(ids(await fs.db.collection('items').where('n', '<', 5).get())).toEqual(['num1']);
    expect(ids(await fs.db.collection('items').where('n', '<=', 5).get())).toEqual([
      'num1',
      'num5',
    ]);
    expect(ids(await fs.db.collection('items').where('n', '>', 1).get())).toEqual(['num5']);
    expect(ids(await fs.db.collection('items').where('n', '>=', 'a').get())).toEqual(['text']);
  });

  it('in, array-contains, and array-contains-any match as in Firestore', async () => {
    expect(ids(await fs.db.collection('items').where('n', 'in', [5, 'x']).get())).toEqual([
      'num5',
      'text',
    ]);
    expect(ids(await fs.db.collection('items').where('tags', 'array-contains', 'a').get())).toEqual(
      ['num1'],
    );
    expect(
      ids(await fs.db.collection('items').where('tags', 'array-contains-any', ['b', 'c']).get()),
    ).toEqual(['num1', 'num5']);
  });

  it('an inequality filter with no order orders by the inequality field, then by document id', async () => {
    fs.seed('scores/a', { n: 3 });
    fs.seed('scores/b', { n: 1 });
    fs.seed('scores/c', { n: 2 });
    fs.seed('scores/d', { n: 1 });
    expect(ids(await fs.db.collection('scores').where('n', '>', 0).get())).toEqual([
      'b',
      'd',
      'c',
      'a',
    ]);
  });

  it('an Admin Buffer is compared as bytes and a reference as a reference, never as a map', async () => {
    fs.seed('vals/bytes', { v: Buffer.from([1, 2]) });
    fs.seed('vals/map', { v: { 0: 1, 1: 2 } });
    fs.seed('vals/ref', { v: fs.db.doc('users/a') });
    fs.seed('vals/refmap', { v: { id: 'a', path: 'users/a' } });
    expect(
      ids(
        await fs.db
          .collection('vals')
          .where('v', '==', Buffer.from([1, 2]))
          .get(),
      ),
    ).toEqual(['bytes']);
    expect(
      ids(await fs.db.collection('vals').where('v', '==', fs.db.doc('users/a')).get()),
    ).toEqual(['ref']);
    expect(ids(await fs.db.collection('vals').orderBy('v').get())).toEqual([
      'bytes',
      'ref',
      'map',
      'refmap',
    ]);
  });
});

describe('orders and cursors follow real Firestore semantics', () => {
  beforeEach(() => {
    fs.seed('posts/a', { at: 2 });
    fs.seed('posts/b', { at: 3 });
    fs.seed('posts/c', { at: 2 });
    fs.seed('posts/d', { at: 1 });
    fs.seed('posts/unordered', { title: 'no at' });
  });

  it('a descending order breaks ties on document id descending, and leaves out a document missing the field', async () => {
    expect(ids(await fs.db.collection('posts').orderBy('at', 'desc').get())).toEqual([
      'b',
      'c',
      'a',
      'd',
    ]);
  });

  it('startAfter a snapshot continues after it across a tie under a descending order', async () => {
    const first = await fs.db.collection('posts').orderBy('at', 'desc').limit(2).get();
    expect(ids(first)).toEqual(['b', 'c']);
    const next = await fs.db
      .collection('posts')
      .orderBy('at', 'desc')
      .startAfter(first.docs[1])
      .get();
    expect(ids(next)).toEqual(['a', 'd']);
  });

  it('startAfter field values skips every row at or before them', async () => {
    expect(ids(await fs.db.collection('posts').orderBy('at').startAfter(2).get())).toEqual(['b']);
    expect(ids(await fs.db.collection('posts').orderBy('at').startAfter(2, 'a').get())).toEqual([
      'c',
      'b',
    ]);
  });

  it('select returns only the named fields', async () => {
    fs.seed('wide/a', { keep: 1, drop: 2 });
    const snap = await fs.db.collection('wide').select('keep').get();
    expect(snap.docs[0].data()).toEqual({ keep: 1 });
  });

  it('count answers the number of matches, bounded by the limit', async () => {
    const counted = await fs.db.collection('posts').where('at', '>=', 2).count().get();
    expect(counted.data().count).toBe(3);
    const limited = await fs.db.collection('posts').orderBy('at').limit(2).count().get();
    expect(limited.data().count).toBe(2);
  });

  it('a collection-group query reads every collection of that id at any depth', async () => {
    fs.seed('users/u1/notes/n1', { n: 1 });
    fs.seed('users/u2/notes/n2', { n: 2 });
    fs.seed('notes/top', { n: 3 });
    fs.seed('users/u1/other/n3', { n: 4 });
    const snap = await fs.db.collectionGroup('notes').orderBy('n').get();
    expect(snap.docs.map((d) => d.ref.path)).toEqual([
      'users/u1/notes/n1',
      'users/u2/notes/n2',
      'notes/top',
    ]);
  });

  it('the query forms the kit does not model throw instead of answering', () => {
    const posts = fs.db.collection('posts').orderBy('at');
    expect(() => posts.startAt(1)).toThrow(/not part of this fake/);
    expect(() => posts.endAt(1)).toThrow(/not part of this fake/);
    expect(() => posts.endBefore(1)).toThrow(/not part of this fake/);
    expect(() => posts.limitToLast(1)).toThrow(/not part of this fake/);
    expect(() => posts.offset(1)).toThrow(/not part of this fake/);
    expect(() => posts.where(Filter.or(Filter.where('at', '==', 1)))).toThrow(
      /not part of this fake/,
    );
  });
});

describe('batches and commit failures follow real Firestore semantics', () => {
  it('a batch commits all of its writes together', async () => {
    fs.seed('acct/a', { n: 1 });
    await fs.db
      .batch()
      .set(fs.db.doc('acct/b'), { n: 2 })
      .update(fs.db.doc('acct/a'), { n: 3 })
      .delete(fs.db.doc('acct/gone'))
      .commit();
    expect(fs.read('acct/a')).toEqual({ n: 3 });
    expect(fs.read('acct/b')).toEqual({ n: 2 });
  });

  it('a batch with one failing write lands none of them', async () => {
    await expect(
      fs.db
        .batch()
        .set(fs.db.doc('acct/b'), { n: 2 })
        .update(fs.db.doc('acct/missing'), { n: 1 })
        .commit(),
    ).rejects.toThrow('NOT_FOUND');
    expect(fs.read('acct/b')).toBeUndefined();
  });

  it('failCommits fails the given number of commits that touch a matching path, then they land', async () => {
    fs.failCommits((path) => path === 'acct/a', 2);
    await fs.db.doc('acct/other').set({ n: 0 });
    await expect(fs.db.doc('acct/a').set({ n: 1 })).rejects.toMatchObject({ code: 14 });
    await expect(fs.db.doc('acct/a').set({ n: 2 })).rejects.toMatchObject({ code: 14 });
    await fs.db.doc('acct/a').set({ n: 3 });
    expect(fs.read('acct/a')).toEqual({ n: 3 });
    expect(fs.read('acct/other')).toEqual({ n: 0 });
  });
});
