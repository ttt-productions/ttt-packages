import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryObserver, type QueryKey } from '@tanstack/react-query';
import {
  exact,
  prefix,
  predicate,
  serializeInvalidation,
  applyInvalidations,
} from '../../src/domain-events/cache-invalidation';

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('exact builder', () => {
  it('produces kind: "exact" with the given queryKey', () => {
    const inv = exact(['users', '123']);
    expect(inv.kind).toBe('exact');
    if (inv.kind !== 'exact') throw new Error('expected exact');
    expect(inv.queryKey).toEqual(['users', '123']);
    expect(inv.refetchType).toBeUndefined();
  });

  it('accepts refetchType override', () => {
    const inv = exact(['users'], { refetchType: 'all' });
    expect(inv.refetchType).toBe('all');
  });
});

describe('prefix builder', () => {
  it('produces kind: "prefix"', () => {
    const inv = prefix(['users']);
    expect(inv.kind).toBe('prefix');
  });
});

describe('predicate builder', () => {
  it('produces kind: "predicate" with description and match fn', () => {
    const match = () => true;
    const inv = predicate('all-stale', match);
    expect(inv.kind).toBe('predicate');
    if (inv.kind === 'predicate') {
      expect(inv.description).toBe('all-stale');
      expect(inv.match).toBe(match);
    }
  });
});

describe('serializeInvalidation', () => {
  it('serializes exact invalidation as "exact:[queryKey]"', () => {
    expect(serializeInvalidation(exact(['users', '1']))).toBe('exact:["users","1"]');
  });

  it('serializes prefix invalidation as "prefix:[queryKey]"', () => {
    expect(serializeInvalidation(prefix(['entities']))).toBe('prefix:["entities"]');
  });

  it('serializes predicate invalidation as "predicate:<description>"', () => {
    expect(serializeInvalidation(predicate('my-pred', () => false))).toBe('predicate:my-pred');
  });
});

describe('applyInvalidations', () => {
  it('calls invalidateQueries with exact: true for exact invalidations', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    applyInvalidations(client, [exact(['users', '1'])]);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['users', '1'], exact: true }),
    );
  });

  it('calls invalidateQueries with exact: false for prefix invalidations', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    applyInvalidations(client, [prefix(['users'])]);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['users'], exact: false }),
    );
  });

  it('calls invalidateQueries with predicate fn for predicate invalidations', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    const match = vi.fn(() => true);
    applyInvalidations(client, [predicate('test', match)]);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ predicate: match }));
  });

  it('deduplicates invalidations by serialized key', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    applyInvalidations(client, [exact(['users']), exact(['users']), exact(['users'])]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('processes multiple distinct invalidations', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    applyInvalidations(client, [exact(['users']), prefix(['entities']), exact(['teams'])]);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('passes default refetchType "active" when not specified', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    applyInvalidations(client, [exact(['users'])]);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ refetchType: 'active' }),
    );
  });
});

// ============================================================================
// Stale-response protection for PENDING INITIAL READS.
//
// TanStack's Query.fetch reuses an in-flight request when the query has no data
// yet (it only silently cancels a refetch when data is already present), so an
// invalidation landing during a first read would otherwise resolve with the
// value the server returned BEFORE the mutation committed — and mark it fresh.
// applyInvalidations cancels those pending initial reads first.
// ============================================================================

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Let microtasks and notifyManager batches settle. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Mount an ACTIVE observer (fetches synchronously when the query has no data). */
function observe(
  client: QueryClient,
  queryKey: QueryKey,
  queryFn: () => Promise<string>,
): () => void {
  const observer = new QueryObserver(client, {
    queryKey,
    queryFn,
    retry: false,
    staleTime: 0,
    gcTime: Infinity,
  });
  return observer.subscribe(() => {});
}

/** A queryFn whose Nth call returns the Nth supplied deferred promise. */
function sequencedQueryFn(responses: ReadonlyArray<Deferred<string>>) {
  let call = 0;
  return vi.fn(() => {
    const response = responses[call];
    call += 1;
    if (!response) throw new Error(`unexpected queryFn call #${call}`);
    return response.promise;
  });
}

