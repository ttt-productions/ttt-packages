import { describe, it, expect, vi } from 'vitest';
import { applyCaptureContext, asFlatStringTagMap, asMonitoringLevel } from '../src/capture-context';

function makeScope() {
    return {
        setTag: vi.fn(),
        setUser: vi.fn(),
        setExtra: vi.fn(),
        setContext: vi.fn(),
        setLevel: vi.fn(),
    };
}

describe('asFlatStringTagMap', () => {
    it('accepts a flat string map', () => {
        expect(asFlatStringTagMap({ operation: 'x', lane: 'ncii' })).toEqual({ operation: 'x', lane: 'ncii' });
    });

    it('accepts an empty object (no tags, no information lost)', () => {
        expect(asFlatStringTagMap({})).toEqual({});
    });

    it('rejects a map with any non-string value', () => {
        expect(asFlatStringTagMap({ operation: 'x', attempt: 3 })).toBeNull();
        expect(asFlatStringTagMap({ operation: 'x', nested: { a: 'b' } })).toBeNull();
        expect(asFlatStringTagMap({ operation: 'x', flag: true })).toBeNull();
        expect(asFlatStringTagMap({ operation: 'x', missing: undefined })).toBeNull();
    });

    it('rejects non-object values', () => {
        expect(asFlatStringTagMap(null)).toBeNull();
        expect(asFlatStringTagMap(undefined)).toBeNull();
        expect(asFlatStringTagMap('operation')).toBeNull();
        expect(asFlatStringTagMap(['operation'])).toBeNull();
    });
});

describe('asMonitoringLevel', () => {
    it('accepts every severity name', () => {
        for (const level of ['fatal', 'error', 'warning', 'info', 'debug']) {
            expect(asMonitoringLevel(level)).toBe(level);
        }
    });

    it('rejects anything else', () => {
        expect(asMonitoringLevel('critical')).toBeNull();
        expect(asMonitoringLevel('ERROR')).toBeNull();
        expect(asMonitoringLevel(3)).toBeNull();
        expect(asMonitoringLevel(undefined)).toBeNull();
    });
});

describe('applyCaptureContext', () => {
    it('routes a flat string `tags` map to setTag, `level` to setLevel, everything else to setExtra', () => {
        const scope = makeScope();

        applyCaptureContext(scope, {
            tags: { operation: 'runPublishApprovedHallLibraryItem.audit', action: 'approve' },
            level: 'warning',
            extra: { itemId: 'item-1' },
        });

        expect(scope.setTag.mock.calls).toEqual([
            ['operation', 'runPublishApprovedHallLibraryItem.audit'],
            ['action', 'approve'],
        ]);
        expect(scope.setLevel.mock.calls).toEqual([['warning']]);
        expect(scope.setExtra.mock.calls).toEqual([['extra', { itemId: 'item-1' }]]);
    });

    it('leaves an unrecognized `level` as an extra so nothing is dropped', () => {
        const scope = makeScope();
        applyCaptureContext(scope, { level: 'critical' });
        expect(scope.setLevel).not.toHaveBeenCalled();
        expect(scope.setExtra.mock.calls).toEqual([['level', 'critical']]);
    });

    it('falls back to an extra when the scope cannot set a level', () => {
        const scope = { setTag: vi.fn(), setExtra: vi.fn() };
        applyCaptureContext(scope, { level: 'warning' });
        expect(scope.setExtra.mock.calls).toEqual([['level', 'warning']]);
    });

    it('falls back to an extra when `tags` is not a flat string map', () => {
        const scope = makeScope();
        const tags = { operation: 'x', attempt: 3 };

        applyCaptureContext(scope, { tags });

        expect(scope.setTag).not.toHaveBeenCalled();
        expect(scope.setExtra.mock.calls).toEqual([['tags', tags]]);
    });

    it('emits neither a tag nor an extra for an empty `tags` map', () => {
        const scope = makeScope();

        applyCaptureContext(scope, { tags: {} });

        expect(scope.setTag).not.toHaveBeenCalled();
        expect(scope.setExtra).not.toHaveBeenCalled();
    });

    it('does not mutate the caller context', () => {
        const context = { tags: { operation: 'x' }, level: 'warning' };
        const snapshot = JSON.stringify(context);

        applyCaptureContext(makeScope(), context);

        expect(JSON.stringify(context)).toBe(snapshot);
    });

    it('tolerates a scope missing setTag / setExtra', () => {
        expect(() => applyCaptureContext({}, { tags: { operation: 'x' }, level: 'error' })).not.toThrow();
        expect(() => applyCaptureContext(null, { tags: { operation: 'x' } })).not.toThrow();
    });
});
