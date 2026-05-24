import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidateByPrefix, removeByPrefix, updateQueryData } from '../src/cache-helpers';

function makeClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });
}

function isInvalidated(client: QueryClient, queryKey: unknown[]): boolean {
    const q = client.getQueryCache().find({ queryKey });
    return q?.state.isInvalidated === true;
}

describe('invalidateByPrefix', () => {
    let client: QueryClient;

    beforeEach(() => {
        client = makeClient();
    });

    it('marks every query whose key starts with the prefix as invalidated', async () => {
        client.setQueryData(['users', 'list'], ['a', 'b']);
        client.setQueryData(['users', 'detail', 'uid-1'], { id: 'uid-1' });
        client.setQueryData(['users', 'detail', 'uid-2'], { id: 'uid-2' });

        await invalidateByPrefix(client, ['users']);

        expect(isInvalidated(client, ['users', 'list'])).toBe(true);
        expect(isInvalidated(client, ['users', 'detail', 'uid-1'])).toBe(true);
        expect(isInvalidated(client, ['users', 'detail', 'uid-2'])).toBe(true);
    });

    it('leaves queries with unrelated key prefixes untouched', async () => {
        client.setQueryData(['users', 'list'], ['a']);
        client.setQueryData(['projects', 'list'], ['p1']);
        client.setQueryData(['messages', 'detail', 'm1'], { id: 'm1' });

        await invalidateByPrefix(client, ['users']);

        expect(isInvalidated(client, ['users', 'list'])).toBe(true);
        expect(isInvalidated(client, ['projects', 'list'])).toBe(false);
        expect(isInvalidated(client, ['messages', 'detail', 'm1'])).toBe(false);
    });

    it('matches multi-segment prefixes (does not over-match)', async () => {
        client.setQueryData(['users', 'list'], ['a']);
        client.setQueryData(['users', 'detail', 'uid-1'], { id: 'uid-1' });

        await invalidateByPrefix(client, ['users', 'list']);

        expect(isInvalidated(client, ['users', 'list'])).toBe(true);
        // `['users', 'list']` is NOT a prefix of `['users', 'detail', 'uid-1']`
        expect(isInvalidated(client, ['users', 'detail', 'uid-1'])).toBe(false);
    });

    it('does NOT remove the cached data — only marks it invalidated', async () => {
        client.setQueryData(['users', 'list'], ['a', 'b']);
        await invalidateByPrefix(client, ['users']);
        // Data remains accessible; only the staleness flag changed.
        expect(client.getQueryData(['users', 'list'])).toEqual(['a', 'b']);
    });
});

describe('removeByPrefix', () => {
    let client: QueryClient;

    beforeEach(() => {
        client = makeClient();
    });

    it('removes every query whose key starts with the prefix', () => {
        client.setQueryData(['projects', 'list'], ['p1', 'p2']);
        client.setQueryData(['projects', 'detail', 'pj-1'], { id: 'pj-1' });
        client.setQueryData(['projects', 'detail', 'pj-2'], { id: 'pj-2' });

        removeByPrefix(client, ['projects']);

        expect(client.getQueryData(['projects', 'list'])).toBeUndefined();
        expect(client.getQueryData(['projects', 'detail', 'pj-1'])).toBeUndefined();
        expect(client.getQueryData(['projects', 'detail', 'pj-2'])).toBeUndefined();
    });

    it('leaves queries with unrelated key prefixes untouched', () => {
        client.setQueryData(['projects', 'list'], ['p1']);
        client.setQueryData(['users', 'list'], ['u1']);

        removeByPrefix(client, ['projects']);

        expect(client.getQueryData(['projects', 'list'])).toBeUndefined();
        expect(client.getQueryData(['users', 'list'])).toEqual(['u1']);
    });

    it('matches multi-segment prefixes (does not over-match)', () => {
        client.setQueryData(['projects', 'recent'], ['p1']);
        client.setQueryData(['projects', 'archived'], ['p2']);

        removeByPrefix(client, ['projects', 'recent']);

        expect(client.getQueryData(['projects', 'recent'])).toBeUndefined();
        expect(client.getQueryData(['projects', 'archived'])).toEqual(['p2']);
    });
});

describe('updateQueryData', () => {
    let client: QueryClient;

    beforeEach(() => {
        client = makeClient();
    });

    it('writes a new value computed from the previous value', () => {
        client.setQueryData(['nums'], [1, 2, 3]);
        updateQueryData<number[]>(client, ['nums'], (prev) => [...(prev ?? []), 4]);
        expect(client.getQueryData(['nums'])).toEqual([1, 2, 3, 4]);
    });

    it('handles an undefined previous value by passing undefined to the updater', () => {
        let observedPrev: unknown = 'unset';
        updateQueryData<string[]>(client, ['empty'], (prev) => {
            observedPrev = prev;
            return prev ?? ['default'];
        });
        expect(observedPrev).toBeUndefined();
        expect(client.getQueryData(['empty'])).toEqual(['default']);
    });

    it('does not affect queries with other keys', () => {
        client.setQueryData(['a'], 1);
        client.setQueryData(['b'], 2);
        updateQueryData<number>(client, ['a'], (prev) => (prev ?? 0) + 10);
        expect(client.getQueryData(['a'])).toBe(11);
        expect(client.getQueryData(['b'])).toBe(2);
    });
});
