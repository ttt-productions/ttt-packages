import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DocumentSnapshot, FirestoreDataConverter, QuerySnapshot } from 'firebase/firestore';
import {
  firestoreError,
  makeInMemoryClientFirestore,
  type InMemoryClientFirestore,
} from '../src/firestore-client/testing/in-memory-client-firestore.js';
import { describeQuery } from '../src/firestore-client/testing/sdk-internals.js';

// test/setup.ts mocks 'firebase/firestore' for every package test; these cases build real queries.
const fs = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');

let store: InMemoryClientFirestore;
const ids = (snapshot: QuerySnapshot) => snapshot.docs.map((doc) => doc.id);
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  store = makeInMemoryClientFirestore();
});

describe('the SDK internals the double reads', () => {
  it("describes a built query's path, filters, order, limit, and cursor", () => {
    const query = fs.query(
      fs.collection(store.db, 'works'),
      fs.where('status', '==', 'open'),
      fs.where('kind', 'in', ['a', 'b']),
      fs.orderBy('createdOn', 'desc'),
      fs.startAfter(3),
      fs.limit(5),
    );
    expect(describeQuery(query)).toEqual({
      path: 'works',
      collectionGroup: null,
      filters: [
        { kind: 'field', field: 'status', op: '==', value: { t: 'str', v: 'open' } },
        {
          kind: 'field',
          field: 'kind',
          op: 'in',
          value: {
            t: 'arr',
            v: [
              { t: 'str', v: 'a' },
              { t: 'str', v: 'b' },
            ],
          },
        },
      ],
      orders: [{ field: 'createdOn', direction: 'desc' }],
      limit: 5,
      limitToLast: false,
      startAt: { position: [{ t: 'num', v: 3 }], inclusive: false },
      endAt: null,
    });
  });

  it("describes a composite filter's and / or tree and a limitToLast query's end cursor", () => {
    const query = fs.query(
      fs.collection(store.db, 'works'),
      fs.or(fs.where('kind', '==', 'tune'), fs.and(fs.where('n', '>=', 3), fs.where('a', '==', 1))),
      fs.orderBy('n'),
      fs.endBefore(9),
      fs.limitToLast(2),
    );
    expect(describeQuery(query)).toMatchObject({
      filters: [
        {
          kind: 'or',
          filters: [
            { kind: 'field', field: 'kind', op: '==', value: { t: 'str', v: 'tune' } },
            {
              kind: 'and',
              filters: [
                { kind: 'field', field: 'n', op: '>=', value: { t: 'num', v: 3 } },
                { kind: 'field', field: 'a', op: '==', value: { t: 'num', v: 1 } },
              ],
            },
          ],
        },
      ],
      limit: 2,
      limitToLast: true,
      startAt: null,
      endAt: { position: [{ t: 'num', v: 9 }], inclusive: false },
    });
  });

  it('a query the SDK itself refuses never reaches the double', () => {
    expect(() =>
      fs.query(
        fs.collectionGroup(store.db, 'members'),
        fs.where(fs.documentId(), '==', 'not-a-document-path'),
      ),
    ).toThrow(/valid document path/);
  });
});

