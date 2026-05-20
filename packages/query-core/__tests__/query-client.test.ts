import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createQueryClient } from '../src/query-client';
import { defaultQueryOptions } from '../src/defaults';

describe('createQueryClient', () => {
  it('returns a QueryClient instance', () => {
    const client = createQueryClient();
    expect(client).toBeInstanceOf(QueryClient);
  });

  it('uses default staleTime from defaultQueryOptions', () => {
    const client = createQueryClient();
    const options = client.getDefaultOptions();
    expect(options.queries?.staleTime).toBe(defaultQueryOptions.queries?.staleTime);
  });

  it('uses default refetchOnWindowFocus=false', () => {
    const client = createQueryClient();
    const options = client.getDefaultOptions();
    expect(options.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('accepts overrides for queries', () => {
    const client = createQueryClient({
      defaultOptions: {
        queries: { staleTime: 99_000 },
      },
    });
    const options = client.getDefaultOptions();
    expect(options.queries?.staleTime).toBe(99_000);
  });

  it('accepts overrides for mutations', () => {
    const client = createQueryClient({
      defaultOptions: {
        mutations: { retry: 3 },
      },
    });
    const options = client.getDefaultOptions();
    expect(options.mutations?.retry).toBe(3);
  });

  it('deep-merges defaultOptions queries without clobbering base defaults', () => {
    const client = createQueryClient({
      defaultOptions: {
        queries: { staleTime: 60_000 },
      },
    });
    const options = client.getDefaultOptions();
    // staleTime overridden
    expect(options.queries?.staleTime).toBe(60_000);
    // other defaults still present
    expect(options.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('works with empty overrides', () => {
    expect(() => createQueryClient({})).not.toThrow();
  });

  it('works with no arguments', () => {
    expect(() => createQueryClient()).not.toThrow();
  });

  it('each call returns a separate QueryClient instance', () => {
    const c1 = createQueryClient();
    const c2 = createQueryClient();
    expect(c1).not.toBe(c2);
  });
});
