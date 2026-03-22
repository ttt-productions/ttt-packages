# @ttt-productions/query-core

TanStack Query (React Query) integration layer for Firestore. Provides query client factory, key management, Firestore hooks for documents/collections/pagination/infinite scroll, mutation hooks, and search.

## Version
0.3.15

## Dependencies
Peer: @tanstack/react-query, firebase, react, react-dom.

## What It Contains

### Query Client (`query-client.ts`)
- `createTTTQueryClient(options?)` — Factory that creates a QueryClient with TTT-specific defaults (staleTime, gcTime, retry behavior).

### Query Keys (`keys.ts`)
- `keys` — Centralized key factory with helper methods
- `createKeyScope(prefix)` — Creates a scoped key factory for a feature area

### Cache Helpers (`cache-helpers.ts`)
- `invalidateByPrefix(queryClient, prefix)` — Invalidate all queries matching a key prefix
- `removeByPrefix(queryClient, prefix)` — Remove all queries matching a key prefix
- `updateQueryData(queryClient, key, updater)` — Optimistic cache updates

### Provider (`provider.tsx`)
- `TTTQueryProvider` — Wraps QueryClientProvider with TTT defaults

### Firestore Integration (`firestore/`)
Context:
- `FirestoreProvider` — Provides Firestore db instance to all hooks via context
- `useFirestoreDb()` — Access the Firestore instance

Query Hooks:
- `useFirestoreDoc<T>(options)` — Single document fetch with optional realtime subscription. Uses `JSON.stringify` stabilization on `queryKey` in `useEffect` deps to prevent infinite reconnection cycles.
- `useFirestoreCollection<T>(options)` — Collection query with optional realtime subscription
- `useFirestoreInfinite<T>(options)` — Infinite scroll pagination (TanStack `useInfiniteQuery` wrapper)
- `useFirestorePaginated<T>(options)` — Page-based pagination with next/prev cursor tracking
- `useBatchFirestoreDocs<T>(options)` — Batch-fetch multiple documents by ID

Mutation Hooks:
- `useFirestoreSet`, `useFirestoreUpdate`, `useFirestoreDelete` — CRUD mutations with automatic cache invalidation
- `useFirestoreBatch` — Batch write operations

Helpers:
- `flattenInfiniteData(data)` — Flatten infinite query pages into a single array
- `getInfiniteDataCount(data)` — Count total items across all pages
- `docWithId(snapshot)` — Extract document data with ID

### Search Integration (`search/`)
- `useFirestoreSearch<T>(options)` — Debounced prefix search with case-insensitive matching (uses Firestore range queries with `\uf8ff` suffix). Default 300ms debounce, 3 character minimum, configurable result limit.
- `SEARCH_CONFIGS` — Preset search configurations for common entities

## Key Design Decisions
- All hooks accept `subscribe: true` for realtime Firestore listeners that update TanStack Query cache via `onSnapshot`.
- `queryKey` arrays are JSON-stringified in useEffect deps to prevent infinite re-render loops when array references change.
- Optimistic updates are for reducing Firestore reads, not just perceived performance.
- `invalidateByPrefix` is used by the Q-Sports stats beacon system for broad cache invalidation.

## Files
```
src/
  index.ts
  query-client.ts, keys.ts, cache-helpers.ts, defaults.ts, provider.tsx
  firestore/
    index.ts, types.ts, context.tsx
    use-firestore-doc.ts, use-firestore-collection.ts
    use-firestore-infinite.ts, use-firestore-paginated.ts
    use-firestore-mutations.ts, useBatchFirestoreDocs.ts
  search/
    index.ts, types.ts, search-configs.ts, use-firestore-search.ts
```