describe('getDoc', () => {
  it('answers a real snapshot of the seeded document, with real Timestamps', async () => {
    const at = fs.Timestamp.fromMillis(1_700_000_000_123);
    store.seed('works/w1', { title: 'A', at, tags: ['x'], nested: { n: 2 } });
    const snapshot = await store.reads.getDoc(fs.doc(store.db, 'works/w1'));
    expect(snapshot).toBeInstanceOf(fs.DocumentSnapshot);
    expect(snapshot.exists()).toBe(true);
    expect(snapshot.metadata.fromCache).toBe(false);
    expect(snapshot.data()).toEqual({ title: 'A', at, tags: ['x'], nested: { n: 2 } });
    expect(snapshot.get('at')).toBeInstanceOf(fs.Timestamp);
  });

  it('answers a missing document as a real snapshot that does not exist', async () => {
    const snapshot = await store.reads.getDoc(fs.doc(store.db, 'works/none'));
    expect(snapshot).toBeInstanceOf(fs.DocumentSnapshot);
    expect(snapshot.exists()).toBe(false);
    expect(snapshot.data()).toBeUndefined();
    expect(snapshot.id).toBe('none');
  });

  it("applies the reference's converter, as the SDK does", async () => {
    const titled: FirestoreDataConverter<{ title: string }> = {
      toFirestore: (model) => model,
      fromFirestore: (snapshot) => ({ title: String(snapshot.data().title).toUpperCase() }),
    };
    store.seed('works/w1', { title: 'quiet' });
    const snapshot = await store.reads.getDoc(fs.doc(store.db, 'works/w1').withConverter(titled));
    expect(snapshot.data()).toEqual({ title: 'QUIET' });
  });
});

