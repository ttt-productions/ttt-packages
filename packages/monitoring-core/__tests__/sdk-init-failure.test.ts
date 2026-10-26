// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { SentryNodeAdapter } from '../src/adapters/sentry-node.js';
import { SentryAdapter } from '../src/adapters/sentry.js';
import { __resetSentryAdapter } from '../src/adapters/create-sentry-adapter.js';

const sdks = await vi.hoisted(async () => {
  const { sentrySdkFake } = await import('./helpers/sentry-sdk-fake.js');
  const node = sentrySdkFake().sdk;
  node.init.mockImplementation(() => {
    throw new Error('invalid option');
  });
  const browser = sentrySdkFake().sdk;
  browser.captureException.mockImplementation(() => {
    throw new Error('transport fault');
  });
  return { node, browser };
});

vi.mock('../src/adapters/sentry-browser-sdk.js', async () => {
  const { stubModule } = await import('../../../test/typed-mock.js');
  return stubModule<typeof import('../src/adapters/sentry-browser-sdk.js')>({
    importSentryBrowser: async () => sdks.browser,
  });
});
vi.mock('../src/adapters/sentry-node-sdk.js', async () => {
  const { stubModule } = await import('../../../test/typed-mock.js');
  return stubModule<typeof import('../src/adapters/sentry-node-sdk.js')>({
    importSentryNode: async () => sdks.node,
  });
});

const DSN = 'https://test@example.com/1';

describe('a Sentry SDK that loads but cannot take the call', () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    __resetSentryAdapter(SentryNodeAdapter);
    __resetSentryAdapter(SentryAdapter);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('reports a call that waited on a failed SDK init as an init failure, not a load failure', async () => {
    const ready = SentryNodeAdapter.init({ provider: 'sentry-node', dsn: DSN });
    SentryNodeAdapter.captureException(new Error('boom'));
    await expect(ready).rejects.toThrow('invalid option');

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
    expect(String(consoleError.mock.calls[0][0])).toBe(
      '[monitoring-core] captureException was not delivered: the monitoring SDK failed to initialize',
    );
  });

  it('keeps naming the init failure for every later call', async () => {
    await expect(SentryNodeAdapter.init({ provider: 'sentry-node', dsn: DSN })).rejects.toThrow();

    SentryNodeAdapter.captureMessage('later', 'info');
    SentryNodeAdapter.setTag('k', 'v');

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(2));
    const reported = consoleError.mock.calls.map((call) => String(call[0]));
    expect(reported).toEqual([
      '[monitoring-core] captureMessage was not delivered: the monitoring SDK failed to initialize',
      '[monitoring-core] setTag was not delivered: the monitoring SDK failed to initialize',
    ]);
  });

  it('reports an SDK that throws on a waiting call as a throw, not a load failure', async () => {
    const ready = SentryAdapter.init({ provider: 'sentry', dsn: DSN });
    SentryAdapter.captureException(new Error('boom'));
    await ready;

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
    expect(String(consoleError.mock.calls[0][0])).toBe(
      '[monitoring-core] captureException was not delivered: the monitoring SDK threw',
    );
  });
});
