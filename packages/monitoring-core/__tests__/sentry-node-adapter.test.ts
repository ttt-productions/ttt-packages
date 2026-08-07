import { describe, it, expect, beforeEach, vi } from 'vitest';

const scopeMock = {
    setTag: vi.fn(),
    setUser: vi.fn(),
    setExtra: vi.fn(),
    setContext: vi.fn(),
    setLevel: vi.fn(),
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

        it('routes level to setLevel and keeps every other non-tags key as an extra', async () => {
            const adapter = await loadInitializedAdapter();

            adapter.captureException(new Error('boom'), {
                level: 'warning',
                tags: { operation: 'maybePublishWordList' },
                extra: { docId: 'doc-1' },
            });

            expect(scopeMock.setTag).toHaveBeenCalledTimes(1);
            expect(scopeMock.setTag).toHaveBeenCalledWith('operation', 'maybePublishWordList');
            expect(scopeMock.setLevel).toHaveBeenCalledWith('warning');
            expect(scopeMock.setExtra).toHaveBeenCalledTimes(1);
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

    describe('captureMessage context → tags vs extras', () => {
        it('reports message + level unchanged when no context is passed', async () => {
            const adapter = await loadInitializedAdapter();

            adapter.captureMessage('plain', 'info');

            expect(sentryMock.withScope).not.toHaveBeenCalled();
            expect(sentryMock.captureMessage).toHaveBeenCalledTimes(1);
            expect(sentryMock.captureMessage).toHaveBeenCalledWith('plain', 'info');
        });

        it('applies a flat string `tags` map as REAL tags, not an extra', async () => {
            const adapter = await loadInitializedAdapter();

            adapter.captureMessage('limiter unavailable', 'error', {
                tags: { operation: 'takeItDownRateLimit', lane: 'ncii' },
            });

            expect(scopeMock.setTag).toHaveBeenCalledTimes(2);
            expect(scopeMock.setTag).toHaveBeenCalledWith('operation', 'takeItDownRateLimit');
            expect(scopeMock.setTag).toHaveBeenCalledWith('lane', 'ncii');
            expect(scopeMock.setExtra).not.toHaveBeenCalled();
        });

        it('routes a context `level` to setLevel and keeps every other non-tags key as an extra', async () => {
            const adapter = await loadInitializedAdapter();

            adapter.captureMessage('limiter unavailable', 'error', {
                level: 'warning',
                tags: { operation: 'takeItDownRateLimit' },
                extra: { docId: 'doc-1' },
            });

            expect(scopeMock.setTag).toHaveBeenCalledTimes(1);
            expect(scopeMock.setTag).toHaveBeenCalledWith('operation', 'takeItDownRateLimit');
            expect(scopeMock.setLevel).toHaveBeenCalledWith('warning');
            expect(scopeMock.setExtra).toHaveBeenCalledTimes(1);
            expect(scopeMock.setExtra).toHaveBeenCalledWith('extra', { docId: 'doc-1' });
        });

        it('leaves a non-flat-string `tags` value as an extra so nothing is dropped', async () => {
            const adapter = await loadInitializedAdapter();

            const tags = { operation: 'x', attempt: 3 };
            adapter.captureMessage('note', 'info', { tags });

            expect(scopeMock.setTag).not.toHaveBeenCalled();
            expect(scopeMock.setExtra).toHaveBeenCalledTimes(1);
            expect(scopeMock.setExtra).toHaveBeenCalledWith('tags', tags);
        });

        it('leaves an unrecognized `level` value as an extra', async () => {
            const adapter = await loadInitializedAdapter();

            adapter.captureMessage('note', 'info', { level: 'catastrophe' });

            expect(scopeMock.setLevel).not.toHaveBeenCalled();
            expect(scopeMock.setExtra).toHaveBeenCalledWith('level', 'catastrophe');
        });

        it('reports exactly once with the context applied, keeping the explicit level argument', async () => {
            const adapter = await loadInitializedAdapter();

            adapter.captureMessage('limiter unavailable', 'error', { tags: { operation: 'x' } });

            expect(sentryMock.withScope).toHaveBeenCalledTimes(1);
            expect(sentryMock.captureMessage).toHaveBeenCalledTimes(1);
            expect(sentryMock.captureMessage).toHaveBeenCalledWith('limiter unavailable', 'error');
        });

        it('applies context on the no-instance path and still reports exactly once', async () => {
            const { SentryNodeAdapter } = await import('../src/adapters/sentry-node');

            SentryNodeAdapter.captureMessage('early', 'warning', {
                tags: { operation: 'early' },
                docId: 'doc-1',
            });
            await vi.waitFor(() => expect(sentryMock.captureMessage).toHaveBeenCalledTimes(1));

            expect(scopeMock.setTag).toHaveBeenCalledWith('operation', 'early');
            expect(scopeMock.setExtra).toHaveBeenCalledWith('docId', 'doc-1');
            expect(sentryMock.withScope).toHaveBeenCalledTimes(1);
            // No double-report: the pre-load branch is the ONLY reporting path taken.
            expect(sentryMock.captureMessage).toHaveBeenCalledTimes(1);
            expect(sentryMock.captureMessage).toHaveBeenCalledWith('early', 'warning');
        });
    });
});