describe('getDocs evaluates the real query', () => {
  beforeEach(() => {
    store.seed('works/a', { n: 1, status: 'open', tags: ['x'], kind: 'tale' });
    store.seed('works/b', { n: 5, status: 'closed', tags: ['y'], kind: 'tune' });
    store.seed('works/c', { n: 3, status: 'open', tags: ['x', 'y'], kind: 'tale' });
    store.seed('works/d', { status: 'open', kind: 'show' });
    store.seed('works/a/chapters/c1', { n: 9, status: 'open' });
    store.seed('realms/r1/chapters/c2', { n: 4, status: 'open' });
  });

  const run = (...constraints: Parameters<typeof fs.query>[1][]) =>
    store.reads.getDocs(fs.query(fs.collection(store.db, 'works'), ...constraints));

  it('reads only the collection itself, in document-id order', async () => {
    expect(ids(await run())).toEqual(['a', 'b', 'c', 'd']);
  });

  it('applies each filter operator the way Firestore does', async () => {
    expect(ids(await run(fs.where('status', '==', 'open')))).toEqual(['a', 'c', 'd']);
    expect(ids(await run(fs.where('kind', '!=', 'tale')))).toEqual(['d', 'b']);
    expect(ids(await run(fs.where('n', '>', 1)))).toEqual(['c', 'b']);
    expect(ids(await run(fs.where('n', '>=', 3)))).toEqual(['c', 'b']);
    expect(ids(await run(fs.where('n', '<', 3)))).toEqual(['a']);
    expect(ids(await run(fs.where('n', '<=', 3)))).toEqual(['a', 'c']);
    expect(ids(await run(fs.where('kind', 'in', ['tune', 'show'])))).toEqual(['b', 'd']);
    expect(ids(await run(fs.where('kind', 'not-in', ['tale'])))).toEqual(['d', 'b']);
    expect(ids(await run(fs.where('tags', 'array-contains', 'y')))).toEqual(['b', 'c']);
    expect(ids(await run(fs.where('tags', 'array-contains-any', ['x'])))).toEqual(['a', 'c']);
    expect(ids(await run(fs.where(fs.documentId(), '==', 'c')))).toEqual(['c']);
  });

  it('matches document ids given as bare ids, as the batch loader asks for them', async () => {
    expect(ids(await run(fs.where(fs.documentId(), 'in', ['a', 'c', 'zz'])))).toEqual(['a', 'c']);
  });

  it('evaluates or / and composite filters, ordered by their inequality field', async () => {
    const composite = fs.or(
      fs.where('kind', '==', 'tune'),
      fs.and(fs.where('status', '==', 'open'), fs.where('n', '>=', 3)),
    );
    const snapshot = await store.reads.getDocs(
      fs.query(fs.collection(store.db, 'works'), composite),
    );
    expect(ids(snapshot)).toEqual(['c', 'b']);
  });

  it('orders, leaves out a document missing the order field, and limits', async () => {
    expect(ids(await run(fs.orderBy('n', 'desc')))).toEqual(['b', 'c', 'a']);
    expect(ids(await run(fs.orderBy('n'), fs.limit(2)))).toEqual(['a', 'c']);
    expect(ids(await run(fs.orderBy('n'), fs.limitToLast(2)))).toEqual(['c', 'b']);
    expect(ids(await run(fs.orderBy('n', 'desc'), fs.limit(2)))).toEqual(['b', 'c']);
    expect(ids(await run(fs.orderBy('n', 'desc'), fs.startAfter(5)))).toEqual(['c', 'a']);
  });

  it('pages through a real snapshot cursor', async () => {
    const first = await run(fs.orderBy('n'), fs.limit(2));
    const next = await run(fs.orderBy('n'), fs.startAfter(first.docs[1]), fs.limit(2));
    expect(ids(next)).toEqual(['b']);
    expect(ids(await run(fs.orderBy('n'), fs.endBefore(5)))).toEqual(['a', 'c']);
    expect(ids(await run(fs.orderBy('n'), fs.startAt(3), fs.endAt(5)))).toEqual(['c', 'b']);
  });

  it('limitToLast with an end cursor keeps the last rows before it', async () => {
    expect(ids(await run(fs.orderBy('n'), fs.endBefore(5), fs.limitToLast(1)))).toEqual(['c']);
    expect(ids(await run(fs.orderBy('n'), fs.endAt(3), fs.limitToLast(2)))).toEqual(['a', 'c']);
  });

  it('a seeded document the test hands back serves as a cursor', async () => {
    const cursor = store.queryDocumentSnapshotOf('works/c');
    expect(ids(await run(fs.orderBy('n'), fs.startAfter(cursor)))).toEqual(['b']);
  });

  it('a collection group reads every collection of that name', async () => {
    const group = await store.reads.getDocs(
      fs.query(fs.collectionGroup(store.db, 'chapters'), fs.where('status', '==', 'open')),
    );
    expect(group.docs.map((doc) => doc.ref.path)).toEqual([
      'realms/r1/chapters/c2',
      'works/a/chapters/c1',
    ]);
  });

  it('answers real query snapshots', async () => {
    const snapshot = await run(fs.where('status', '==', 'open'));
    expect(snapshot).toBeInstanceOf(fs.QuerySnapshot);
    expect(snapshot.docs[0]).toBeInstanceOf(fs.QueryDocumentSnapshot);
    expect(snapshot.size).toBe(3);
    expect(snapshot.metadata.fromCache).toBe(false);
  });

  it("applies a query's converter to every document it answers", async () => {
    const kinds: FirestoreDataConverter<{ kind: string }> = {
      toFirestore: (model) => model,
      fromFirestore: (snapshot) => ({ kind: `kind:${String(snapshot.data().kind)}` }),
    };
    const snapshot = await store.reads.getDocs(
      fs.query(fs.collection(store.db, 'works').withConverter(kinds), fs.where('n', '>', 3)),
    );
    expect(snapshot.docs.map((doc) => doc.data())).toEqual([{ kind: 'kind:tune' }]);
  });

  it('counts what the query matches, bounded by its limit', async () => {
    const count = await store.reads.getCountFromServer(
      fs.query(fs.collection(store.db, 'works'), fs.where('status', '==', 'open')),
    );
    expect(count.data().count).toBe(3);
    const limited = await store.reads.getCountFromServer(
      fs.query(fs.collection(store.db, 'works'), fs.where('status', '==', 'open'), fs.limit(2)),
    );
    expect(limited.data().count).toBe(2);
  });

  it('logs each read, so a test whose rule is the query can assert its shape', async () => {
    await run(fs.where('status', '==', 'open'), fs.orderBy('n', 'desc'), fs.limit(1));
    expect(store.queries()).toEqual([
      {
        kind: 'query',
        listen: false,
        path: 'works',
        group: false,
        filters: [{ field: 'status', op: '==', value: { t: 'str', v: 'open' } }],
        orders: [{ field: 'n', direction: 'desc' }],
        limit: 1,
        limitToLast: false,
        startAt: null,
        endAt: null,
        includeMetadataChanges: false,
      },
    ]);
  });

  it("logs a query's cursors, so a case whose rule is the page bound can assert it", async () => {
    await run(fs.orderBy('n'), fs.startAfter(2), fs.endBefore(9));
    await run(fs.orderBy('n'), fs.startAt(4), fs.endAt(6));
    expect(store.queries()).toMatchObject([
      {
        startAt: { position: [{ t: 'num', v: 2 }], inclusive: false },
        endAt: { position: [{ t: 'num', v: 9 }], inclusive: false },
      },
      {
        startAt: { position: [{ t: 'num', v: 4 }], inclusive: true },
        endAt: { position: [{ t: 'num', v: 6 }], inclusive: true },
      },
    ]);
  });

  it('logs a count read, a group read, limitToLast, and a Timestamp operand', async () => {
    const at = fs.Timestamp.fromMillis(1_700_000_000_500);
    await store.reads.getCountFromServer(fs.query(fs.collection(store.db, 'works')));
    await store.reads.getDocs(
      fs.query(fs.collectionGroup(store.db, 'chapters'), fs.where('at', '<', at)),
    );
    await run(fs.orderBy('n'), fs.limitToLast(1));
    expect(store.queries()).toMatchObject([
      { kind: 'count', path: 'works', group: false },
      {
        kind: 'query',
        path: 'chapters',
        group: true,
        filters: [
          { field: 'at', op: '<', value: { t: 'ts', seconds: 1_700_000_000, nanos: 500_000_000 } },
        ],
      },
      { kind: 'query', path: 'works', limit: 1, limitToLast: true },
    ]);
  });
});

