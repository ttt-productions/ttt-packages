import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidateByPrefix, placeRowInPages, removeByPrefix, updateQueryData, type PagedRows } from '../src/react/cache-helpers.js';

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
        client.setQueryData(['entities', 'list'], ['p1']);
        client.setQueryData(['messages', 'detail', 'm1'], { id: 'm1' });

        await invalidateByPrefix(client, ['users']);

        expect(isInvalidated(client, ['users', 'list'])).toBe(true);
        expect(isInvalidated(client, ['entities', 'list'])).toBe(false);
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

    it('does NOT remove the cached data â€” only marks it invalidated', async () => {
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
        client.setQueryData(['entities', 'list'], ['p1', 'p2']);
        client.setQueryData(['entities', 'detail', 'e-1'], { id: 'e-1' });
        client.setQueryData(['entities', 'detail', 'e-2'], { id: 'e-2' });

        removeByPrefix(client, ['entities']);

        expect(client.getQueryData(['entities', 'list'])).toBeUndefined();
        expect(client.getQueryData(['entities', 'detail', 'e-1'])).toBeUndefined();
        expect(client.getQueryData(['entities', 'detail', 'e-2'])).toBeUndefined();
    });

    it('leaves queries with unrelated key prefixes untouched', () => {
        client.setQueryData(['entities', 'list'], ['p1']);
        client.setQueryData(['users', 'list'], ['u1']);

        removeByPrefix(client, ['entities']);

        expect(client.getQueryData(['entities', 'list'])).toBeUndefined();
        expect(client.getQueryData(['users', 'list'])).toEqual(['u1']);
    });

    it('matches multi-segment prefixes (does not over-match)', () => {
        client.setQueryData(['entities', 'recent'], ['p1']);
        client.setQueryData(['entities', 'archived'], ['p2']);

        removeByPrefix(client, ['entities', 'recent']);

        expect(client.getQueryData(['entities', 'recent'])).toBeUndefined();
        expect(client.getQueryData(['entities', 'archived'])).toEqual(['p2']);
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

describe('placeRowInPages', () => {
    interface Row { id: string; rank: number }
    interface Page { rows: Row[]; next: string | null }
    const row = (id: string, rank: number): Row => ({ id, rank });
    const data = (...pages: Page[]) => ({ pages, pageParams: pages.map((_, i) => (i === 0 ? null : `cursor-${i}`)) });
    const how = (id: string): PagedRows<Page, Row> => ({
        rowsOf: (page) => page.rows,
        withRows: (page, rows) => ({ ...page, rows }),
        isRow: (candidate) => candidate.id === id,
        // The list's order: rank ascending, then id.
        sortsBefore: (a, b) => a.rank < b.rank || (a.rank === b.rank && a.id < b.id),
        hasMoreAfter: (page) => page.next !== null,
    });
    const ids = (result: ReturnType<typeof data> | undefined) => result?.pages.map((page) => page.rows.map((r) => r.id));

    it('places a new row at its position in the list order, keeping every other row, page, and cursor', () => {
        const before = data({ rows: [row('a', 1), row('c', 3)], next: 'c' }, { rows: [row('e', 5)], next: null });
        const after = placeRowInPages(before, row('b', 2), true, how('b'));
        expect(ids(after)).toEqual([['a', 'b', 'c'], ['e']]);
        expect(after?.pages.map((page) => page.next)).toEqual(['c', null]);
        expect(after?.pageParams).toEqual(before.pageParams);
    });

    it('moves a row that changed to its new position', () => {
        const before = data({ rows: [row('a', 1), row('b', 2)], next: 'b' }, { rows: [row('c', 3), row('d', 4)], next: null });
        expect(ids(placeRowInPages(before, row('a', 3.5), true, how('a')))).toEqual([['b'], ['c', 'a', 'd']]);
    });

    it('drops a row that no longer belongs, and leaves the rest', () => {
        const before = data({ rows: [row('a', 1), row('b', 2)], next: 'b' }, { rows: [row('c', 3)], next: null });
        expect(ids(placeRowInPages(before, row('b', 2), false, how('b')))).toEqual([['a'], ['c']]);
    });

    it('leaves a row that sorts past every loaded row to the next page read while one is left', () => {
        const before = data({ rows: [row('a', 1), row('b', 2)], next: 'b' });
        expect(placeRowInPages(before, row('z', 9), true, how('z'))).toBe(before);
    });

    it('adds a row that sorts past every loaded row at the end when no page is left', () => {
        const before = data({ rows: [row('a', 1)], next: 'a' }, { rows: [row('b', 2)], next: null });
        expect(ids(placeRowInPages(before, row('z', 9), true, how('z')))).toEqual([['a'], ['b', 'z']]);
    });

    it('returns the list as it was when the row neither left nor joined it', () => {
        const before = data({ rows: [row('a', 1)], next: null });
        expect(placeRowInPages(before, row('q', 0), false, how('q'))).toBe(before);
    });

    it('does nothing to a list with no loaded pages', () => {
        expect(placeRowInPages<Page, Row>(undefined, row('a', 1), true, how('a'))).toBeUndefined();
        const empty = data();
        expect(placeRowInPages(empty, row('a', 1), true, how('a'))).toBe(empty);
    });
});