describe('applyInvalidations — pending initial read (stale-response protection)', () => {
  it('discards the pre-commit value of an in-flight FIRST read and keeps only the fresh one', async () => {
    const client = makeClient();
    const key = ['publicUser', 'u1'];
    const staleRead = deferred<string>();
    const freshRead = deferred<string>();
    const queryFn = sequencedQueryFn([staleRead, freshRead]);

    const unsubscribe = observe(client, key, queryFn);
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(key)?.fetchStatus).toBe('fetching');
    expect(client.getQueryState(key)?.data).toBeUndefined();

    // The mutation commits while the first read is still in flight.
    applyInvalidations(client, [exact(key)]);
    expect(queryFn).toHaveBeenCalledTimes(2);

    // The abandoned read now answers with the PRE-COMMIT value...
    staleRead.resolve('stale-display-name');
    await flush();
    // ...and it must never land.
    expect(client.getQueryData(key)).not.toBe('stale-display-name');

    freshRead.resolve('fresh-display-name');
    await flush();

    expect(client.getQueryData(key)).toBe('fresh-display-name');
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    expect(client.getQueryState(key)?.status).toBe('success');
    expect(client.getQueryState(key)?.error).toBeNull();

    unsubscribe();
  });

  it('leaves a query that ALREADY has data to TanStack cancelRefetch — no extra cancellation', async () => {
    const client = makeClient();
    const key = ['publicUser', 'u2'];
    client.setQueryData(key, 'committed-value');

    const inFlightRefetch = deferred<string>();
    const freshRead = deferred<string>();
    const queryFn = sequencedQueryFn([inFlightRefetch, freshRead]);
    const cancelSpy = vi.spyOn(client, 'cancelQueries');

    const unsubscribe = observe(client, key, queryFn);
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(key)?.data).toBe('committed-value');

    applyInvalidations(client, [exact(key)]);

    expect(cancelSpy).not.toHaveBeenCalled();
    expect(queryFn).toHaveBeenCalledTimes(2);

    inFlightRefetch.resolve('stale-refetch-value');
    freshRead.resolve('fresh-value');
    await flush();

    expect(client.getQueryData(key)).toBe('fresh-value');
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);

    unsubscribe();
    cancelSpy.mockRestore();
  });

  it('does NOT cancel an idle query — no spurious CancelledError', async () => {
    const client = makeClient();
    const key = ['publicUser', 'u3'];
    const settledRead = deferred<string>();
    const nextRead = deferred<string>();
    const queryFn = sequencedQueryFn([settledRead, nextRead]);

    const unsubscribe = observe(client, key, queryFn);
    settledRead.resolve('settled-value');
    await flush();
    expect(client.getQueryState(key)?.fetchStatus).toBe('idle');

    const cancelSpy = vi.spyOn(client, 'cancelQueries');
    applyInvalidations(client, [exact(key)]);
    expect(cancelSpy).not.toHaveBeenCalled();

    nextRead.resolve('next-value');
    await flush();
    expect(client.getQueryState(key)?.error).toBeNull();
    expect(client.getQueryData(key)).toBe('next-value');

    unsubscribe();
    cancelSpy.mockRestore();
  });

  describe('refetchType', () => {
    it("'active' cancels and refetches the matched pending initial read", async () => {
      const client = makeClient();
      const key = ['publicUser', 'active'];
      const staleRead = deferred<string>();
      const freshRead = deferred<string>();
      const queryFn = sequencedQueryFn([staleRead, freshRead]);

      const unsubscribe = observe(client, key, queryFn);
      applyInvalidations(client, [exact(key, { refetchType: 'active' })]);

      expect(queryFn).toHaveBeenCalledTimes(2);
      staleRead.resolve('stale');
      freshRead.resolve('fresh');
      await flush();
      expect(client.getQueryData(key)).toBe('fresh');

      unsubscribe();
    });

    it("'all' cancels an INACTIVE pending initial read, so its stale value is discarded", async () => {
      const client = makeClient();
      const key = ['publicUser', 'inactive'];
      const staleRead = deferred<string>();
      const nextRead = deferred<string>();
      const queryFn = sequencedQueryFn([staleRead, nextRead]);

      // No observer: an observerless query that has never completed a fetch is
      // "disabled" to TanStack's refetch pass, so nothing restarts it here. The
      // cancellation still matters — it is what stops the pre-commit value from
      // landing as this query's first (and therefore fresh-marked) data.
      void client.fetchQuery({ queryKey: key, queryFn, retry: false }).catch(() => {});
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(client.getQueryState(key)?.fetchStatus).toBe('fetching');

      applyInvalidations(client, [exact(key, { refetchType: 'all' })]);

      staleRead.resolve('stale');
      await flush();
      expect(client.getQueryData(key)).toBeUndefined();

      // The next consumer to mount the query reads fresh.
      const unsubscribe = observe(client, key, queryFn);
      nextRead.resolve('fresh');
      await flush();
      expect(client.getQueryData(key)).toBe('fresh');

      unsubscribe();
    });

    it("'none' leaves the pending initial read alone — nothing would refetch it", async () => {
      const client = makeClient();
      const key = ['publicUser', 'none'];
      const onlyRead = deferred<string>();
      const queryFn = sequencedQueryFn([onlyRead]);
      const cancelSpy = vi.spyOn(client, 'cancelQueries');

      const unsubscribe = observe(client, key, queryFn);
      applyInvalidations(client, [exact(key, { refetchType: 'none' })]);

      expect(cancelSpy).not.toHaveBeenCalled();
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(client.getQueryState(key)?.isInvalidated).toBe(true);

      onlyRead.resolve('in-flight-value');
      await flush();

      // The consumer keeps the only answer it was ever going to get.
      expect(client.getQueryData(key)).toBe('in-flight-value');

      unsubscribe();
      cancelSpy.mockRestore();
    });
  });

  it('cancels every pending initial read matched by a PREFIX invalidation', async () => {
    const client = makeClient();
    const keyA = ['publicUser', 'a'];
    const keyB = ['publicUser', 'b'];
    const staleA = deferred<string>();
    const freshA = deferred<string>();
    const staleB = deferred<string>();
    const freshB = deferred<string>();
    const queryFnA = sequencedQueryFn([staleA, freshA]);
    const queryFnB = sequencedQueryFn([staleB, freshB]);

    const unsubscribeA = observe(client, keyA, queryFnA);
    const unsubscribeB = observe(client, keyB, queryFnB);

    applyInvalidations(client, [prefix(['publicUser'])]);

    expect(queryFnA).toHaveBeenCalledTimes(2);
    expect(queryFnB).toHaveBeenCalledTimes(2);

    staleA.resolve('stale-a');
    staleB.resolve('stale-b');
    await flush();
    expect(client.getQueryData(keyA)).not.toBe('stale-a');
    expect(client.getQueryData(keyB)).not.toBe('stale-b');

    freshA.resolve('fresh-a');
    freshB.resolve('fresh-b');
    await flush();
    expect(client.getQueryData(keyA)).toBe('fresh-a');
    expect(client.getQueryData(keyB)).toBe('fresh-b');

    unsubscribeA();
    unsubscribeB();
  });

  it('cancels every pending initial read matched by a PREDICATE invalidation', async () => {
    const client = makeClient();
    const matchedKey = ['lookup', 'workRealm', 'r1'];
    const unmatchedKey = ['lookup', 'workProject', 'p1'];
    const staleMatched = deferred<string>();
    const freshMatched = deferred<string>();
    const unmatchedRead = deferred<string>();
    const matchedFn = sequencedQueryFn([staleMatched, freshMatched]);
    const unmatchedFn = sequencedQueryFn([unmatchedRead]);

    const unsubscribeMatched = observe(client, matchedKey, matchedFn);
    const unsubscribeUnmatched = observe(client, unmatchedKey, unmatchedFn);

    applyInvalidations(client, [
      predicate('workRealm lookups', (query) => query.queryKey[1] === 'workRealm'),
    ]);

    expect(matchedFn).toHaveBeenCalledTimes(2);
    expect(unmatchedFn).toHaveBeenCalledTimes(1);

    staleMatched.resolve('stale-realm');
    await flush();
    expect(client.getQueryData(matchedKey)).not.toBe('stale-realm');

    freshMatched.resolve('fresh-realm');
    unmatchedRead.resolve('untouched');
    await flush();
    expect(client.getQueryData(matchedKey)).toBe('fresh-realm');
    expect(client.getQueryData(unmatchedKey)).toBe('untouched');

    unsubscribeMatched();
    unsubscribeUnmatched();
  });
});