describe('a field path whose segment is not a plain identifier', () => {
  beforeEach(() => {
    store.seed('works/w1', { members: { 'user-a': 1, 'odd`key\\x': 'q' } });
    store.seed('works/w2', { members: { 'user-b': 2 } });
  });

  it('matches a filter on a dashed map key, as the SDK quotes it', async () => {
    const snapshot = await store.reads.getDocs(
      fs.query(fs.collection(store.db, 'works'), fs.where('members.user-a', '==', 1)),
    );
    expect(ids(snapshot)).toEqual(['w1']);
  });

  it('reads a segment holding a backtick and a backslash', async () => {
    const snapshot = await store.reads.getDocs(
      fs.query(
        fs.collection(store.db, 'works'),
        fs.where(new fs.FieldPath('members', 'odd`key\\x'), '==', 'q'),
      ),
    );
    expect(ids(snapshot)).toEqual(['w1']);
  });

  it('orders on a quoted segment, leaving out a document that lacks it', async () => {
    const snapshot = await store.reads.getDocs(
      fs.query(fs.collection(store.db, 'works'), fs.orderBy('members.user-b')),
    );
    expect(ids(snapshot)).toEqual(['w2']);
  });
});

describe('Firestore value semantics', () => {
  const run = (...constraints: Parameters<typeof fs.query>[1][]) =>
    store.reads.getDocs(fs.query(fs.collection(store.db, 'vals'), ...constraints));

  beforeEach(() => {
    store.seed('vals/num', { v: 2, nested: { n: 1 } });
    store.seed('vals/str', { v: 'x', nested: { n: 2 } });
    store.seed('vals/nil', { v: null });
    store.seed('vals/bool', { v: true });
    store.seed('vals/none', { other: 1 });
  });

  it('!= and not-in leave out a document whose field is null or missing', async () => {
    expect(ids(await run(fs.where('v', '!=', 2)))).toEqual(['bool', 'str']);
    expect(ids(await run(fs.where('v', 'not-in', ['x'])))).toEqual(['bool', 'num']);
  });

  it('a range filter never matches a value of another type', async () => {
    expect(ids(await run(fs.where('v', '>', 1)))).toEqual(['num']);
    expect(ids(await run(fs.where('v', '>=', 'a')))).toEqual(['str']);
  });

  it('an order across types follows Firestore type order', async () => {
    expect(ids(await run(fs.orderBy('v')))).toEqual(['nil', 'bool', 'num', 'str']);
  });

  it('filters and orders on a nested field path', async () => {
    expect(ids(await run(fs.where('nested.n', '>=', 1), fs.orderBy('nested.n', 'desc')))).toEqual([
      'str',
      'num',
    ]);
  });

  it('breaks order ties on document id in the last order direction, and a cursor resumes across the tie', async () => {
    store.seed('ties/a', { at: 1 });
    store.seed('ties/b', { at: 1 });
    store.seed('ties/c', { at: 1 });
    store.seed('ties/d', { at: 0 });
    const ties = (...constraints: Parameters<typeof fs.query>[1][]) =>
      store.reads.getDocs(fs.query(fs.collection(store.db, 'ties'), ...constraints));
    const desc = await ties(fs.orderBy('at', 'desc'));
    expect(ids(desc)).toEqual(['c', 'b', 'a', 'd']);
    expect(ids(await ties(fs.orderBy('at', 'desc'), fs.startAfter(desc.docs[1])))).toEqual([
      'a',
      'd',
    ]);
    const asc = await ties(fs.orderBy('at'));
    expect(ids(await ties(fs.orderBy('at'), fs.startAfter(asc.docs[1])))).toEqual(['b', 'c']);
  });
});

