// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getMonitoringAdapter,
  initMonitoring,
  setMonitoringAdapter,
  resetMonitoringAdapter,
  __resetMonitoring,
} from '../src/init.js';
import { captureException, captureMessage } from '../src/api.js';
import { NoopAdapter } from '../src/adapters/noop.js';
import type { BeforeSendHook } from '../src/scrubber.js';

const browser = await vi.hoisted(async () => {
  const { sentrySdkFake } = await import('./helpers/sentry-sdk-fake.js');
  return sentrySdkFake();
});
const node = await vi.hoisted(async () => {
  const { sentrySdkFake } = await import('./helpers/sentry-sdk-fake.js');
  return sentrySdkFake();
});
const browserSdk = browser.sdk;
const nodeSdk = node.sdk;

vi.mock(import('../src/adapters/sentry-browser-sdk.js'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  return stubModule(importOriginal, {
    importSentryBrowser: async () => browser.sdk,
  });
});
vi.mock(import('../src/adapters/sentry-node-sdk.js'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  return stubModule(importOriginal, {
    importSentryNode: async () => node.sdk,
  });
});

const DSN = 'https://test@example.com/1';

async function flushPendingWork() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('initMonitoring', () => {
  beforeEach(() => {
    __resetMonitoring();
    vi.clearAllMocks();
  });

  it('getMonitoringAdapter returns the NoopAdapter singleton before any init', async () => {
    expect(getMonitoringAdapter()).toBe(NoopAdapter);
  });

  it('initializes with noop provider, enabled: true, installs the NoopAdapter', async () => {
    await initMonitoring({ provider: 'noop', enabled: true });
    expect(getMonitoringAdapter()).toBe(NoopAdapter);
  });

  it('initializes with noop provider, enabled: false, installs the NoopAdapter', async () => {
    await initMonitoring({ provider: 'noop', enabled: false });
    expect(getMonitoringAdapter()).toBe(NoopAdapter);
  });

  it('re-init with same options is a no-op (does not swap the adapter reference)', async () => {
    const opts = { provider: 'noop' as const };
    await initMonitoring(opts);
    const first = getMonitoringAdapter();
    await initMonitoring(opts);
    expect(getMonitoringAdapter()).toBe(first);
  });

  it('re-init with different options reinitializes and ends on the noop adapter', async () => {
    await initMonitoring({ provider: 'noop', environment: 'test' });
    await initMonitoring({ provider: 'noop', environment: 'prod' });
    expect(getMonitoringAdapter()).toBe(NoopAdapter);
  });

  it('force=true reinitializes even with same options and keeps the noop adapter installed', async () => {
    const opts = { provider: 'noop' as const };
    await initMonitoring(opts);
    await initMonitoring(opts, true);
    expect(getMonitoringAdapter()).toBe(NoopAdapter);
  });

  it('setMonitoringAdapter installs the given adapter and getMonitoringAdapter returns it', async () => {
    const fake = {
      init: vi.fn<(options: Record<string, unknown>) => void>(),
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      setUser: vi.fn(),
      setTag: vi.fn(),
    };
    setMonitoringAdapter(fake);
    expect(getMonitoringAdapter()).toBe(fake);
  });

  it('resetMonitoringAdapter restores the NoopAdapter singleton', async () => {
    const fake = {
      init: vi.fn<(options: Record<string, unknown>) => void>(),
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      setUser: vi.fn(),
      setTag: vi.fn(),
    };
    setMonitoringAdapter(fake);
    expect(getMonitoringAdapter()).toBe(fake);
    resetMonitoringAdapter();
    expect(getMonitoringAdapter()).toBe(NoopAdapter);
  });

  it('initMonitoring after setMonitoringAdapter re-installs the configured adapter (no stale-options short circuit)', async () => {
    const fake = {
      init: vi.fn<(options: Record<string, unknown>) => void>(),
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      setUser: vi.fn(),
      setTag: vi.fn(),
    };
    setMonitoringAdapter(fake);
    await initMonitoring({ provider: 'noop' });
    expect(getMonitoringAdapter()).toBe(NoopAdapter);
  });
});

describe('initMonitoring — the app decides when monitoring is off', () => {
  beforeEach(() => {
    __resetMonitoring();
    vi.clearAllMocks();
  });

  it.each([
    ['sentry' as const, browserSdk],
    ['sentry-node' as const, nodeSdk],
  ])(
    'enabled: false keeps a configured %s provider off and loads no SDK',
    async (provider, sdk) => {
      await initMonitoring({ provider, dsn: DSN, enabled: false });
      expect(getMonitoringAdapter()).toBe(NoopAdapter);
      expect(sdk.init).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['sentry' as const, browserSdk],
    ['sentry-node' as const, nodeSdk],
  ])('a configured %s provider is on when the app does not turn it off', async (provider, sdk) => {
    await initMonitoring({ provider, dsn: DSN });
    expect(getMonitoringAdapter()).not.toBe(NoopAdapter);
    expect(sdk.init).toHaveBeenCalledTimes(1);
  });

  it('reads no environment variable while initializing', async () => {
    const realEnv = process.env;
    const readKeys: PropertyKey[] = [];
    process.env = new Proxy(realEnv, {
      get(target, key, receiver) {
        readKeys.push(key);
        const value: unknown = Reflect.get(target, key, receiver);
        return value;
      },
      has(target, key) {
        readKeys.push(key);
        return Reflect.has(target, key);
      },
    });
    try {
      await initMonitoring({ provider: 'sentry-node', dsn: DSN });
      await initMonitoring({ provider: 'sentry', dsn: DSN, enabled: false });
    } finally {
      process.env = realEnv;
    }
    expect(readKeys).toEqual([]);
  });
});

