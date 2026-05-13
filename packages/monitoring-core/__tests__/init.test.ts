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

  it('local-dev gate: NEXT_PUBLIC_USE_EMULATORS=true forces noop even with sentry provider', async () => {
    const prev = process.env.NEXT_PUBLIC_USE_EMULATORS;
    process.env.NEXT_PUBLIC_USE_EMULATORS = 'true';
    try {
      const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
      const { NoopAdapter } = await import('../src/adapters/noop');
      await initMonitoring({ provider: 'sentry', enabled: true });
      expect(getMonitoringAdapter()).toBe(NoopAdapter);
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_USE_EMULATORS;
      else process.env.NEXT_PUBLIC_USE_EMULATORS = prev;
    }
  });

  it('local-dev gate: FUNCTIONS_EMULATOR=true forces noop even with sentry-node provider', async () => {
    const prev = process.env.FUNCTIONS_EMULATOR;
    process.env.FUNCTIONS_EMULATOR = 'true';
    try {
      const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
      const { NoopAdapter } = await import('../src/adapters/noop');
      await initMonitoring({ provider: 'sentry-node', enabled: true });
      expect(getMonitoringAdapter()).toBe(NoopAdapter);
    } finally {
      if (prev === undefined) delete process.env.FUNCTIONS_EMULATOR;
      else process.env.FUNCTIONS_EMULATOR = prev;
    }
  });

  it('local-dev gate: NEXT_PUBLIC_SENTRY_ENABLED=false forces noop even with sentry provider', async () => {
    const prev = process.env.NEXT_PUBLIC_SENTRY_ENABLED;
    process.env.NEXT_PUBLIC_SENTRY_ENABLED = 'false';
    try {
      const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
      const { NoopAdapter } = await import('../src/adapters/noop');
      await initMonitoring({ provider: 'sentry', enabled: true });
      expect(getMonitoringAdapter()).toBe(NoopAdapter);
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SENTRY_ENABLED;
      else process.env.NEXT_PUBLIC_SENTRY_ENABLED = prev;
    }
  });
});
