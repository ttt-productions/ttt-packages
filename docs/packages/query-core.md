# @ttt-productions/query-core

Generic TanStack Query package.

## Owns

- Query client/default option factories with neutral names, plus `STALE_TIMES` —
  generic named `staleTime` presets (`short`/`medium`/`long`/`forever`) so call sites
  use a self-documenting bucket instead of a magic number
- Query provider and helper hooks
- Firestore React hooks (in the `./react` entry): `useFirestoreDoc`,
  `useFirestoreCollection` (one-shot or realtime via `subscribe`),
  `useFirestoreInfinite`, `useFirestorePaginated`, `useFirestoreCount`
  (server-side `count()`), `useFirestoreLiveInfinite` (live newest-window +
  cursor-bridged older pages — for chat / live feeds), `useBatchFirestoreDocs`,
  and the `useFirestoreSet/Update/Delete/Batch` mutations
- A metadata-derived **subscription source state** on the realtime `useFirestoreDoc` /
  `useFirestoreCollection` hooks (`subscribe: true`): the result carries
  `sourceState: 'connecting' | 'live' | 'offline' | 'error'` (`FirestoreSourceState`),
  derived from `snapshot.metadata.fromCache` (subscribed with
  `{ includeMetadataChanges: true }`) plus the listener error callback. Firestore
  serves cached snapshots offline WITHOUT firing the error callback, so error-only
  detection would render a stale cached empty result as live; the hook stays
  `connecting` until a server-confirmed snapshot (`fromCache === false`), goes
  `offline` when only cached data arrives after being live, `error` on the listener
  error callback, and resets to `connecting` when the subscription identity
  (query key / path) changes. Consumed by the TTT notification/badge tray to show a
  degraded indicator instead of a false "all caught up".
- Generic search hook/types
- Domain-event invalidator mechanism (`createDomainEventInvalidator`, `exact`, `prefix`, `predicate`, `applyInvalidations`, `serializeInvalidation`)

## Domain-event invalidation is awaitable

`applyInvalidations` — and the invalidator's `notify` / `notifyAll`, which delegate to it —
dispatch synchronously (every deduplicated cancel + `invalidateQueries` is issued before the
call returns) and return a `Promise<void>` that resolves once every `invalidateQueries` it
issued has settled, i.e. once the refetches those invalidations triggered have landed. A
fire-and-forget caller ignores the promise and behaves as before. A mutation whose success is
only visible after a refetch RETURNS (or awaits) it from `onSuccess`, so the mutation stays
pending until the refreshed data is in the cache. The promise never rejects —
`invalidateQueries` refetches without `throwOnError`, so a failed refetch surfaces on its own
query, never as a failure of the committed action. `refetchType: 'none'` issues no refetch,
so it contributes nothing to wait on.

## Entry points

- `.` — server-safe root: cache helpers, Firestore types and `docWithId`, infinite-data helpers, search types, the `STALE_TIMES` presets, and the domain-event invalidator mechanism. No React or react-query in the runtime graph.
- `./keys` — pure, dependency-free query-key builders (`keys`, `createKeyScope`, `QueryKey`). Safe for any runtime, including backend code that produces invalidation key arrays.
- `./react` — React/TanStack runtime: provider, Firestore hooks, search hook, and the `createQueryClient` factory.
- `./types` — Firestore option/type surface, including `FirestoreCountOptions` and `FirestoreLiveInfiniteOptions` (these two are not re-exported from root, unlike the other Firestore option types).

Client peers (`react`, `react-dom`, `@tanstack/react-query`) are optional; they are needed only when importing `./react`.

## `useBatchFirestoreDocs` — id-list lookups

The hook (in `./react`) resolves a list of document ids. There is exactly ONE data cache: a real, observed React Query query per id at `[queryKeyPrefix, id]`, each with its own `queryFn`. Because every id is an ordinary observed query, exact-key invalidation, `refetchQueries({ type: 'active' })`, and `refetchOnMount` act on a single id the way they act on any other query, and the returned `data` map is derived from those query results rather than read imperatively out of the cache. A hook that resolves ids into cache entries nothing observes cannot be invalidated — that is the failure this shape exists to prevent.

