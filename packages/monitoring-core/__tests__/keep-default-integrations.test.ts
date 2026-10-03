// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

const browserSdk = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  withScope: vi.fn(),
  addBreadcrumb: vi.fn(),
}));
const nodeSdk = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  withScope: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => browserSdk);
vi.mock('@sentry/node', () => nodeSdk);

const DSN = 'https://test@example.com/1';

type Integration = { name: string };
const http: Integration = { name: 'Http' };
const linkedErrors: Integration = { name: 'LinkedErrors' };
const dedupe: Integration = { name: 'Dedupe' };
const consoleIntegration: Integration = { name: 'Console' };
const sdkDefaults = [http, linkedErrors, dedupe, consoleIntegration];

/** What the SDK runs: it calls a function-form `integrations` with its own default list. */
function integrationsTheSdkRuns(sdkOptions: Record<string, unknown>): Integration[] {
  const integrations = sdkOptions.integrations;
  expect(typeof integrations).toBe('function');
  return (integrations as (defaults: Integration[]) => Integration[])(sdkDefaults);
}

describe('keepDefaultIntegrations', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it.each([
    ['sentry' as const, browserSdk],
    ['sentry-node' as const, nodeSdk],
  ])('runs only the named %s defaults, by their SDK name — every other default is off', async (provider, sdk) => {
    const { initMonitoring } = await import('../src/init');
    await initMonitoring({ provider, dsn: DSN, keepDefaultIntegrations: ['LinkedErrors', 'Dedupe'] });

    expect(sdk.init).toHaveBeenCalledTimes(1);
    const sdkOptions = sdk.init.mock.calls[0][0];
    expect(integrationsTheSdkRuns(sdkOptions)).toEqual([linkedErrors, dedupe]);
    expect(sdkOptions).not.toHaveProperty('keepDefaultIntegrations');
    expect(sdkOptions).not.toHaveProperty('defaultIntegrations');
  });

  it('still adds the integrations the caller lists, after the kept defaults', async () => {
    const { initMonitoring } = await import('../src/init');
    const extra: Integration = { name: 'Extra' };
    await initMonitoring({ provider: 'sentry-node', dsn: DSN, keepDefaultIntegrations: ['LinkedErrors'], integrations: [extra] });

    expect(integrationsTheSdkRuns(nodeSdk.init.mock.calls[0][0])).toEqual([linkedErrors, extra]);
  });

  it('an empty list turns every default off', async () => {
    const { initMonitoring } = await import('../src/init');
    await initMonitoring({ provider: 'sentry-node', dsn: DSN, keepDefaultIntegrations: [] });

    expect(integrationsTheSdkRuns(nodeSdk.init.mock.calls[0][0])).toEqual([]);
  });

  it.each(['sentry-node' as const, 'noop' as const])(
    'refuses keepDefaultIntegrations combined with defaultIntegrations on the %s provider, before any SDK init',
    async (provider) => {
      const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
      const { NoopAdapter } = await import('../src/adapters/noop');

      await expect(
        initMonitoring({ provider, dsn: DSN, keepDefaultIntegrations: ['LinkedErrors'], defaultIntegrations: false }),
      ).rejects.toThrow(/keepDefaultIntegrations/);
      expect(nodeSdk.init).not.toHaveBeenCalled();
      expect(getMonitoringAdapter()).toBe(NoopAdapter);
    },
  );

  it('re-initializes when the kept set changes, and not for an equal set', async () => {
    const { initMonitoring } = await import('../src/init');
    await initMonitoring({ provider: 'sentry-node', dsn: DSN, keepDefaultIntegrations: ['LinkedErrors'] });
    await initMonitoring({ provider: 'sentry-node', dsn: DSN, keepDefaultIntegrations: ['LinkedErrors'] });
    expect(nodeSdk.init).toHaveBeenCalledTimes(1);

    await initMonitoring({ provider: 'sentry-node', dsn: DSN, keepDefaultIntegrations: ['LinkedErrors', 'Dedupe'] });
    expect(nodeSdk.init).toHaveBeenCalledTimes(2);
    expect(integrationsTheSdkRuns(nodeSdk.init.mock.calls[1][0])).toEqual([linkedErrors, dedupe]);
  });
});
