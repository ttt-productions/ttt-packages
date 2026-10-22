import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryObserver, type QueryKey } from '@tanstack/react-query';
import {
  exact,
  prefix,
  predicate,
  serializeInvalidation,
  applyInvalidations,
} from '../../src/react/domain-events/cache-invalidation.js';

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
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ refetchType: 'active' }));
  });
});

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

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

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

    applyInvalidations(client, [exact(key)]);
    expect(queryFn).toHaveBeenCalledTimes(2);

    staleRead.resolve('stale-display-name');
    await flush();
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

      void client.fetchQuery({ queryKey: key, queryFn, retry: false }).catch(() => {});
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(client.getQueryState(key)?.fetchStatus).toBe('fetching');

      applyInvalidations(client, [exact(key, { refetchType: 'all' })]);

      staleRead.resolve('stale');
      await flush();
      expect(client.getQueryData(key)).toBeUndefined();

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

function track(promise: Promise<void>): { settled: () => boolean } {
  let done = false;
  void promise.then(() => {
    done = true;
  });
  return { settled: () => done };
}

describe('applyInvalidations — awaitable refresh', () => {
  it('resolves only after the triggered refetch settles', async () => {
    const client = makeClient();
    const key = ['publicUser', 'await-1'];
    const firstRead = deferred<string>();
    const refetch = deferred<string>();
    const queryFn = sequencedQueryFn([firstRead, refetch]);

    const unsubscribe = observe(client, key, queryFn);
    firstRead.resolve('before');
    await flush();

    const result = applyInvalidations(client, [exact(key)]);
    expect(result).toBeInstanceOf(Promise);
    const tracker = track(result);
    expect(queryFn).toHaveBeenCalledTimes(2);

    await flush();
    expect(tracker.settled()).toBe(false);
    expect(client.getQueryData(key)).toBe('before');

    refetch.resolve('after');
    await result;
    expect(client.getQueryData(key)).toBe('after');

    unsubscribe();
  });

  it('waits for EVERY distinct invalidation, not just the first', async () => {
    const client = makeClient();
    const keyA = ['publicUser', 'await-a'];
    const keyB = ['entities', 'await-b'];
    const firstA = deferred<string>();
    const refetchA = deferred<string>();
    const firstB = deferred<string>();
    const refetchB = deferred<string>();
    const queryFnA = sequencedQueryFn([firstA, refetchA]);
    const queryFnB = sequencedQueryFn([firstB, refetchB]);

    const unsubscribeA = observe(client, keyA, queryFnA);
    const unsubscribeB = observe(client, keyB, queryFnB);
    firstA.resolve('a0');
    firstB.resolve('b0');
    await flush();

    const result = applyInvalidations(client, [exact(keyA), prefix(['entities'])]);
    const tracker = track(result);

    refetchA.resolve('a1');
    await flush();
    expect(tracker.settled()).toBe(false);

    refetchB.resolve('b1');
    await result;
    expect(client.getQueryData(keyA)).toBe('a1');
    expect(client.getQueryData(keyB)).toBe('b1');

    unsubscribeA();
    unsubscribeB();
  });

  it('waits for the fresh re-read of a cancelled pending initial read', async () => {
    const client = makeClient();
    const key = ['publicUser', 'await-initial'];
    const staleRead = deferred<string>();
    const freshRead = deferred<string>();
    const queryFn = sequencedQueryFn([staleRead, freshRead]);

    const unsubscribe = observe(client, key, queryFn);
    const result = applyInvalidations(client, [exact(key)]);
    const tracker = track(result);

    staleRead.resolve('stale');
    await flush();
    expect(tracker.settled()).toBe(false);

    freshRead.resolve('fresh');
    await result;
    expect(client.getQueryData(key)).toBe('fresh');

    unsubscribe();
  });

  it('resolves (never rejects) when the triggered refetch fails', async () => {
    const client = makeClient();
    const key = ['publicUser', 'await-error'];
    const firstRead = deferred<string>();
    let call = 0;
    const queryFn = vi.fn(() => {
      call += 1;
      if (call === 1) return firstRead.promise;
      return Promise.reject(new Error('refetch failed'));
    });

    const unsubscribe = observe(client, key, queryFn);
    firstRead.resolve('committed');
    await flush();

    await expect(applyInvalidations(client, [exact(key)])).resolves.toBeUndefined();
    expect(client.getQueryState(key)?.error).toBeInstanceOf(Error);
    expect(client.getQueryData(key)).toBe('committed');

    unsubscribe();
  });

  it("resolves without waiting on a read when refetchType is 'none'", async () => {
    const client = makeClient();
    const key = ['publicUser', 'await-none'];
    const firstRead = deferred<string>();
    const queryFn = sequencedQueryFn([firstRead]);

    const unsubscribe = observe(client, key, queryFn);
    firstRead.resolve('value');
    await flush();

    await expect(
      applyInvalidations(client, [exact(key, { refetchType: 'none' })]),
    ).resolves.toBeUndefined();
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);

    unsubscribe();
  });

  it('resolves immediately for an empty invalidation list', async () => {
    const client = makeClient();
    await expect(applyInvalidations(client, [])).resolves.toBeUndefined();
  });
});