describe('initMonitoring — no environment flag switches a configured provider off', () => {
  beforeEach(() => {
    __resetMonitoring();
    vi.clearAllMocks();
  });

  it('NEXT_PUBLIC_SENTRY_ENABLED=false does not silence a configured provider', async () => {
    const prev = process.env.NEXT_PUBLIC_SENTRY_ENABLED;
    process.env.NEXT_PUBLIC_SENTRY_ENABLED = 'false';
    try {
      await initMonitoring({ provider: 'sentry', dsn: DSN });
      expect(getMonitoringAdapter()).not.toBe(NoopAdapter);
      expect(browserSdk.init).toHaveBeenCalledTimes(1);
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SENTRY_ENABLED;
      else process.env.NEXT_PUBLIC_SENTRY_ENABLED = prev;
    }
  });

  it('a provider with no DSN initializes no SDK', async () => {
    await initMonitoring({ provider: 'sentry-node' });
    expect(nodeSdk.init).not.toHaveBeenCalled();
  });
});

describe('initMonitoring — init-time hooks and the startup window', () => {
  beforeEach(() => {
    __resetMonitoring();
    vi.clearAllMocks();
  });

  it.each([
    ['sentry' as const, browserSdk],
    ['sentry-node' as const, nodeSdk],
  ])(
    'passes beforeSend, beforeSendTransaction, and the integration options into the %s SDK init',
    async (provider, sdk) => {
      const beforeSend: BeforeSendHook = (event) => event;
      const beforeSendTransaction: BeforeSendHook = (event) => event;
      const integrations = [{ name: 'Dedupe' }];
      await initMonitoring({
        provider,
        dsn: DSN,
        beforeSend,
        beforeSendTransaction,
        defaultIntegrations: false,
        integrations,
      });

      expect(sdk.init).toHaveBeenCalledTimes(1);
      const sdkOptions = sdk.init.mock.calls[0][0];
      expect(sdkOptions.beforeSend).toBe(beforeSend);
      expect(sdkOptions.beforeSendTransaction).toBe(beforeSendTransaction);
      expect(sdkOptions.defaultIntegrations).toBe(false);
      expect(sdkOptions.integrations).toBe(integrations);
      expect(sdkOptions.dsn).toBe(DSN);
    },
  );

  it('leaves out of the SDK init every hook the caller did not set', async () => {
    await initMonitoring({ provider: 'sentry-node', dsn: DSN });
    const sdkOptions = nodeSdk.init.mock.calls[0][0];
    for (const key of [
      'beforeSend',
      'beforeSendTransaction',
      'defaultIntegrations',
      'integrations',
      'tracesSampleRate',
    ]) {
      expect(sdkOptions).not.toHaveProperty(key);
    }
  });

  it.each([
    ['sentry' as const, browserSdk],
    ['sentry-node' as const, nodeSdk],
  ])(
    'a %s capture issued while the SDK loads is delivered after the SDK init, not dropped',
    async (provider, sdk) => {
      const early = new Error('during startup');

      const ready = initMonitoring({ provider, dsn: DSN });
      captureException(early);
      captureMessage('startup note', 'warning');
      await ready;
      await flushPendingWork();

      expect(sdk.captureException).toHaveBeenCalledTimes(1);
      expect(sdk.captureException).toHaveBeenCalledWith(early);
      expect(sdk.captureMessage).toHaveBeenCalledWith('startup note', 'warning');
      expect(sdk.init.mock.invocationCallOrder[0]).toBeLessThan(
        sdk.captureException.mock.invocationCallOrder[0],
      );
    },
  );

  it('re-initializes when only a function-valued option changes', async () => {
    const first: BeforeSendHook = (event) => event;
    const second: BeforeSendHook = () => null;
    await initMonitoring({ provider: 'sentry-node', dsn: DSN, beforeSend: first });
    await initMonitoring({ provider: 'sentry-node', dsn: DSN, beforeSend: second });

    expect(nodeSdk.init).toHaveBeenCalledTimes(2);
    expect(nodeSdk.init.mock.calls[1][0].beforeSend).toBe(second);
  });

  it('does not re-initialize for the same options, hook references included', async () => {
    const beforeSend: BeforeSendHook = (event) => event;
    await initMonitoring({ provider: 'sentry-node', dsn: DSN, beforeSend, integrations: [] });
    await initMonitoring({ provider: 'sentry-node', dsn: DSN, beforeSend, integrations: [] });

    expect(nodeSdk.init).toHaveBeenCalledTimes(1);
  });
});
