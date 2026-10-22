# @ttt-productions/query-core

Shared TanStack Query (React Query) setup and Firestore read hooks for consuming apps.

- `createQueryClient()` factory with safe defaults and `QueryProvider` (`./react`)
- `STALE_TIMES` presets and the search rule (root)
- `keys` query key helpers (`./keys`)
- the Firestore hooks, invalidation, and cache update helpers (`./react`)

No app business logic. See `docs/packages/query-core.md`.
