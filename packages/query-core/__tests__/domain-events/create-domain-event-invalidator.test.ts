import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createDomainEventInvalidator, exact, prefix, predicate } from '../../src/domain-events';

type UserFollowed = { type: 'user.followed'; ids: { userId: string } };
type ProjectPublished = { type: 'project.published'; ids: { projectId: string } };
type TestEvent = UserFollowed | ProjectPublished;

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const invalidator = createDomainEventInvalidator<TestEvent>({
  'user.followed': ({ userId }) => [exact(['users', userId]), prefix(['feed'])],
  'project.published': ({ projectId }) => [prefix(['projects']), exact(['projects', projectId])],
});

describe('createDomainEventInvalidator', () => {
  it('notify dispatches to the correct registry entry', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();

    invalidator.notify(client, { type: 'user.followed', ids: { userId: 'u1' } });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['users', 'u1'], exact: true }));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['feed'], exact: false }));
  });

  it('notify dispatches correct invalidations for project.published', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();

    invalidator.notify(client, { type: 'project.published', ids: { projectId: 'p42' } });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['projects'], exact: false }));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['projects', 'p42'], exact: true }));
  });

  it('notifyAll flattens invalidations from multiple events', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();

    invalidator.notifyAll(client, [
      { type: 'user.followed', ids: { userId: 'u1' } },
      { type: 'project.published', ids: { projectId: 'p1' } },
    ]);

    // 4 distinct invalidations: 2 from user.followed + 2 from project.published
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('notifyAll deduplicates repeated invalidations across events', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();

    // Both events produce prefix(['projects']) — should only fire once
    invalidator.notifyAll(client, [
      { type: 'project.published', ids: { projectId: 'p1' } },
      { type: 'project.published', ids: { projectId: 'p1' } },
    ]);

    // ['projects'] prefix + ['projects','p1'] exact = 2 unique
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('helpers re-export exact, prefix, predicate', () => {
    expect(invalidator.helpers.exact).toBe(exact);
    expect(invalidator.helpers.prefix).toBe(prefix);
    expect(invalidator.helpers.predicate).toBe(predicate);
  });

  it('registry is accessible and contains the provided entries', () => {
    expect(typeof invalidator.registry['user.followed']).toBe('function');
    expect(typeof invalidator.registry['project.published']).toBe('function');
  });
});
