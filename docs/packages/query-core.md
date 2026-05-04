# @ttt-productions/query-core

TanStack Query (React Query) integration layer for Firestore. Provides query client factory, key management, Firestore hooks for documents/collections/pagination/infinite scroll, mutation hooks, and search.

## Version
0.4.4

## Dependencies
Peer: @tanstack/react-query, firebase, react, react-dom.

## Entry Points

- `@ttt-productions/query-core` — server-safe query client factory, query keys, cache helpers, Firestore/search types, and pure helpers.
- `@ttt-productions/query-core/react` — React provider, Firestore provider, hooks, mutation hooks, batch-doc hook, and search hook.
- `@ttt-productions/query-core/types` — preserved Firestore types subpath.

## What It Contains

### Server-safe entry point (`index.ts`)
- `createTTTQueryClient(options?)` and `CreateTTTQueryClientOptions`
- `keys`, `createKeyScope`, and `QueryKey`
- `invalidateByPrefix`, `removeByPrefix`, `updateQueryData`
- Firestore option/result types and `docWithId`
- `flattenInfiniteData(data)` and `getInfiniteDataCount(data)`
- Firestore search config/types and `SEARCH_CONFIGS`

### React entry point (`react/index.ts`)
- `TTTQueryProvider`
- `FirestoreProvider`, `useFirestoreDb`
- Query hooks: `useFirestoreDoc`, `useFirestoreCollection`, `useFirestoreInfinite`, `useFirestorePaginated`
- Mutation hooks: `useFirestoreSet`, `useFirestoreUpdate`, `useFirestoreDelete`, `useFirestoreBatch`
- `useBatchFirestoreDocs`
- `useFirestoreSearch`

## Key Design Decisions
- All hooks accept `subscribe: true` for realtime Firestore listeners that update TanStack Query cache via `onSnapshot`.
- `queryKey` arrays are JSON-stringified in useEffect deps to prevent infinite re-render loops when array references change.
- Optimistic updates are for reducing Firestore reads, not just perceived performance.
- `invalidateByPrefix` is used by the Q-Sports stats beacon system for broad cache invalidation.
- React providers/hooks live on `/react`; the main barrel keeps query utilities and types importable without pulling React.

## Files
```
src/
  index.ts
  query-client.ts, keys.ts, cache-helpers.ts, defaults.ts
  firestore/
    types.ts, infinite-helpers.ts
  search/
    types.ts, search-configs.ts
  react/
    index.ts, provider.tsx
    firestore/
      context.tsx
      use-firestore-doc.ts, use-firestore-collection.ts
      use-firestore-infinite.ts, use-firestore-paginated.ts
      use-firestore-mutations.ts, useBatchFirestoreDocs.ts
    search/
      use-firestore-search.ts
```