**Transports (one-shot mode).** `transport: 'batch'` (default) coalesces the ids enqueued in one microtask into `where(documentId(), 'in', …)` queries of at most 30 ids each, with bounded concurrency. `transport: 'get'` issues one concurrent `getDoc` per id. `'get'` is the correct choice for a collection whose Firestore rules gate reads on `resource.data`: an unconstrained id-list query is denied WHOLESALE there, while per-document gets are evaluated per document, so one unreadable id errors alone. On such a collection a get against a nonexistent document is also denied, so absence and hidden are the same client-visible signal.

The batch loader is scoped per `(QueryClient, Firestore instance, collectionPath)` and **resolves promises only — it never writes the cache**, so TanStack's per-query fetch identity remains the single guard against a late response overwriting a newer per-id result. A dispatched batch is closed: a later enqueue of the same id always joins a new batch. Cancelling one id detaches only that waiter; the shared request still completes for its batch-mates, and an id nobody is waiting on any more is dropped before the request goes out. A consequence of per-id fetch identity: a prefix or predicate invalidation that lands while a batch is in flight cancels the already-populated ids in it and re-reads them in a fresh batch, so that page costs a second round trip — by design, since the alternative is serving the invalidated values.

The one-shot `queryFn` also yields to the shared listener: if a key became listener-owned while the read was in flight (a consumer entered subscribe mode), the queryFn returns the listener's cached value instead of its own result. `onSnapshot` does not re-emit until the document changes, so without that the stale read would stick.

**Freshness.** The lookup queries set `refetchOnMount: true` explicitly, because a consuming app's global default is commonly `false` and refetch-on-mount only fires when stale (a fresh remount therefore still costs nothing). `staleTime` is a function of the query: `absentStaleTime` (short — a missing doc is usually one that has not been created or mirrored YET) when the data is `null`, the caller's `staleTime` otherwise.

**Absence ladder.** A nonexistent document resolves to `null` (negative caching) and is excluded from `data`. A scheduler then re-reads that key on a bounded backoff ladder (`ABSENT_RETRY_DELAYS_MS`, overridable per call) so a document that appears shortly afterwards shows up without an invalidation — the recovery the realtime path was originally introduced to provide. One timer per cache key and one budget per absence episode: repeated `null` results and additional consumers never buy another rung, a `present → null` transition opens a new episode, and cache removal discards the bookkeeping. Eligibility is `query.isActive()`, so disabled and subscribe-mode observers never keep a ladder alive, and losing the last enabled observer pauses it with the remaining budget intact. An error state is never polled — a denial is not an absence.

Consumers of one key that ask for different ladders combine by **union**, never by mount order: the key polls if ANY mounted consumer wants polling, on the LONGEST ladder among them, recomputed on every mount and unmount. A consumer passing `[]` therefore silences only re-reads nobody else asked for; when the last consumer that wanted polling unmounts, an episode already in progress continues on the new effective ladder's remaining rungs, or stops if that ladder is now empty.

**Errors.** An id in an error state is excluded from `data` while `isError`/`error` stay truthful, so a previously cached document is never presented as currently readable after access to it fails. A denial is never converted into a null or missing result.

**Optional `subscribe` mode.** Each id is instead resolved through a shared, reference-counted `onSnapshot` listener (registry in source) that writes the same per-id keys; the per-id queries are disabled with `staleTime: Infinity`, `isLoading` means "a subscribed id has no cache entry yet", and `refetch()` is a no-op. Use it for small, change-sensitive documents where live propagation is genuinely required — not as the default for public display lookups.

## Boundary

Concrete TTT query keys, search presets, and domain-event invalidation entries live in TTT app code or `ttt-core`. This package should not export TTT- or Q-Sports-branded presets.

## Search hook boundary for Realm / Work discovery

`query-core` may provide generic Firestore prefix-search utilities, but it must not hard-code TTT collection names or presets. TTT-specific search configs for `publicUsers`, `publicWorkProjects`, and `workRealms` live in `ttt-core` or the consuming app.

If the generic search hook is extended for the Realm/discovery launch slice, keep the API generic: equality filters plus lowercase prefix search over a caller-provided collection and field. Do not add TTT-specific branches such as `useWorkRealmSearch` inside `query-core`.
