// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@sentry/node', () => ({
    init: () => {
        throw new Error('invalid option');
    },
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    setUser: vi.fn(),
    setTag: vi.fn(),
    withScope: vi.fn(),
    addBreadcrumb: vi.fn(),
}));
vi.mock('@sentry/nextjs', () => ({
    init: vi.fn(),
    captureException: () => {
        throw new Error('transport fault');
    },
    captureMessage: vi.fn(),
    setUser: vi.fn(),
    setTag: vi.fn(),
    withScope: vi.fn(),
    addBreadcrumb: vi.fn(),
}));

const DSN = 'https://test@example.com/1';

describe('a Sentry SDK that loads but cannot take the call', () => {
    let consoleError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.resetModules();
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    it('reports a call that waited on a failed SDK init as an init failure, not a load failure', async () => {
        const { SentryNodeAdapter } = await import('../src/adapters/sentry-node');
        const ready = SentryNodeAdapter.init({ provider: 'sentry-node', dsn: DSN });
        SentryNodeAdapter.captureException(new Error('boom'));
        await expect(ready).rejects.toThrow('invalid option');

        await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
        expect(String(consoleError.mock.calls[0][0])).toBe(
            '[monitoring-core] captureException was not delivered: the monitoring SDK failed to initialize',
        );
    });

    it('keeps naming the init failure for every later call', async () => {
        const { SentryNodeAdapter } = await import('../src/adapters/sentry-node');
        await expect(SentryNodeAdapter.init({ provider: 'sentry-node', dsn: DSN })).rejects.toThrow();

        SentryNodeAdapter.captureMessage('later', 'info');
        SentryNodeAdapter.setTag('k', 'v');

        await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(2));
        const reported = consoleError.mock.calls.map((call: unknown[]) => String(call[0]));
        expect(reported).toEqual([
            '[monitoring-core] captureMessage was not delivered: the monitoring SDK failed to initialize',
            '[monitoring-core] setTag was not delivered: the monitoring SDK failed to initialize',
        ]);
    });

    it('reports an SDK that throws on a waiting call as a throw, not a load failure', async () => {
        const { SentryAdapter } = await import('../src/adapters/sentry');
        const ready = SentryAdapter.init({ provider: 'sentry', dsn: DSN });
        SentryAdapter.captureException(new Error('boom'));
        await ready;

        await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
        expect(String(consoleError.mock.calls[0][0])).toBe(
            '[monitoring-core] captureException was not delivered: the monitoring SDK threw',
        );
    });
});
