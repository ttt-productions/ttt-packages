
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('initMonitoring', () => {
    beforeEach(() => {
        vi.resetModules();
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

    it('local-dev gate: NEXT_PUBLIC_SENTRY_ENABLED=false forces NoopAdapter even with sentry provider', async () => {
        const prev = process.env.NEXT_PUBLIC_SENTRY_ENABLED;
        process.env.NEXT_PUBLIC_SENTRY_ENABLED = 'false';
        try {
            const { initMonitoring, getMonitoringAdapter } = await import('../src/init');
            const { NoopAdapter } = await import('../src/adapters/noop');
            await initMonitoring({ provider: 'sentry', enabled: true });
            expect(getMonitoringAdapter()).toBe(NoopAdapter);
        } finally {
            if (prev === undefined) delete process.env.NEXT_PUBLIC_SENTRY_ENABLED;
            else process.env.NEXT_PUBLIC_SENTRY_ENABLED = prev;
        }
    });
});
