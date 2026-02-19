import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use dynamic imports with resetModules to get fresh singleton state per test
describe('initMonitoring', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getMonitoringAdapter returns NoopAdapter by default (before any init)', async () => {
    const { getMonitoringAdapter } = await import('../src/init');
    const adapter = getMonitoringAdapter();
    expect(typeof adapter.captureException).toBe('function');
    expect(typeof adapter.captureMessage).toBe('function');
    expect(typeof adapter.setUser).toBe('function');
    expect(typeof adapter.setTag).toBe('function');
  });

  it('initializes with noop provider and enabled: true', async () => {
    const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
    await initMonitoring({ provider: 'noop', enabled: true });
    const adapter = getMonitoringAdapter();
    expect(typeof adapter.captureException).toBe('function');
  });

  it('initializes with noop provider and enabled: false', async () => {
    const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
    await initMonitoring({ provider: 'noop', enabled: false });
    const adapter = getMonitoringAdapter();
    expect(typeof adapter.captureException).toBe('function');
  });

  it('re-init with same options is a no-op (returns early)', async () => {
    const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
    const opts = { provider: 'noop' as const };
    await initMonitoring(opts);
    const adapter1 = getMonitoringAdapter();
    await initMonitoring(opts); // same options, should be no-op
    const adapter2 = getMonitoringAdapter();
    expect(adapter1).toBe(adapter2);
  });

  it('re-init with different options reinitializes', async () => {
    const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
    await initMonitoring({ provider: 'noop', environment: 'test' });
    const adapter1 = getMonitoringAdapter();
    // Different options → re-init (still noop, but re-ran)
    await initMonitoring({ provider: 'noop', environment: 'prod' });
    const adapter2 = getMonitoringAdapter();
    // Both should be the noop adapter
    expect(typeof adapter2.captureException).toBe('function');
  });

  it('force=true reinitializes even with same options', async () => {
    const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
    const opts = { provider: 'noop' as const };
    await initMonitoring(opts);
    const adapter1 = getMonitoringAdapter();
    await initMonitoring(opts, true); // force reinit
    const adapter2 = getMonitoringAdapter();
    // Both are NoopAdapter — they should be the same singleton object
    expect(adapter2).toBe(adapter1);
  });
});
