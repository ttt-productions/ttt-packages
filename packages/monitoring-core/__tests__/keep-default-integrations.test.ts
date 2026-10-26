// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initMonitoring, getMonitoringAdapter, __resetMonitoring } from '../src/init.js';
import { NoopAdapter } from '../src/adapters/noop.js';

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

type Integration = { name: string };
const http: Integration = { name: 'Http' };
const linkedErrors: Integration = { name: 'LinkedErrors' };
const dedupe: Integration = { name: 'Dedupe' };
const consoleIntegration: Integration = { name: 'Console' };
const sdkDefaults = [http, linkedErrors, dedupe, consoleIntegration];

function integrationsTheSdkRuns(sdkOptions: Record<string, unknown>): Integration[] {
  const integrations = sdkOptions.integrations;
  expect(typeof integrations).toBe('function');
  return (integrations as (defaults: Integration[]) => Integration[])(sdkDefaults);
}

describe('keepDefaultIntegrations', () => {
  beforeEach(() => {
    __resetMonitoring();
    vi.clearAllMocks();
  });

  it.each([
    ['sentry' as const, browserSdk],
    ['sentry-node' as const, nodeSdk],
  ])(
    'runs only the named %s defaults, by their SDK name — every other default is off',
    async (provider, sdk) => {
      await initMonitoring({
        provider,
        dsn: DSN,
        keepDefaultIntegrations: ['LinkedErrors', 'Dedupe'],
      });

      expect(sdk.init).toHaveBeenCalledTimes(1);
      const sdkOptions = sdk.init.mock.calls[0][0];
      expect(integrationsTheSdkRuns(sdkOptions)).toEqual([linkedErrors, dedupe]);
      expect(sdkOptions).not.toHaveProperty('keepDefaultIntegrations');
      expect(sdkOptions).not.toHaveProperty('defaultIntegrations');
    },
  );

  it('still adds the integrations the caller lists, after the kept defaults', async () => {
    const extra: Integration = { name: 'Extra' };
    await initMonitoring({
      provider: 'sentry-node',
      dsn: DSN,
      keepDefaultIntegrations: ['LinkedErrors'],
      integrations: [extra],
    });

    expect(integrationsTheSdkRuns(nodeSdk.init.mock.calls[0][0])).toEqual([linkedErrors, extra]);
  });

  it('an empty list turns every default off', async () => {
    await initMonitoring({ provider: 'sentry-node', dsn: DSN, keepDefaultIntegrations: [] });

    expect(integrationsTheSdkRuns(nodeSdk.init.mock.calls[0][0])).toEqual([]);
  });

  it.each(['sentry-node' as const, 'noop' as const])(
    'refuses keepDefaultIntegrations combined with defaultIntegrations on the %s provider, before any SDK init',
    async (provider) => {
      await expect(
        initMonitoring({
          provider,
          dsn: DSN,
          keepDefaultIntegrations: ['LinkedErrors'],
          defaultIntegrations: false,
        }),
      ).rejects.toThrow(/keepDefaultIntegrations/);
      expect(nodeSdk.init).not.toHaveBeenCalled();
      expect(getMonitoringAdapter()).toBe(NoopAdapter);
    },
  );

  it('re-initializes when the kept set changes, and not for an equal set', async () => {
    await initMonitoring({
      provider: 'sentry-node',
      dsn: DSN,
      keepDefaultIntegrations: ['LinkedErrors'],
    });
    await initMonitoring({
      provider: 'sentry-node',
      dsn: DSN,
      keepDefaultIntegrations: ['LinkedErrors'],
    });
    expect(nodeSdk.init).toHaveBeenCalledTimes(1);

    await initMonitoring({
      provider: 'sentry-node',
      dsn: DSN,
      keepDefaultIntegrations: ['LinkedErrors', 'Dedupe'],
    });
    expect(nodeSdk.init).toHaveBeenCalledTimes(2);
    expect(integrationsTheSdkRuns(nodeSdk.init.mock.calls[1][0])).toEqual([linkedErrors, dedupe]);
  });
});
