import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createTTTQueryClient } from '../src/query-client';
import { tttDefaultOptions } from '../src/defaults';

describe('createTTTQueryClient', () => {
  it('returns a QueryClient instance', () => {
    const client = createTTTQueryClient();
    expect(client).toBeInstanceOf(QueryClient);
  });

  it('uses default staleTime from tttDefaultOptions', () => {
    const client = createTTTQueryClient();
    const options = client.getDefaultOptions();
    expect(options.queries?.staleTime).toBe(tttDefaultOptions.queries?.staleTime);
  });

  it('uses default refetchOnWindowFocus=false', () => {
    const client = createTTTQueryClient();
    const options = client.getDefaultOptions();
    expect(options.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('accepts overrides for queries', () => {
    const client = createTTTQueryClient({
      defaultOptions: {
        queries: { staleTime: 99_000 },
      },
    });
    const options = client.getDefaultOptions();
    expect(options.queries?.staleTime).toBe(99_000);
  });

  it('accepts overrides for mutations', () => {
    const client = createTTTQueryClient({
      defaultOptions: {
        mutations: { retry: 3 },
      },
    });
    const options = client.getDefaultOptions();
    expect(options.mutations?.retry).toBe(3);
  });

  it('deep-merges defaultOptions queries without clobbering base defaults', () => {
    const client = createTTTQueryClient({
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
    expect(() => createTTTQueryClient({})).not.toThrow();
  });

  it('works with no arguments', () => {
    expect(() => createTTTQueryClient()).not.toThrow();
  });

  it('each call returns a separate QueryClient instance', () => {
    const c1 = createTTTQueryClient();
    const c2 = createTTTQueryClient();
    expect(c1).not.toBe(c2);
  });
});
