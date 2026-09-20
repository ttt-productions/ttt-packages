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

vi.mock('@sentry/nextjs', () => sentryMock);

async function loadInitializedAdapter() {
    const { SentryAdapter } = await import('../src/adapters/sentry');
    await SentryAdapter.init({ provider: 'sentry', dsn: 'https://test@example.com/1', enabled: true });
    return SentryAdapter;
}

/** Let every pending microtask and timer-0 continuation run, so a replay would have fired. */
async function flushPendingWork() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('SentryAdapter (browser) withScope', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('runs fn once through the real Sentry scope once loaded, returning its value', async () => {
        const adapter = await loadInitializedAdapter();

        const fn = vi.fn(() => 'result');
        const result = adapter.withScope!(fn);

        expect(fn).toHaveBeenCalledTimes(1);
        expect(result).toBe('result');
        expect(sentryMock.withScope).toHaveBeenCalledTimes(1);
    });

    it('invokes fn exactly once against the no-op scope pre-load and never replays it after the SDK loads', async () => {
        const { SentryAdapter } = await import('../src/adapters/sentry');

        const fn = vi.fn(() => 'early-result');
        const result = SentryAdapter.withScope!(fn);

        expect(fn).toHaveBeenCalledTimes(1);
        expect(result).toBe('early-result');

        await SentryAdapter.init({ provider: 'sentry', dsn: 'https://test@example.com/1', enabled: true });
        await flushPendingWork();

        expect(fn).toHaveBeenCalledTimes(1);
        expect(sentryMock.withScope).not.toHaveBeenCalled();
    });

    it('returns an async fn\'s promise pre-load and resolves it once', async () => {
        const { SentryAdapter } = await import('../src/adapters/sentry');

        const fn = vi.fn(async () => 'async-result');
        await expect(SentryAdapter.withScope!(fn)).resolves.toBe('async-result');

        await SentryAdapter.init({ provider: 'sentry', dsn: 'https://test@example.com/1', enabled: true });
        await flushPendingWork();

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('rejects the returned promise once when an async fn throws pre-load, with no second un-awaited run', async () => {
        const { SentryAdapter } = await import('../src/adapters/sentry');

        const boom = new Error('boom');
        const fn = vi.fn(async () => {
            throw boom;
        });
        await expect(SentryAdapter.withScope!(fn)).rejects.toBe(boom);

        await SentryAdapter.init({ provider: 'sentry', dsn: 'https://test@example.com/1', enabled: true });
        await flushPendingWork();

        expect(fn).toHaveBeenCalledTimes(1);
    });
});

describe('SentryAdapter (browser) captureException context → tags vs extras', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('applies a flat string `tags` map as REAL tags, not an extra', async () => {
        const adapter = await loadInitializedAdapter();

        adapter.captureException(new Error('boom'), {
            tags: { operation: 'uploadValidation', surface: 'browser' },
        });

        expect(scopeMock.setTag).toHaveBeenCalledTimes(2);
        expect(scopeMock.setTag).toHaveBeenCalledWith('operation', 'uploadValidation');
        expect(scopeMock.setTag).toHaveBeenCalledWith('surface', 'browser');
        expect(scopeMock.setExtra).not.toHaveBeenCalled();
    });

    it('routes level to setLevel and keeps every other non-tags key as an extra', async () => {
        const adapter = await loadInitializedAdapter();

        adapter.captureException(new Error('boom'), {
            level: 'warning',
            tags: { operation: 'uploadValidation' },
            fileId: 'file-1',
        });

        expect(scopeMock.setTag).toHaveBeenCalledTimes(1);
        expect(scopeMock.setTag).toHaveBeenCalledWith('operation', 'uploadValidation');
        expect(scopeMock.setLevel).toHaveBeenCalledWith('warning');
        expect(scopeMock.setExtra).toHaveBeenCalledTimes(1);
        expect(scopeMock.setExtra).toHaveBeenCalledWith('fileId', 'file-1');
    });

    it('leaves a non-flat-string `tags` value as an extra so nothing is dropped', async () => {
        const adapter = await loadInitializedAdapter();

        const tags = { operation: 'x', nested: { a: 1 } };
        adapter.captureException(new Error('boom'), { tags });

        expect(scopeMock.setTag).not.toHaveBeenCalled();
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
        const { SentryAdapter } = await import('../src/adapters/sentry');

        SentryAdapter.captureException(new Error('boom'), { tags: { operation: 'early' } });
        await vi.waitFor(() => expect(sentryMock.captureException).toHaveBeenCalledTimes(1));

        expect(scopeMock.setTag).toHaveBeenCalledWith('operation', 'early');
    });
});

