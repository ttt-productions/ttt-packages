import { describe, it, expect } from 'vitest';
import { NoopAdapter } from '../src/adapters/noop';

describe('NoopAdapter', () => {
  it('has an init method', () => {
    expect(typeof NoopAdapter.init).toBe('function');
  });

  it('has a captureException method', () => {
    expect(typeof NoopAdapter.captureException).toBe('function');
  });

  it('has a captureMessage method', () => {
    expect(typeof NoopAdapter.captureMessage).toBe('function');
  });

  it('has a setUser method', () => {
    expect(typeof NoopAdapter.setUser).toBe('function');
  });

  it('has a setTag method', () => {
    expect(typeof NoopAdapter.setTag).toBe('function');
  });

  it('has a withScope method', () => {
    expect(typeof NoopAdapter.withScope).toBe('function');
  });

  it('has an addBreadcrumb method', () => {
    expect(typeof NoopAdapter.addBreadcrumb).toBe('function');
  });

  it('init does not throw', () => {
    expect(() => NoopAdapter.init({ provider: 'noop' })).not.toThrow();
  });

  it('captureException does not throw', () => {
    expect(() => NoopAdapter.captureException(new Error('test'))).not.toThrow();
    expect(() => NoopAdapter.captureException('string error')).not.toThrow();
    expect(() => NoopAdapter.captureException(null)).not.toThrow();
  });

  it('captureException with context does not throw', () => {
    expect(() =>
      NoopAdapter.captureException(new Error('test'), { userId: '123' })
    ).not.toThrow();
  });

  it('captureMessage does not throw', () => {
    expect(() => NoopAdapter.captureMessage('hello')).not.toThrow();
    expect(() => NoopAdapter.captureMessage('error', 'error')).not.toThrow();
  });

  it('setUser does not throw', () => {
    expect(() => NoopAdapter.setUser({ id: 'uid-123' })).not.toThrow();
    expect(() => NoopAdapter.setUser(null)).not.toThrow();
  });

  it('setTag does not throw', () => {
    expect(() => NoopAdapter.setTag('env', 'production')).not.toThrow();
  });

  it('addBreadcrumb does not throw', () => {
    expect(() =>
      NoopAdapter.addBreadcrumb?.({
        category: 'navigation',
        message: 'Page loaded',
        level: 'info',
      })
    ).not.toThrow();
  });

  it('withScope calls the callback with a scope-like object', () => {
    const result = NoopAdapter.withScope?.((scope) => {
      expect(typeof scope.setTag).toBe('function');
      expect(typeof scope.setUser).toBe('function');
      expect(typeof scope.setExtra).toBe('function');
      expect(typeof scope.setContext).toBe('function');
      return 'test-result';
    });
    expect(result).toBe('test-result');
  });

  it('withScope scope methods do not throw', () => {
    NoopAdapter.withScope?.((scope) => {
      expect(() => scope.setTag('key', 'value')).not.toThrow();
      expect(() => scope.setUser(null)).not.toThrow();
      expect(() => scope.setExtra('key', 'value')).not.toThrow();
      expect(() => scope.setContext('key', {})).not.toThrow();
    });
  });
});
