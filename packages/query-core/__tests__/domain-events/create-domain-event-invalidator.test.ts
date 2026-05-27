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

    // Both events produce prefix(['entities']) ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â should only fire once
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
