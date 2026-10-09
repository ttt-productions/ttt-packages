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

/** Let every pending microtask and timer-0 continuation run. */
async function flushPendingWork() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('initMonitoring', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('getMonitoringAdapter returns the NoopAdapter singleton before any init', async () => {
        const { getMonitoringAdapter } = await import('../src/init');
        const { NoopAdapter } = await import('../src/adapters/noop');
        expect(getMonitoringAdapter()).toBe(NoopAdapter);
    });

    it('initializes with noop provider, enabled: true, installs the NoopAdapter', async () => {
        const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
        const { NoopAdapter } = await import('../src/adapters/noop');
        await initMonitoring({ provider: 'noop', enabled: true });
        expect(getMonitoringAdapter()).toBe(NoopAdapter);
    });

    it('initializes with noop provider, enabled: false, installs the NoopAdapter', async () => {
        const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
        const { NoopAdapter } = await import('../src/adapters/noop');
        await initMonitoring({ provider: 'noop', enabled: false });
        expect(getMonitoringAdapter()).toBe(NoopAdapter);
    });

    it('re-init with same options is a no-op (does not swap the adapter reference)', async () => {
        const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
        const opts = { provider: 'noop' as const };
        await initMonitoring(opts);
        const first = getMonitoringAdapter();
        await initMonitoring(opts);
        expect(getMonitoringAdapter()).toBe(first);
    });

    it('re-init with different options reinitializes and ends on the noop adapter', async () => {
        const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
        const { NoopAdapter } = await import('../src/adapters/noop');
        await initMonitoring({ provider: 'noop', environment: 'test' });
        await initMonitoring({ provider: 'noop', environment: 'prod' });
        expect(getMonitoringAdapter()).toBe(NoopAdapter);
    });

    it('force=true reinitializes even with same options and keeps the noop adapter installed', async () => {
        const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
        const { NoopAdapter } = await import('../src/adapters/noop');
        const opts = { provider: 'noop' as const };
        await initMonitoring(opts);
        await initMonitoring(opts, true);
        expect(getMonitoringAdapter()).toBe(NoopAdapter);
    });

    it('setMonitoringAdapter installs the given adapter and getMonitoringAdapter returns it', async () => {
        const { getMonitoringAdapter, setMonitoringAdapter } = await import('../src/init');
        const fake = {
            init: vi.fn(),
            captureException: vi.fn(),
            captureMessage: vi.fn(),
            setUser: vi.fn(),
            setTag: vi.fn(),
        };
        setMonitoringAdapter(fake);
        expect(getMonitoringAdapter()).toBe(fake);
    });

    it('resetMonitoringAdapter restores the NoopAdapter singleton', async () => {
        const { getMonitoringAdapter, setMonitoringAdapter, resetMonitoringAdapter } =
            await import('../src/init');
        const { NoopAdapter } = await import('../src/adapters/noop');
        const fake = {
            init: vi.fn(),
            captureException: vi.fn(),
            captureMessage: vi.fn(),
            setUser: vi.fn(),
            setTag: vi.fn(),
        };
        setMonitoringAdapter(fake);
        expect(getMonitoringAdapter()).toBe(fake);
        resetMonitoringAdapter();
        expect(getMonitoringAdapter()).toBe(NoopAdapter);
    });

    it('initMonitoring after setMonitoringAdapter re-installs the configured adapter (no stale-options short circuit)', async () => {
        const { initMonitoring, getMonitoringAdapter, setMonitoringAdapter } =
            await import('../src/init');
        const { NoopAdapter } = await import('../src/adapters/noop');
        const fake = {
            init: vi.fn(),
            captureException: vi.fn(),
            captureMessage: vi.fn(),
            setUser: vi.fn(),
            setTag: vi.fn(),
        };
        setMonitoringAdapter(fake);
        // setMonitoringAdapter clears currentOptions, so this initMonitoring
        // call must run end-to-end and install the NoopAdapter.
        await initMonitoring({ provider: 'noop' });
        expect(getMonitoringAdapter()).toBe(NoopAdapter);
    });

    it('local-dev gate: NEXT_PUBLIC_USE_EMULATORS=true forces NoopAdapter even with sentry provider', async () => {
        const prev = process.env.NEXT_PUBLIC_USE_EMULATORS;
        process.env.NEXT_PUBLIC_USE_EMULATORS = 'true';
        try {
            const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
            const { NoopAdapter } = await import('../src/adapters/noop');
            await initMonitoring({ provider: 'sentry', enabled: true });
            expect(getMonitoringAdapter()).toBe(NoopAdapter);
        } finally {
            if (prev === undefined) delete process.env.NEXT_PUBLIC_USE_EMULATORS;
            else process.env.NEXT_PUBLIC_USE_EMULATORS = prev;
        }
    });

    it('local-dev gate: FUNCTIONS_EMULATOR=true forces NoopAdapter even with sentry-node provider', async () => {
        const prev = process.env.FUNCTIONS_EMULATOR;
        process.env.FUNCTIONS_EMULATOR = 'true';
        try {
            const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
            const { NoopAdapter } = await import('../src/adapters/noop');
            await initMonitoring({ provider: 'sentry-node', enabled: true });
            expect(getMonitoringAdapter()).toBe(NoopAdapter);
        } finally {
            if (prev === undefined) delete process.env.FUNCTIONS_EMULATOR;
            else process.env.FUNCTIONS_EMULATOR = prev;
        }
    });
});

