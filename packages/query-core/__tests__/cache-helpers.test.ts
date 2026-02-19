import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidateByPrefix, removeByPrefix, updateQueryData } from '../src/cache-helpers';

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

describe('invalidateByPrefix', () => {
  it('calls invalidateQueries with queryKey prefix and exact: false', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    await invalidateByPrefix(client, ['users']);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['users'], exact: false });
  });

  it('works with multi-segment prefix', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    await invalidateByPrefix(client, ['users', 'list']);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['users', 'list'], exact: false });
  });
});

describe('removeByPrefix', () => {
  it('calls removeQueries with queryKey prefix and exact: false', () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'removeQueries');
    removeByPrefix(client, ['projects']);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['projects'], exact: false });
  });

  it('works with nested prefix', () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'removeQueries');
    removeByPrefix(client, ['projects', 'recent']);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['projects', 'recent'], exact: false });
  });
});

describe('updateQueryData', () => {
  it('calls setQueryData with the key and updater', () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'setQueryData');
    const updater = (prev: string[] | undefined) => [...(prev ?? []), 'new'];
    updateQueryData<string[]>(client, ['list'], updater);
    expect(spy).toHaveBeenCalledWith(['list'], expect.any(Function));
  });

  it('updater receives previous value and returns new value', () => {
    const client = makeClient();
    client.setQueryData(['nums'], [1, 2, 3]);
    updateQueryData<number[]>(client, ['nums'], (prev) => [...(prev ?? []), 4]);
    expect(client.getQueryData(['nums'])).toEqual([1, 2, 3, 4]);
  });

  it('updater handles undefined previous value', () => {
    const client = makeClient();
    updateQueryData<string[]>(client, ['empty'], (prev) => prev ?? ['default']);
    expect(client.getQueryData(['empty'])).toEqual(['default']);
  });
});
