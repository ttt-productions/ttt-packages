import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createDomainEventInvalidator, exact, prefix, predicate } from '../../src/domain-events';

type UserFollowed = { type: 'user.followed'; ids: { userId: string } };
type EntityPublished = { type: 'entity.published'; ids: { entityId: string } };
type TestEvent = UserFollowed | EntityPublished;

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const invalidator = createDomainEventInvalidator<TestEvent>({
  'user.followed': ({ userId }) => [exact(['users', userId]), prefix(['feed'])],
  'entity.published': ({ entityId }) => [prefix(['entities']), exact(['entities', entityId])],
});

describe('createDomainEventInvalidator', () => {
  it('notify dispatches to the correct registry entry', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();

    invalidator.notify(client, { type: 'user.followed', ids: { userId: 'u1' } });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['users', 'u1'], exact: true }));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['feed'], exact: false }));
  });

  it('notify dispatches correct invalidations for entity.published', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();

    invalidator.notify(client, { type: 'entity.published', ids: { entityId: 'e42' } });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['entities'], exact: false }));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['entities', 'e42'], exact: true }));
  });

  it('notifyAll flattens invalidations from multiple events', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();

    invalidator.notifyAll(client, [
      { type: 'user.followed', ids: { userId: 'u1' } },
      { type: 'entity.published', ids: { entityId: 'e1' } },
    ]);

    // 4 distinct invalidations: 2 from user.followed + 2 from entity.published
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('notifyAll deduplicates repeated invalidations across events', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();

    // Both events produce prefix(['entities']) -> should only fire once
    invalidator.notifyAll(client, [
      { type: 'entity.published', ids: { entityId: 'e1' } },
      { type: 'entity.published', ids: { entityId: 'e1' } },
    ]);

    // ['entities'] prefix + ['entities','e1'] exact = 2 unique
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('helpers re-export exact, prefix, predicate', () => {
    expect(invalidator.helpers.exact).toBe(exact);
    expect(invalidator.helpers.prefix).toBe(prefix);
    expect(invalidator.helpers.predicate).toBe(predicate);
  });

  it('registry is accessible and contains the provided entries', () => {
    expect(typeof invalidator.registry['user.followed']).toBe('function');
    expect(typeof invalidator.registry['entity.published']).toBe('function');
  });
});

describe('createDomainEventInvalidator — awaitable refresh', () => {
  function deferredVoid() {
    let resolve!: () => void;
    const promise = new Promise<void>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('notify returns a promise that settles only after every invalidateQueries settles', async () => {
    const client = makeClient();
    const first = deferredVoid();
    const second = deferredVoid();
    const pending = [first, second];
    const spy = vi
      .spyOn(client, 'invalidateQueries')
      .mockImplementation(() => pending.shift()!.promise);

    let settled = false;
    const result = invalidator.notify(client, { type: 'user.followed', ids: { userId: 'u1' } });
    void result.then(() => {
      settled = true;
    });
    expect(spy).toHaveBeenCalledTimes(2);

    first.resolve();
    await flush();
    expect(settled).toBe(false);

    second.resolve();
    await expect(result).resolves.toBeUndefined();
    expect(settled).toBe(true);
  });

  it('notifyAll returns a promise that settles only after every deduplicated invalidation settles', async () => {
    const client = makeClient();
    const gates = [deferredVoid(), deferredVoid(), deferredVoid()];
    const queue = [...gates];
    const spy = vi
      .spyOn(client, 'invalidateQueries')
      .mockImplementation(() => queue.shift()!.promise);

    let settled = false;
    const result = invalidator.notifyAll(client, [
      { type: 'user.followed', ids: { userId: 'u1' } },
      { type: 'user.followed', ids: { userId: 'u2' } },
    ]);
    void result.then(() => {
      settled = true;
    });
    // users/u1, users/u2, and the shared feed prefix (deduped) = 3 dispatches.
    expect(spy).toHaveBeenCalledTimes(3);

    gates[0].resolve();
    gates[1].resolve();
    await flush();
    expect(settled).toBe(false);

    gates[2].resolve();
    await expect(result).resolves.toBeUndefined();
  });
});
