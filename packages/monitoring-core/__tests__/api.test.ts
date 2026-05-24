
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    captureException,
    captureMessage,
    setUser,
    setTag,
    withScope,
    addBreadcrumb,
} from '../src/api';
import { setMonitoringAdapter, resetMonitoringAdapter } from '../src/init';
import type { MonitoringAdapter } from '../src/adapter';
import type { ScopeLike } from '../src/types';

function makeRecordingAdapter() {
    const recordingScope: ScopeLike = {
        setTag: vi.fn(),
        setUser: vi.fn(),
        setExtra: vi.fn(),
        setContext: vi.fn(),
    };

    const adapter: MonitoringAdapter & {
        // for assertions on the fake itself
        _scope: ScopeLike;
    } = {
        init: vi.fn(),
        captureException: vi.fn(),
        captureMessage: vi.fn(),
        setUser: vi.fn(),
        setTag: vi.fn(),
        withScope: vi.fn((fn: (s: ScopeLike) => unknown) => fn(recordingScope)) as <T>(fn: (scope: ScopeLike) => T) => T,
        addBreadcrumb: vi.fn(),
        _scope: recordingScope,
    };

    return adapter;
}

describe('monitoring-core api forwarding', () => {
    let fake: ReturnType<typeof makeRecordingAdapter>;

    beforeEach(() => {
        fake = makeRecordingAdapter();
        setMonitoringAdapter(fake);
    });

    afterEach(() => {
        resetMonitoringAdapter();
    });

    describe('captureException', () => {
        it('forwards the error to the adapter', () => {
            const err = new Error('boom');
            captureException(err);
            expect(fake.captureException).toHaveBeenCalledTimes(1);
            expect(fake.captureException).toHaveBeenCalledWith(err, undefined);
        });

        it('forwards the context when provided', () => {
            const ctx = { userId: 'abc', action: 'upload' };
            captureException('string error', ctx);
            expect(fake.captureException).toHaveBeenCalledWith('string error', ctx);
        });

        it('forwards null without mutating it', () => {
            captureException(null);
            expect(fake.captureException).toHaveBeenCalledWith(null, undefined);
        });
    });

    describe('captureMessage', () => {
        it('forwards the message and level', () => {
            captureMessage('hello world', 'info');
            expect(fake.captureMessage).toHaveBeenCalledTimes(1);
            expect(fake.captureMessage).toHaveBeenCalledWith('hello world', 'info');
        });

        it('omits the level when not provided', () => {
            captureMessage('plain message');
            expect(fake.captureMessage).toHaveBeenCalledWith('plain message', undefined);
        });
    });

    describe('setUser', () => {
        it('forwards a populated user', () => {
            const u = { id: 'uid-123', email: 'test@example.com' };
            setUser(u);
            expect(fake.setUser).toHaveBeenCalledWith(u);
        });

        it('forwards null to clear the user', () => {
            setUser(null);
            expect(fake.setUser).toHaveBeenCalledWith(null);
        });
    });

    describe('setTag', () => {
        it('forwards key and value', () => {
            setTag('environment', 'production');
            expect(fake.setTag).toHaveBeenCalledWith('environment', 'production');
        });
    });

    describe('withScope', () => {
        it('delegates to the adapter and returns the callback result', () => {
            const result = withScope(() => 42);
            expect(fake.withScope).toHaveBeenCalledTimes(1);
            expect(result).toBe(42);
        });

        it('passes the adapter scope to the callback so scope mutations forward', () => {
            withScope((scope) => {
                scope.setTag('k', 'v');
                scope.setUser({ id: 'uid' });
            });
            expect(fake._scope.setTag).toHaveBeenCalledWith('k', 'v');
            expect(fake._scope.setUser).toHaveBeenCalledWith({ id: 'uid' });
        });

        it('falls back to a synthetic scope when the adapter omits withScope', () => {
            const adapterWithoutScope: MonitoringAdapter = {
                init: vi.fn(),
                captureException: vi.fn(),
                captureMessage: vi.fn(),
                setUser: vi.fn(),
                setTag: vi.fn(),
            };
            setMonitoringAdapter(adapterWithoutScope);

            const result = withScope((scope) => {
                // Synthetic scope: methods exist and are no-ops, scope-level
                // calls do NOT forward to the adapter's top-level methods.
                scope.setTag('k', 'v');
                scope.setUser({ id: 'uid' });
                return 'ok';
            });

            expect(result).toBe('ok');
            expect(adapterWithoutScope.setTag).not.toHaveBeenCalled();
            expect(adapterWithoutScope.setUser).not.toHaveBeenCalled();
        });
    });

    describe('addBreadcrumb', () => {
        it('forwards the breadcrumb when the adapter supports it', () => {
            const crumb = {
                category: 'navigation',
                message: 'User navigated to /home',
                level: 'info' as const,
                data: { from: '/login' },
            };
            addBreadcrumb(crumb);
            expect(fake.addBreadcrumb).toHaveBeenCalledTimes(1);
            expect(fake.addBreadcrumb).toHaveBeenCalledWith(crumb);
        });

        it('is a silent no-op when the adapter omits addBreadcrumb', () => {
            const adapterWithoutCrumbs: MonitoringAdapter = {
                init: vi.fn(),
                captureException: vi.fn(),
                captureMessage: vi.fn(),
                setUser: vi.fn(),
                setTag: vi.fn(),
            };
            setMonitoringAdapter(adapterWithoutCrumbs);

            expect(() => addBreadcrumb({ message: 'whatever' })).not.toThrow();
            // No top-level adapter call should have been used as a fallback.
            expect(adapterWithoutCrumbs.captureMessage).not.toHaveBeenCalled();
        });
    });
});