describe('failures, held answers, and the test hooks', () => {
  it('a failed read rejects with a FirestoreError, offline by default', async () => {
    store.failReads((read) => read.path === 'works/w1');
    await expect(store.reads.getDoc(fs.doc(store.db, 'works/w1'))).rejects.toMatchObject({
      code: 'unavailable',
    });
    await expect(store.reads.getDoc(fs.doc(store.db, 'works/w2'))).resolves.toBeDefined();
  });

  it('holds a matching read until the test releases it, while other reads answer', async () => {
    store.seed('works/w1', { title: 'A' });
    store.seed('works/w2', { title: 'B' });
    const held: { release?: () => void } = {};
    store.beforeRead(
      (read) => read.path === 'works/w1',
      () =>
        new Promise<void>((resolve) => {
          held.release = resolve;
        }),
    );
    let settled = false;
    const pending = store.reads.getDoc(fs.doc(store.db, 'works/w1')).then((snapshot) => {
      settled = true;
      return snapshot;
    });
    expect((await store.reads.getDoc(fs.doc(store.db, 'works/w2'))).data()).toEqual({ title: 'B' });
    await flush();
    expect(held.release).toBeTypeOf('function');
    expect(settled).toBe(false);
    held.release?.();
    expect((await pending).data()).toEqual({ title: 'A' });
  });

  it('an after-read hook runs once the answer is built, so the read returns what was stored before it', async () => {
    store.seed('works/w1', { n: 1 });
    store.afterRead(
      (read) => read.path === 'works/w1',
      () => store.seed('works/w1', { n: 2 }),
    );
    expect((await store.reads.getDoc(fs.doc(store.db, 'works/w1'))).get('n')).toBe(1);
    expect(store.read('works/w1')).toEqual({ n: 2 });
  });

  it('reads back, lists, and hands out snapshots of the seeded documents', () => {
    store.seed('works/b', { n: 2 });
    store.seed('works/a', { n: 1 });
    store.seed('realms/r', { n: 3 });
    expect(store.read('works/a')).toEqual({ n: 1 });
    expect(store.paths('works/')).toEqual(['works/a', 'works/b']);
    expect(store.snapshotOf('works/b').get('n')).toBe(2);
    expect(store.snapshotOf('works/none').exists()).toBe(false);
  });

  it('reset clears the documents, the log, the listeners, and every hook', async () => {
    store.seed('works/w1', { n: 1 });
    store.failReads(() => true);
    store.reads.onSnapshot(fs.doc(store.db, 'works/w1'), () => {});
    store.reset();
    await expect(store.reads.getDoc(fs.doc(store.db, 'works/w1'))).resolves.toMatchObject({
      id: 'w1',
    });
    expect(store.paths()).toEqual([]);
    expect(store.queries()).toHaveLength(1);
    expect(store.liveListeners()).toBe(0);
  });
});

