import { describe, it, expect } from 'vitest';
import { tttDefaultOptions, tttQueryClientConfig } from '../src/defaults';

describe('tttDefaultOptions', () => {
  it('has queries configuration', () => {
    expect(tttDefaultOptions.queries).toBeDefined();
  });

  it('has mutations configuration', () => {
    expect(tttDefaultOptions.mutations).toBeDefined();
  });

  it('sets staleTime to 30 seconds', () => {
    expect(tttDefaultOptions.queries?.staleTime).toBe(30_000);
  });

  it('sets gcTime to 5 minutes', () => {
    expect(tttDefaultOptions.queries?.gcTime).toBe(5 * 60_000);
  });

  it('disables refetchOnWindowFocus', () => {
    expect(tttDefaultOptions.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('enables refetchOnReconnect', () => {
    expect(tttDefaultOptions.queries?.refetchOnReconnect).toBe(true);
  });

  it('disables refetchOnMount', () => {
    expect(tttDefaultOptions.queries?.refetchOnMount).toBe(false);
  });

  it('retry function retries when failureCount < 2', () => {
    const retry = tttDefaultOptions.queries?.retry;
    expect(typeof retry).toBe('function');
    if (typeof retry === 'function') {
      expect(retry(0, new Error('test'))).toBe(true);
      expect(retry(1, new Error('test'))).toBe(true);
    }
  });

  it('retry function does not retry when failureCount >= 2', () => {
    const retry = tttDefaultOptions.queries?.retry;
    if (typeof retry === 'function') {
      expect(retry(2, new Error('test'))).toBe(false);
      expect(retry(5, new Error('test'))).toBe(false);
    }
  });

  it('mutations retry is 0', () => {
    expect(tttDefaultOptions.mutations?.retry).toBe(0);
  });
});

describe('tttQueryClientConfig', () => {
  it('has defaultOptions matching tttDefaultOptions', () => {
    expect(tttQueryClientConfig.defaultOptions).toBe(tttDefaultOptions);
  });
});
