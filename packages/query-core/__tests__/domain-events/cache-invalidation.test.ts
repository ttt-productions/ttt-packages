import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
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
    expect(serializeInvalidation(prefix(['projects']))).toBe('prefix:["projects"]');
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
    applyInvalidations(client, [exact(['users']), prefix(['projects']), exact(['teams'])]);
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
