// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@sentry/node', () => {
    throw new Error('sdk failed to load');
});
vi.mock('@sentry/nextjs', () => {
    throw new Error('sdk failed to load');
});

describe('a Sentry SDK that fails to load', () => {
    let consoleError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.resetModules();
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    it.each([
        ['SentryNodeAdapter', '../src/adapters/sentry-node'],
        ['SentryAdapter', '../src/adapters/sentry'],
    ])('%s reports each undelivered call on the console instead of an unhandled rejection', async (name, path) => {
        const adapter = (await import(path))[name];

        adapter.captureException(new Error('boom'));
        adapter.captureMessage('note', 'info');
        adapter.setTag('k', 'v');
        adapter.setUser({ id: 'u1' });
        adapter.addBreadcrumb({ message: 'crumb' });
        await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(5));

        const reported = consoleError.mock.calls.map((call: unknown[]) => String(call[0]));
        for (const operation of ['captureException', 'captureMessage', 'setTag', 'setUser', 'addBreadcrumb']) {
            expect(reported).toContain(`[monitoring-core] ${operation} was not delivered: the monitoring SDK did not load`);
        }
    });

    it('initMonitoring rejects so its caller can report the failed init', async () => {
        const { initMonitoring } = await import('../src/init');
        await expect(initMonitoring({ provider: 'sentry-node', dsn: 'https://test@example.com/1' })).rejects.toThrow();
    });
});
