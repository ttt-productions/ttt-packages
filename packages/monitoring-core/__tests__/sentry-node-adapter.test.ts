import { describe, it, expect, beforeEach, vi } from 'vitest';

const scopeMock = {
    setTag: vi.fn(),
    setUser: vi.fn(),
    setExtra: vi.fn(),
    setContext: vi.fn(),
};

const sentryMock = {
    init: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    setUser: vi.fn(),
    setTag: vi.fn(),
    withScope: vi.fn((fn: (scope: unknown) => unknown) => fn(scopeMock)),
    addBreadcrumb: vi.fn(),
};

vi.mock('@sentry/node', () => sentryMock);

async function loadInitializedAdapter() {
    const { SentryNodeAdapter } = await import('../src/adapters/sentry-node');
    await SentryNodeAdapter.init({ provider: 'sentry-node', dsn: 'https://test@example.com/1', enabled: true });
    return SentryNodeAdapter;
}

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

    describe('captureException context → tags vs extras', () => {
        it('applies a flat string `tags` map as REAL tags, not an extra', async () => {
            const adapter = await loadInitializedAdapter();

            adapter.captureException(new Error('boom'), {
                tags: { operation: 'nciiDeadlineMonitor', lane: 'ncii' },
            });

            expect(scopeMock.setTag).toHaveBeenCalledTimes(2);
            expect(scopeMock.setTag).toHaveBeenCalledWith('operation', 'nciiDeadlineMonitor');
            expect(scopeMock.setTag).toHaveBeenCalledWith('lane', 'ncii');
            expect(scopeMock.setExtra).not.toHaveBeenCalled();
        });

        it('keeps every non-tags context key as an extra', async () => {
            const adapter = await loadInitializedAdapter();

            adapter.captureException(new Error('boom'), {
                level: 'warning',
                tags: { operation: 'maybePublishWordList' },
                extra: { docId: 'doc-1' },
            });

            expect(scopeMock.setTag).toHaveBeenCalledTimes(1);
            expect(scopeMock.setTag).toHaveBeenCalledWith('operation', 'maybePublishWordList');
            expect(scopeMock.setExtra).toHaveBeenCalledTimes(2);
            expect(scopeMock.setExtra).toHaveBeenCalledWith('level', 'warning');
            expect(scopeMock.setExtra).toHaveBeenCalledWith('extra', { docId: 'doc-1' });
        });

        it('leaves a non-flat-string `tags` value as an extra so nothing is dropped', async () => {
            const adapter = await loadInitializedAdapter();

            const tags = { operation: 'x', attempt: 3 };
            adapter.captureException(new Error('boom'), { tags });

            expect(scopeMock.setTag).not.toHaveBeenCalled();
            expect(scopeMock.setExtra).toHaveBeenCalledTimes(1);
            expect(scopeMock.setExtra).toHaveBeenCalledWith('tags', tags);
        });

        it('captures exactly once with the context applied', async () => {
            const adapter = await loadInitializedAdapter();

            const err = new Error('boom');
            adapter.captureException(err, { tags: { operation: 'x' } });

            expect(sentryMock.withScope).toHaveBeenCalledTimes(1);
            expect(sentryMock.captureException).toHaveBeenCalledTimes(1);
            expect(sentryMock.captureException).toHaveBeenCalledWith(err);
        });

        it('applies tags on the pre-load path too (context arrives before the SDK resolves)', async () => {
            const { SentryNodeAdapter } = await import('../src/adapters/sentry-node');

            SentryNodeAdapter.captureException(new Error('boom'), { tags: { operation: 'early' } });
            await vi.waitFor(() => expect(sentryMock.captureException).toHaveBeenCalledTimes(1));

            expect(scopeMock.setTag).toHaveBeenCalledWith('operation', 'early');
        });
    });
});
