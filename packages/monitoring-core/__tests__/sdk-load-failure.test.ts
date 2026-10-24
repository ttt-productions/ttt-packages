// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { SentryNodeAdapter } from '../src/adapters/sentry-node.js';
import { SentryAdapter } from '../src/adapters/sentry.js';
import { initMonitoring, __resetMonitoring } from '../src/init.js';

vi.mock('@sentry/node', () => {
  throw new Error('sdk failed to load');
});
vi.mock('@sentry/nextjs', () => {
  throw new Error('sdk failed to load');
});

describe('a Sentry SDK that fails to load', () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    __resetMonitoring();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it.each([
    ['SentryNodeAdapter', SentryNodeAdapter],
    ['SentryAdapter', SentryAdapter],
  ] as const)(
    '%s reports each undelivered call on the console instead of an unhandled rejection',
    async (_name, adapter) => {
      adapter.captureException(new Error('boom'));
      adapter.captureMessage('note', 'info');
      adapter.setTag('k', 'v');
      adapter.setUser({ id: 'u1' });
      adapter.addBreadcrumb!({ message: 'crumb' });
      await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(5));

      const reported = consoleError.mock.calls.map((call) => String(call[0]));
      for (const operation of [
        'captureException',
        'captureMessage',
        'setTag',
        'setUser',
        'addBreadcrumb',
      ]) {
        expect(reported).toContain(
          `[monitoring-core] ${operation} was not delivered: the monitoring SDK did not load`,
        );
      }
    },
  );

  it('initMonitoring rejects so its caller can report the failed init', async () => {
    await expect(
      initMonitoring({ provider: 'sentry-node', dsn: 'https://test@example.com/1' }),
    ).rejects.toThrow();
  });
});