describe('applyInvalidations — remove and reset entries', () => {
  it('a remove entry drops the matched query from the cache; a read in flight never puts it back, and a screen watching it is not left fetching', async () => {
    const client = makeClient();
    const key = ['violation', 'v1'];
    const read = deferred<string>();
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn: sequencedQueryFn([read]),
      retry: false,
      gcTime: Infinity,
    });
    const shown: Array<{ data: string | undefined; fetchStatus: string }> = [];
    const unsubscribe = observer.subscribe((result) =>
      shown.push({ data: result.data, fetchStatus: result.fetchStatus }),
    );
    await flush();
    expect(observer.getCurrentResult().fetchStatus).toBe('fetching');

    await applyInvalidations(client, [exact(key, { action: 'remove' })]);
    expect(client.getQueryCache().find({ queryKey: key, exact: true })).toBeUndefined();
    expect(observer.getCurrentResult().fetchStatus).toBe('idle');

    read.resolve('the deleted record');
    await flush();
    expect(client.getQueryData(key)).toBeUndefined();
    expect(shown.map((s) => s.data)).not.toContain('the deleted record');
    expect(observer.getCurrentResult()).toMatchObject({ data: undefined, fetchStatus: 'idle' });
    unsubscribe();
  });

  it('a remove entry leaves every query it does not match', async () => {
    const client = makeClient();
    client.setQueryData(['violation', 'v1'], 'one');
    client.setQueryData(['violation', 'v2'], 'two');
    await applyInvalidations(client, [exact(['violation', 'v1'], { action: 'remove' })]);
    expect(client.getQueryData(['violation', 'v1'])).toBeUndefined();
    expect(client.getQueryData(['violation', 'v2'])).toBe('two');
  });

  it('a reset entry returns the query to its initial state and settles once the fresh read lands', async () => {
    const client = makeClient();
    const key = ['feed', 'newest'];
    const first = deferred<string>();
    const second = deferred<string>();
    const queryFn = sequencedQueryFn([first, second]);
    const unsubscribe = observe(client, key, queryFn);
    first.resolve('old page');
    await flush();
    expect(client.getQueryData(key)).toBe('old page');

    let settled = false;
    const done = applyInvalidations(client, [prefix(['feed'], { action: 'reset' })]).then(() => {
      settled = true;
    });
    await flush();
    expect(client.getQueryData(key)).toBeUndefined();
    expect(settled).toBe(false);

    second.resolve('fresh page');
    await done;
    expect(client.getQueryData(key)).toBe('fresh page');
    expect(queryFn).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('a reset entry whose predicate reads the failure re-reads every failed query it reset', async () => {
    const client = makeClient();
    const failedKey = ['refused', 'a'];
    const healthyKey = ['healthy', 'b'];
    const failedRead = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('refused'))
      .mockResolvedValueOnce('answered');
    const healthyRead = vi.fn(async () => 'fine');
    const offFailed = observe(client, failedKey, failedRead);
    const offHealthy = observe(client, healthyKey, healthyRead);
    await flush();
    expect(client.getQueryState(failedKey)?.status).toBe('error');

    await applyInvalidations(client, [
      predicate('refused', (query) => query.state.error !== null, { action: 'reset' }),
    ]);
    expect(failedRead).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(failedKey)).toBe('answered');
    expect(healthyRead).toHaveBeenCalledTimes(1);
    offFailed();
    offHealthy();
  });

  it('a remove entry whose predicate reads the fetch state removes every query it matched', async () => {
    const client = makeClient();
    const key = ['violation', 'v1'];
    const read = deferred<string>();
    const unsubscribe = observe(client, key, sequencedQueryFn([read]));
    await flush();

    await applyInvalidations(client, [
      predicate('in flight', (query) => query.state.fetchStatus === 'fetching', {
        action: 'remove',
      }),
    ]);
    expect(client.getQueryCache().find({ queryKey: key, exact: true })).toBeUndefined();
    unsubscribe();
  });

  it('a remove and a refresh of the same key are two entries, never merged as duplicates', () => {
    expect(serializeInvalidation(exact(['users', '1'], { action: 'remove' }))).toBe(
      'remove:exact:["users","1"]',
    );
    expect(serializeInvalidation(predicate('refused', () => true, { action: 'reset' }))).toBe(
      'reset:predicate:refused',
    );
    expect(serializeInvalidation(exact(['users', '1'], { action: 'refresh' }))).toBe(
      'exact:["users","1"]',
    );
    const client = makeClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    const remove = vi.spyOn(client, 'removeQueries');
    applyInvalidations(client, [
      exact(['users', '1']),
      exact(['users', '1'], { action: 'remove' }),
    ]);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
