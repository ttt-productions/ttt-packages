
import { describe, it, expect, vi } from 'vitest';
import { NoopAdapter } from '../src/adapters/noop';

describe('NoopAdapter', () => {
    it('captureException accepts any value without side effects on context', () => {
        const ctx = { userId: '123' };
        NoopAdapter.captureException(new Error('test'), ctx);
        // No-op contract: context object must not be mutated by the adapter.
        expect(ctx).toEqual({ userId: '123' });
    });

    it('captureMessage accepts every supported level', () => {
        const levels = ['fatal', 'error', 'warning', 'info', 'debug'] as const;
        for (const level of levels) {
            // No throw, no return value contract — just verify each level is callable.
            expect(NoopAdapter.captureMessage('m', level)).toBeUndefined();
        }
    });

    it('setUser accepts a populated user and null', () => {
        expect(NoopAdapter.setUser({ id: 'uid-123' })).toBeUndefined();
        expect(NoopAdapter.setUser(null)).toBeUndefined();
    });

    it('setTag accepts arbitrary key/value pairs', () => {
        expect(NoopAdapter.setTag('env', 'production')).toBeUndefined();
    });

    it('withScope invokes the callback exactly once and returns its result', () => {
        const cb = vi.fn(() => 'result-value');
        const out = NoopAdapter.withScope?.(cb);
        expect(cb).toHaveBeenCalledTimes(1);
        expect(out).toBe('result-value');
    });

    it('withScope exposes a scope with no-op setTag/setUser/setExtra/setContext that return undefined', () => {
        NoopAdapter.withScope?.((scope) => {
            expect(scope.setTag('k', 'v')).toBeUndefined();
            expect(scope.setUser({ id: 'uid' })).toBeUndefined();
            expect(scope.setExtra('k', 'v')).toBeUndefined();
            expect(scope.setContext('k', { a: 1 })).toBeUndefined();
        });
    });

    it('withScope scope is stable across calls to its methods (no exceptions on repeated use)', () => {
        NoopAdapter.withScope?.((scope) => {
            for (let i = 0; i < 5; i++) {
                scope.setTag(`k${i}`, `v${i}`);
            }
        });
    });

    it('addBreadcrumb accepts a full breadcrumb shape without mutating it', () => {
        const crumb = {
            category: 'navigation',
            message: 'Page loaded',
            level: 'info' as const,
            data: { from: '/login' },
        };
        const snapshot = JSON.stringify(crumb);
        NoopAdapter.addBreadcrumb?.(crumb);
        expect(JSON.stringify(crumb)).toBe(snapshot);
    });

    it('init returns synchronously and accepts a minimal options object', () => {
        // The noop init contract: synchronous, no return value.
        const result = NoopAdapter.init({ provider: 'noop' });
        expect(result).toBeUndefined();
    });
});
