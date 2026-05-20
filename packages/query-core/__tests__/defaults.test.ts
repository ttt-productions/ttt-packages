import { describe, it, expect } from 'vitest';
import { defaultQueryOptions, defaultQueryClientConfig } from '../src/defaults';

describe('defaultQueryOptions', () => {
  it('has queries configuration', () => {
    expect(defaultQueryOptions.queries).toBeDefined();
  });

  it('has mutations configuration', () => {
    expect(defaultQueryOptions.mutations).toBeDefined();
  });

  it('sets staleTime to 30 seconds', () => {
    expect(defaultQueryOptions.queries?.staleTime).toBe(30_000);
  });

  it('sets gcTime to 5 minutes', () => {
    expect(defaultQueryOptions.queries?.gcTime).toBe(5 * 60_000);
  });

  it('disables refetchOnWindowFocus', () => {
    expect(defaultQueryOptions.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('enables refetchOnReconnect', () => {
    expect(defaultQueryOptions.queries?.refetchOnReconnect).toBe(true);
  });

  it('disables refetchOnMount', () => {
    expect(defaultQueryOptions.queries?.refetchOnMount).toBe(false);
  });

  it('retry function retries when failureCount < 2', () => {
    const retry = defaultQueryOptions.queries?.retry;
    expect(typeof retry).toBe('function');
    if (typeof retry === 'function') {
      expect(retry(0, new Error('test'))).toBe(true);
      expect(retry(1, new Error('test'))).toBe(true);
    }
  });

  it('retry function does not retry when failureCount >= 2', () => {
    const retry = defaultQueryOptions.queries?.retry;
    if (typeof retry === 'function') {
      expect(retry(2, new Error('test'))).toBe(false);
      expect(retry(5, new Error('test'))).toBe(false);
    }
  });

  it('mutations retry is 0', () => {
    expect(defaultQueryOptions.mutations?.retry).toBe(0);
  });
});

describe('defaultQueryClientConfig', () => {
  it('has defaultOptions matching defaultQueryOptions', () => {
    expect(defaultQueryClientConfig.defaultOptions).toBe(defaultQueryOptions);
  });
});