describe('SentryAdapter (browser) captureMessage context → tags vs extras', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('reports message + level unchanged when no context is passed', async () => {
        const adapter = await loadInitializedAdapter();

        adapter.captureMessage('plain', 'info');

        expect(sentryMock.withScope).not.toHaveBeenCalled();
        expect(sentryMock.captureMessage).toHaveBeenCalledTimes(1);
        expect(sentryMock.captureMessage).toHaveBeenCalledWith('plain', 'info');
    });

    it('applies a flat string `tags` map as REAL tags, not an extra', async () => {
        const adapter = await loadInitializedAdapter();

        adapter.captureMessage('degraded', 'warning', {
            tags: { operation: 'rateLimiterUnavailable', surface: 'browser' },
        });

        expect(scopeMock.setTag).toHaveBeenCalledTimes(2);
        expect(scopeMock.setTag).toHaveBeenCalledWith('operation', 'rateLimiterUnavailable');
        expect(scopeMock.setTag).toHaveBeenCalledWith('surface', 'browser');
        expect(scopeMock.setExtra).not.toHaveBeenCalled();
    });

    it('routes a context `level` to setLevel and keeps every other non-tags key as an extra', async () => {
        const adapter = await loadInitializedAdapter();

        adapter.captureMessage('degraded', 'warning', {
            level: 'warning',
            tags: { operation: 'rateLimiterUnavailable' },
            requestId: 'req-1',
        });

        expect(scopeMock.setTag).toHaveBeenCalledTimes(1);
        expect(scopeMock.setTag).toHaveBeenCalledWith('operation', 'rateLimiterUnavailable');
        expect(scopeMock.setLevel).toHaveBeenCalledWith('warning');
        expect(scopeMock.setExtra).toHaveBeenCalledTimes(1);
        expect(scopeMock.setExtra).toHaveBeenCalledWith('requestId', 'req-1');
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

        adapter.captureMessage('degraded', 'warning', { tags: { operation: 'x' } });

        expect(sentryMock.withScope).toHaveBeenCalledTimes(1);
        expect(sentryMock.captureMessage).toHaveBeenCalledTimes(1);
        expect(sentryMock.captureMessage).toHaveBeenCalledWith('degraded', 'warning');
    });

    it('applies context on the no-instance path and still reports exactly once', async () => {
        const { SentryAdapter } = await import('../src/adapters/sentry');

        SentryAdapter.captureMessage('early', 'warning', { tags: { operation: 'early' }, requestId: 'req-1' });
        await vi.waitFor(() => expect(sentryMock.captureMessage).toHaveBeenCalledTimes(1));

        expect(scopeMock.setTag).toHaveBeenCalledWith('operation', 'early');
        expect(scopeMock.setExtra).toHaveBeenCalledWith('requestId', 'req-1');
        expect(sentryMock.withScope).toHaveBeenCalledTimes(1);
        // No double-report: the pre-load branch is the ONLY reporting path taken.
        expect(sentryMock.captureMessage).toHaveBeenCalledTimes(1);
        expect(sentryMock.captureMessage).toHaveBeenCalledWith('early', 'warning');
    });
});