describe('initMonitoring — the DSN is the only switch', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('NEXT_PUBLIC_SENTRY_ENABLED=false does not silence a configured provider', async () => {
        const prev = process.env.NEXT_PUBLIC_SENTRY_ENABLED;
        process.env.NEXT_PUBLIC_SENTRY_ENABLED = 'false';
        try {
            const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
            const { NoopAdapter } = await import('../src/adapters/noop');
            await initMonitoring({ provider: 'sentry', dsn: DSN });
            expect(getMonitoringAdapter()).not.toBe(NoopAdapter);
            expect(browserSdk.init).toHaveBeenCalledTimes(1);
        } finally {
            if (prev === undefined) delete process.env.NEXT_PUBLIC_SENTRY_ENABLED;
            else process.env.NEXT_PUBLIC_SENTRY_ENABLED = prev;
        }
    });

    it('a provider with no DSN initializes no SDK', async () => {
        const { initMonitoring } = await import('../src/init');
        await initMonitoring({ provider: 'sentry-node' });
        expect(nodeSdk.init).not.toHaveBeenCalled();
    });
});

describe('initMonitoring — init-time hooks and the startup window', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it.each([
        ['sentry' as const, browserSdk],
        ['sentry-node' as const, nodeSdk],
    ])('passes beforeSend, beforeSendTransaction, and the integration options into the %s SDK init', async (provider, sdk) => {
        const { initMonitoring } = await import('../src/init');
        const beforeSend = vi.fn((event) => event);
        const beforeSendTransaction = vi.fn((event) => event);
        const integrations = [{ name: 'Dedupe' }];
        await initMonitoring({ provider, dsn: DSN, beforeSend, beforeSendTransaction, defaultIntegrations: false, integrations });

        expect(sdk.init).toHaveBeenCalledTimes(1);
        const sdkOptions = sdk.init.mock.calls[0][0];
        expect(sdkOptions.beforeSend).toBe(beforeSend);
        expect(sdkOptions.beforeSendTransaction).toBe(beforeSendTransaction);
        expect(sdkOptions.defaultIntegrations).toBe(false);
        expect(sdkOptions.integrations).toBe(integrations);
        expect(sdkOptions.dsn).toBe(DSN);
    });

    it.each([
        ['sentry' as const, browserSdk],
        ['sentry-node' as const, nodeSdk],
    ])('passes ignoreErrors and transport into the %s SDK init', async (provider, sdk) => {
        const { initMonitoring } = await import('../src/init');
        const ignoreErrors = ['ResizeObserver loop limit exceeded', /^Failed to fetch$/];
        const transport = vi.fn();
        await initMonitoring({ provider, dsn: DSN, ignoreErrors, transport });

        expect(sdk.init).toHaveBeenCalledTimes(1);
        const sdkOptions = sdk.init.mock.calls[0][0];
        expect(sdkOptions.ignoreErrors).toBe(ignoreErrors);
        expect(sdkOptions.transport).toBe(transport);
    });

    it('offlineTransport: the browser init sends through the SDK offline transport over its own fetch transport', async () => {
        const { initMonitoring } = await import('../src/init');
        const fetchTransport = vi.fn();
        const offline = vi.fn();
        const makeBrowserOfflineTransport = vi.fn(() => offline);
        Object.assign(browserSdk, { makeFetchTransport: fetchTransport, makeBrowserOfflineTransport });
        try {
            await initMonitoring({ provider: 'sentry', dsn: DSN, offlineTransport: true });
            expect(makeBrowserOfflineTransport).toHaveBeenCalledWith(fetchTransport);
            const sdkOptions = browserSdk.init.mock.calls[0][0];
            expect(sdkOptions.transport).toBe(offline);
            expect(sdkOptions).not.toHaveProperty('offlineTransport');
        } finally {
            delete (browserSdk as Record<string, unknown>).makeFetchTransport;
            delete (browserSdk as Record<string, unknown>).makeBrowserOfflineTransport;
        }
    });

    it('offlineTransport: an SDK without the browser transports fails the init instead of sending unqueued', async () => {
        const { initMonitoring } = await import('../src/init');
        Object.assign(browserSdk, { makeFetchTransport: undefined, makeBrowserOfflineTransport: undefined });
        try {
            await expect(initMonitoring({ provider: 'sentry', dsn: DSN, offlineTransport: true })).rejects.toThrow(/offlineTransport/);
            expect(browserSdk.init).not.toHaveBeenCalled();
        } finally {
            delete (browserSdk as Record<string, unknown>).makeFetchTransport;
            delete (browserSdk as Record<string, unknown>).makeBrowserOfflineTransport;
        }
    });

    it('offlineTransport: refused beside transport, and on the Node provider', async () => {
        const { initMonitoring } = await import('../src/init');
        await expect(
            initMonitoring({ provider: 'sentry', dsn: DSN, offlineTransport: true, transport: vi.fn() }),
        ).rejects.toThrow(/cannot be combined with transport/);
        await expect(initMonitoring({ provider: 'sentry-node', dsn: DSN, offlineTransport: true })).rejects.toThrow(
            /browser option/,
        );
        expect(nodeSdk.init).not.toHaveBeenCalled();
    });

    it('re-initializes when only an ignoreErrors pattern changes', async () => {
        const { initMonitoring } = await import('../src/init');
        await initMonitoring({ provider: 'sentry-node', dsn: DSN, ignoreErrors: [/^Load failed$/] });
        await initMonitoring({ provider: 'sentry-node', dsn: DSN, ignoreErrors: [/^Failed to fetch$/] });
        await initMonitoring({ provider: 'sentry-node', dsn: DSN, ignoreErrors: [/^Failed to fetch$/i] });

        expect(nodeSdk.init).toHaveBeenCalledTimes(3);
        expect(nodeSdk.init.mock.calls[2][0].ignoreErrors[0].flags).toBe('i');
    });

    it('does not re-initialize for an equal ignoreErrors list', async () => {
        const { initMonitoring } = await import('../src/init');
        await initMonitoring({ provider: 'sentry-node', dsn: DSN, ignoreErrors: ['Load failed', /^Failed to fetch$/] });
        await initMonitoring({ provider: 'sentry-node', dsn: DSN, ignoreErrors: ['Load failed', /^Failed to fetch$/] });

        expect(nodeSdk.init).toHaveBeenCalledTimes(1);
    });

    it('leaves out of the SDK init every hook the caller did not set', async () => {
        const { initMonitoring } = await import('../src/init');
        await initMonitoring({ provider: 'sentry-node', dsn: DSN });
        const sdkOptions = nodeSdk.init.mock.calls[0][0];
        for (const key of ['beforeSend', 'beforeSendTransaction', 'defaultIntegrations', 'integrations', 'tracesSampleRate', 'ignoreErrors', 'transport']) {
            expect(sdkOptions).not.toHaveProperty(key);
        }
    });

    it.each([
        ['sentry' as const, browserSdk],
        ['sentry-node' as const, nodeSdk],
    ])('a %s capture issued while the SDK loads is delivered after the SDK init, not dropped', async (provider, sdk) => {
        const { initMonitoring, captureException, captureMessage } = await import('../src/init').then(async (init) => ({
            ...init,
            ...(await import('../src/api')),
        }));
        const early = new Error('during startup');

        const ready = initMonitoring({ provider, dsn: DSN });
        captureException(early);
        captureMessage('startup note', 'warning');
        await ready;
        await flushPendingWork();

        expect(sdk.captureException).toHaveBeenCalledTimes(1);
        expect(sdk.captureException).toHaveBeenCalledWith(early);
        expect(sdk.captureMessage).toHaveBeenCalledWith('startup note', 'warning');
        expect(sdk.init.mock.invocationCallOrder[0]).toBeLessThan(sdk.captureException.mock.invocationCallOrder[0]);
    });

    it('re-initializes when only a function-valued option changes', async () => {
        const { initMonitoring } = await import('../src/init');
        const first = vi.fn((event) => event);
        const second = vi.fn(() => null);
        await initMonitoring({ provider: 'sentry-node', dsn: DSN, beforeSend: first });
        await initMonitoring({ provider: 'sentry-node', dsn: DSN, beforeSend: second });

        expect(nodeSdk.init).toHaveBeenCalledTimes(2);
        expect(nodeSdk.init.mock.calls[1][0].beforeSend).toBe(second);
    });

    it('does not re-initialize for the same options, hook references included', async () => {
        const { initMonitoring } = await import('../src/init');
        const beforeSend = vi.fn((event) => event);
        await initMonitoring({ provider: 'sentry-node', dsn: DSN, beforeSend, integrations: [] });
        await initMonitoring({ provider: 'sentry-node', dsn: DSN, beforeSend, integrations: [] });

        expect(nodeSdk.init).toHaveBeenCalledTimes(1);
    });
});