describe('onSnapshot', () => {
  const nextSnapshot = <T>(subscribe: (next: (value: T) => void) => () => void) =>
    new Promise<{ value: T; stop: () => void }>((resolve) => {
      const stop = subscribe((value) => resolve({ value, stop }));
    });

  it('answers a document listener after the call returns, then on a later turn after every change', async () => {
    store.seed('works/w1', { n: 1 });
    const seen: number[] = [];
    const stop = store.reads.onSnapshot(fs.doc(store.db, 'works/w1'), (snapshot) => {
      seen.push(Number(snapshot.get('n')));
    });
    expect(seen).toEqual([]);
    await vi.waitFor(() => expect(seen).toEqual([1]));
    store.seed('works/w1', { n: 2 });
    store.seed('works/other', { n: 7 });
    expect(seen).toEqual([1]);
    await flush();
    expect(seen).toEqual([1, 2]);
    stop();
    store.seed('works/w1', { n: 3 });
    await flush();
    expect(seen).toEqual([1, 2]);
    expect(store.liveListeners()).toBe(0);
  });

  it('a query listener hears documents join and leave its result', async () => {
    const { value: first, stop } = await nextSnapshot<QuerySnapshot>((next) =>
      store.reads.onSnapshot(
        fs.query(fs.collection(store.db, 'works'), fs.where('status', '==', 'open')),
        { includeMetadataChanges: false },
        next,
      ),
    );
    expect(first.size).toBe(0);
    stop();
    const seen: string[][] = [];
    store.reads.onSnapshot(
      fs.query(fs.collection(store.db, 'works'), fs.where('status', '==', 'open')),
      { next: (snapshot: QuerySnapshot) => seen.push(ids(snapshot)) },
    );
    await vi.waitFor(() => expect(seen).toEqual([[]]));
    store.seed('works/a', { status: 'open' });
    await flush();
    store.seed('works/b', { status: 'closed' });
    await flush();
    store.remove('works/a');
    await flush();
    expect(seen).toEqual([[], ['a'], []]);
  });

  it("each later answer's docChanges are its changes since the answer before it", async () => {
    store.seed('works/a', { n: 1 });
    store.seed('works/b', { n: 2 });
    store.seed('works/c', { n: 3 });
    const answers: QuerySnapshot[] = [];
    store.reads.onSnapshot(fs.query(fs.collection(store.db, 'works'), fs.orderBy('n')), (s) =>
      answers.push(s),
    );
    await vi.waitFor(() => expect(answers).toHaveLength(1));
    const changes = (snapshot: QuerySnapshot) =>
      snapshot
        .docChanges()
        .map((change) => [change.type, change.doc.id, change.oldIndex, change.newIndex]);
    expect(changes(answers[0])).toEqual([
      ['added', 'a', -1, 0],
      ['added', 'b', -1, 1],
      ['added', 'c', -1, 2],
    ]);

    store.remove('works/a');
    store.seed('works/d', { n: 0 });
    store.seed('works/c', { n: 3, edited: true });
    await flush();
    expect(answers).toHaveLength(2);
    expect(ids(answers[1])).toEqual(['d', 'b', 'c']);
    expect(changes(answers[1])).toEqual([
      ['removed', 'a', 0, -1],
      ['added', 'd', -1, 0],
      ['modified', 'c', 2, 2],
    ]);
  });

  it('a failed listen reaches its error callback and never answers', async () => {
    store.failReads((read) => read.listen);
    const next = vi.fn<(snapshot: DocumentSnapshot) => void>();
    const error = await new Promise<unknown>((resolve) =>
      store.reads.onSnapshot(fs.doc(store.db, 'works/w1'), next, resolve),
    );
    expect(error).toMatchObject({ code: 'unavailable' });
    store.seed('works/w1', { n: 1 });
    await flush();
    expect(next).not.toHaveBeenCalled();
  });

  it('a broken live listener hears the error once, on a later turn, and nothing after it', async () => {
    store.seed('works/w1', { n: 1 });
    store.seed('works/w2', { n: 1 });
    const seen: number[] = [];
    const errors: unknown[] = [];
    store.reads.onSnapshot(
      fs.doc(store.db, 'works/w1'),
      (snapshot) => seen.push(Number(snapshot.get('n'))),
      (error) => errors.push(error),
    );
    const other = vi.fn<(snapshot: DocumentSnapshot) => void>();
    store.reads.onSnapshot(fs.doc(store.db, 'works/w2'), other);
    await vi.waitFor(() => expect(seen).toEqual([1]));
    await vi.waitFor(() => expect(other).toHaveBeenCalledTimes(1));

    const denied = firestoreError('permission-denied', 'denied');
    store.failListeners((read) => read.path === 'works/w1', denied);
    store.failListeners((read) => read.path === 'works/w1', denied);
    expect(errors).toEqual([]);
    store.seed('works/w1', { n: 2 });
    store.seed('works/w2', { n: 2 });
    await flush();

    expect(errors).toEqual([denied]);
    expect(seen).toEqual([1]);
    expect(other).toHaveBeenCalledTimes(2);
    expect(store.liveListeners()).toBe(1);
  });

  it('logs whether a listener asked for metadata changes', async () => {
    const stopPlain = store.reads.onSnapshot(fs.doc(store.db, 'works/w1'), () => {});
    const stopMetadata = store.reads.onSnapshot(
      fs.doc(store.db, 'works/w2'),
      { includeMetadataChanges: true },
      () => {},
    );
    await vi.waitFor(() => expect(store.queries()).toHaveLength(2));
    expect(store.queries().map((read) => [read.path, read.includeMetadataChanges])).toEqual([
      ['works/w1', false],
      ['works/w2', true],
    ]);
    stopPlain();
    stopMetadata();
  });

  it('answers from cache until switched back, and only a metadata listener hears the switch', async () => {
    store.seed('works/w1', { n: 1 });
    store.answerFromCache((read) => read.path === 'works/w1');
    const metadataSeen: Array<[number, boolean]> = [];
    const plainSeen: Array<[number, boolean]> = [];
    store.reads.onSnapshot(fs.doc(store.db, 'works/w1'), { includeMetadataChanges: true }, (s) =>
      metadataSeen.push([Number(s.get('n')), s.metadata.fromCache]),
    );
    store.reads.onSnapshot(fs.doc(store.db, 'works/w1'), (s) =>
      plainSeen.push([Number(s.get('n')), s.metadata.fromCache]),
    );
    await vi.waitFor(() => expect(plainSeen).toHaveLength(1));

    store.answerFromServer((read) => read.path === 'works/w1');
    await flush();
    store.seed('works/w1', { n: 2 });
    await flush();

    expect(metadataSeen).toEqual([
      [1, true],
      [1, false],
      [2, false],
    ]);
    expect(plainSeen).toEqual([
      [1, true],
      [2, false],
    ]);
  });

  it('a listener unsubscribed before its failed open never hears the failure', async () => {
    store.failReads((read) => read.listen);
    const error = vi.fn<(error: unknown) => void>();
    const stop = store.reads.onSnapshot(fs.doc(store.db, 'works/w1'), () => {}, error);
    stop();
    await vi.waitFor(() => expect(store.queries()).toHaveLength(1));
    await flush();
    expect(error).not.toHaveBeenCalled();
  });

  it('breaks a live listener with an offline error by default', async () => {
    const error = await new Promise<unknown>((resolve) => {
      store.reads.onSnapshot(
        fs.doc(store.db, 'works/w1'),
        () => {
          store.failListeners(() => true);
        },
        resolve,
      );
    });
    expect(error).toMatchObject({ code: 'unavailable' });
  });
});
