import { describe, it, expect, beforeEach, vi } from 'vitest';

const sentryMock = {
    init: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    setUser: vi.fn(),
    setTag: vi.fn(),
    withScope: vi.fn((fn: (scope: unknown) => unknown) =>
        fn({ setTag: vi.fn(), setUser: vi.fn(), setExtra: vi.fn(), setContext: vi.fn() })
    ),
    addBreadcrumb: vi.fn(),
};

vi.mock('@sentry/node', () => sentryMock);

describe('SentryNodeAdapter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('withScope calls fn exactly once once Sentry is loaded (regression: used to double-fire)', async () => {
        const { SentryNodeAdapter } = await import('../src/adapters/sentry-node');
        await SentryNodeAdapter.init({ provider: 'sentry-node', dsn: 'https://test@example.com/1', enabled: true });

        const fn = vi.fn(() => 'result');
        const result = SentryNodeAdapter.withScope!(fn);

        expect(fn).toHaveBeenCalledTimes(1);
        expect(result).toBe('result');
        expect(sentryMock.withScope).toHaveBeenCalledTimes(1);
    });

    it('withScope propagates a thrown error synchronously instead of firing an un-awaited async branch', async () => {
        const { SentryNodeAdapter } = await import('../src/adapters/sentry-node');
        await SentryNodeAdapter.init({ provider: 'sentry-node', dsn: 'https://test@example.com/1', enabled: true });

        const boom = new Error('boom');
        expect(() =>
            SentryNodeAdapter.withScope!(() => {
                throw boom;
            })
        ).toThrow(boom);
        expect(sentryMock.withScope).toHaveBeenCalledTimes(1);
    });

    it('captureException forwards exactly once once Sentry is loaded (no duplicate report)', async () => {
        const { SentryNodeAdapter } = await import('../src/adapters/sentry-node');
        await SentryNodeAdapter.init({ provider: 'sentry-node', dsn: 'https://test@example.com/1', enabled: true });

        const err = new Error('boom');
        SentryNodeAdapter.captureException(err);

        expect(sentryMock.captureException).toHaveBeenCalledTimes(1);
        expect(sentryMock.captureException).toHaveBeenCalledWith(err);
    });
});
