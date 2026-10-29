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
  anchored older pages — for chat / live feeds), `useBatchFirestoreDocs`,
  and the `useFirestoreSet/Update/Delete/Batch` mutations
- The app-config mechanism, `createAppConfig` (below)
- The one session-aware mutation owner, `useSessionMutation` with `MutationSessionProvider` and
  `MutationSessionEndedError` (below), and the callable factories built on it (`createCallables`)
- A metadata-derived **subscription source state** on the realtime `useFirestoreDoc` /
  `useFirestoreCollection` hooks (`subscribe: true`): the result carries
  `sourceState: 'connecting' | 'live' | 'offline' | 'error'` (`FirestoreSourceState`),
  derived from `snapshot.metadata.fromCache` (subscribed with
  `{ includeMetadataChanges: true }`) plus the listener error callback. Firestore
  serves cached snapshots offline WITHOUT firing the error callback, so error-only
  detection would render a stale cached empty result as live; the hook stays
  `connecting` until a server-confirmed snapshot (`fromCache === false`), goes
  `offline` when only cached data arrives after being live, and `error` on the listener
  error callback. The source state and the listener error belong to the subscription
  identity (path, key, constraints, enabled) that produced them: a new identity reads
  `connecting` with no error from its very first render, and a retired listener's late
  callback never lands on the new one. Consumed by an app's notification/badge tray, for example, to
  show a degraded indicator instead of a false "all caught up".
- **A subscribed read is loading until its first snapshot.** The query underneath is disabled in
  subscribe mode, so on its own it reads `pending` but not loading; the result reports
  `isLoading` and `isFetching` (`fetchStatus: 'fetching'`) until the listener's first snapshot or
  its error, as a one-shot read's first fetch does — a consumer deciding from `isLoading` never
  renders an unanswered read as an absence. A disabled read stays idle.
- **`refetch()` re-opens a subscribed read.** In subscribe mode, `useFirestoreDoc` /
  `useFirestoreCollection` keep a listener error in their own state (the `permission-denied`
  ladder spent, or at once for any other code), so the one-shot read cannot clear it. Their
  `refetch()` there clears the listener error and re-opens the listener with a fresh
  resubscribe ladder; the result reports fetching (`isFetching`, `fetchStatus: 'fetching'`)
  until the re-opened listener's first snapshot or its next surfaced error, and the promise
  settles then (resolving with that result, or rejecting with the error under
  `throwOnError`). This is the retry a failed subscribed read offers; a healthy listener's restart
  keeps its data (`isRefetching`).
- **A subscribed read that fails after it answered keeps its last snapshot.** The result holds that
  snapshot as `data` beside the listener's failure, as a one-shot read that fails a refetch keeps its
  data: `status: 'error'` with `isRefetchError` says the rows are not current, so a consumer keeps what
  it showed — and anything open over it — with the failure beside it instead of tearing it down. A
  restart from that failure keeps both, the held data and the failure, reporting `isRefetching` until
  the re-opened listener answers. A listener that failed before it ever answered has nothing to hold:
  it reads `isLoadingError` with no data, and its restart reads `pending` with no data. A `permission-denied`
  failure (surfaced once the resubscribe ladder is spent) holds nothing either: the reader lost access,
  and a snapshot it may no longer read is never presented as readable, so it and its restart read as a
  failure before any answer. A disabled read's
  `refetch()` opens nothing; without `subscribe`, `refetch()` is the query's own one-shot re-read.
- The generic debounced prefix-search hook `useFirestoreSearch`, its options type
  (`FirestoreSearchOptions`, on `./react`), and its config types (`FirestoreSearchConfig`,
  `SearchEqualityFilter`) and search rule on the server-safe root (`FIRESTORE_SEARCH_MIN_LENGTH`, `isSearchableText`, `normalizeSearchText`)
- The read failure-and-retry state, `useReadRetryState` (below)
- `placeRowInPages` (`./react`, with its `PagedRows` adapter): places, moves, or drops one row in a
  cached infinite list's loaded pages at its position in the list's own order, keeping every other
  row, page, and cursor — so an action updates a paged list without reloading it
- The domain-event invalidator mechanism (`createDomainEventInvalidator`, `exact`, `prefix`,
  `predicate`, `applyInvalidations`, `serializeInvalidation`) — the one place an app refreshes,
  removes, or resets cached reads in answer to something that happened

## `useSessionMutation` — an action belongs to the session that started it

Every mutation in an app and in a package goes through `useSessionMutation(options)` (`./react`), the
one session-aware mutation owner. It returns TanStack's own `useMutation` result, typed as
`SessionMutationResult` so per-call callbacks see the session too.

- **The session.** `MutationSessionProvider({ currentUid })` is mounted by the app inside its
  `QueryClientProvider`. Every committed change of `currentUid` starts a new session — a sign-out
  followed by the same member signing back in included. The session ends when the render with the
  new uid commits, before any layout effect of that commit runs; a render that is discarded before
  it commits ends nothing. Without a provider every action runs as current, so a package hook never
  requires one.
- **Captured when the action starts.** An always-installed `onMutate` captures the session before the
  caller's own `onMutate` runs. `mutationFn(variables, context)` receives TanStack's context plus
  `context.session = { uid, isCurrent(), assertCurrent() }`, so a multi-step chain re-checks between
  its own awaits; `assertCurrent()` throws `MutationSessionEndedError`. Every callback — the
  hook-level `onMutate` / `onSuccess` / `onError` / `onSettled` and the per-call ones — receives the
  same `context.session`, so a callback that awaits re-checks it before its later toast or cache
  write. The callable kinds of `createCallables` hand their callbacks the same session.
- **An answer for an ended session does nothing.** When the session has changed by the time the
  answer comes back, every callback is skipped — the hook-level `onSuccess` / `onError` /
  `onSettled` and the per-call ones passed to `mutate` / `mutateAsync` — so its toasts and cache
  writes never run. `mutateAsync` rejects with `MutationSessionEndedError` (`name: 'AbortError'`);
  it is never retried and never thrown to an error boundary under `throwOnError`. When the answer
  was a failure, that failure is the ended error's `cause`. When the answer was a success, the
  ended error has no `cause`, and the write may have committed. `mutateAsync` also rejects as ended
  when the session ends while the hook's awaited `onSuccess` / `onSettled` runs, so
  `await mutateAsync(); next()` never continues into another session.
- **Work that has not started never starts.** A queued (`scope`) or paused (offline) `mutationFn`
  whose session ended before it ran never runs, and neither does a mutation restored without a
  captured session.
- **Monitoring is not fenced.** The `MutationCache`'s own callbacks still run, receiving the ended
  error — with the original failure as its `cause` when the answer was a failure, and no `cause`
  after a late success.

- **An unknown outcome re-reads what the action owns.** A failure the app classes as an unknown
  outcome (a client deadline: the server may still commit) carries no answer to patch the cache
  from. A mutation declares `unknownOutcomeReads(variables)`, the query keys its success path
  writes, and the app hands `MutationSessionProvider` an `unknownOutcome` policy
  (`UnknownOutcomePolicy`): `isUnknownOutcome(error)`, `rereadAfterMs` (the delays after the
  failure at which the keys are read again, so a commit that lands after the deadline still
  reaches the screen), and `reread(queryClient, keys)`. The app owns `reread`, so its one cache
  invalidation owner stays the only place reads are refreshed. Each re-read runs only while the
  session that started the action lasts. The re-reads run before the caller's own `onError`, and
  the callable actions of `createCallables` take the same option. Without a policy, or for any
  other failure, nothing is re-read.

`useFirestoreSet/Update/Delete/Batch` are built on it, so an optimistic rollback or a key refresh of
an ended session never touches the next session's cache.

## Callable declarations contract

`createCallables(policy)` (`./react`) binds an app's policy once and returns the four callable
kinds. Each named callable is declared once in the app — `createCallableHook<TInput, TResult>(functionName,
{ limitedUseAppCheck?: true })`, and likewise for the others — so the function name, its types, and
its App Check posture live beside each other, and a call site sees only the named hook. Every kind
calls through `callCallable` with the policy's Functions provider and deadline; the kind fixes the
retry, surface, and capture:

- **action** (`createCallableHook`) — a session mutation (`useSessionMutation`) with `retry: false` that no call site
  can override (a deadline expiry is an unknown outcome, never retried). A call site passes the
  mutation options (minus `mutationFn` and `retry`) plus `showErrorToast`, `answeredRefusals`,
  `isAnswerSurfacedByCaller`, and `captureFaults` (false for a caller that re-sends on a fault and
  captures the final failure itself).
- **reader** (`createCallableReader`) — a hook returning the function a query's `queryFn` calls. It
  routes its failure with `showErrorToast: false` and captures no fault (the query layer captures
  it once).
- **invoker** (`createCallableInvoker`) — a hook returning a function a package hook drives inside its
  own mutation: the failure is routed and its fault captured once, and the call rejects so that
  mutation settles on it.
- **resumable** (`createResumableCallableHook(functionName, merge, declaration?)`) — a session action for
  work the server does a budget at a time: one request calls again with the same input until the
  answer is `complete` or `MAX_RESUMABLE_CALLS` calls were made, `merge` folding each later answer
  into the earlier ones. It settles on a `ResumableOutcome` — the merged answer plus
  `interruption`: a failure on the first call rejects the request; a failure on a later one settles
  on the merged progress, never `complete`, with that failure as `interruption`, so earlier calls'
  committed work is never lost. A `merge` that throws rejects the request. A request whose session
  ended makes no further call.

The policy (`CallablePolicy`) is everything app-specific; the package names no app copy and
imports no toast or monitoring module (RULE-STD-QUALITY-102):

- `getFunctions` and `timeoutMs` — the Functions provider and the total-invocation deadline.
- `resolveLimitedUseAppCheck(requested)` — the effective limited-use mode for a callable declared
  limited-use or not.
- `captureFault(error, context)` — receives every `callCallable` report (failures and the
  recovered-fallback report) for a call whose kind owns its capture. For a reader or a
  `captureFaults: false` action, `captureRecoveredFallback` receives only the recovered-fallback
  report — the package filters it out by its own marker — and the failure is captured by neither,
  since another layer owns it.
- `onActionError(error, { showErrorToast, answeredRefusals, isAnswerSurfacedByCaller })` — called
  once for every failed call of every kind whose session is still current, with the call site's
  routing (defaults `true` and `[]`), so the app owns which answers have their own surface and which
  failures toast. Every kind shares the mutation owner's session fence: a failure that lands after
  the session that made the call ended reaches no `onActionError` (so it raises no toast), while
  `captureFault` still receives it — monitoring is never fenced. An action or resumable call takes
  its session from its mutation; a reader or invoker takes the session current when its function
  is called.

## `useFirestorePaginated` — one cache entry per page

Previous / Next paging, one page at a time. Each page is ONE cache entry at
`[...queryKey, 'page', n]` (`paginatedPageKey(queryKey, n)`), a `PaginatedPage<T>`:
`{ items, cursor, hasMore, after }` — the page's rows, its last row (the next page's cursor),
whether a further page exists, and the id of the row it was read after. Every read asks for one row past the page, so
`hasMore` is false exactly when nothing follows (an exactly-full last page included).
Page n starts after page n-1's cached cursor; when page n-1 is not cached it is read
first (the chain loads back to page 1). When page n-1 is read again and its last row
moves, the displayed page n no longer follows it (`after` differs from page n-1's cursor):
it is re-read before it is shown as current. So every instance, remount, and refetch of a
key agrees on where a page starts, and no row is skipped or repeated across a re-read. `hasNextPage` comes from the DISPLAYED page's entry. The
page number belongs to the query identity (path, key, constraints, page size): a new
identity renders `initialPage` in its first render. `refetchInterval` re-reads the
displayed page while it is mounted. The result's `data` is the displayed page's rows.

Because entries are shared by key, the caller's `queryKey` encodes everything that
changes the read — path, filters, ordering, and page size.

Cache updaters for these entries live on `./react` (they take the
`QueryClient` and the base `queryKey` the hook was given):
`mapPaginatedItems(client, queryKey, mapItem)` patches rows in place across every cached
page, and `prependToFirstPaginatedPage(client, queryKey, item)` puts a new row at the
top of page 1 when page 1 is cached — for newest-first lists only. Page 1 keeps its
cursor, so it shows one extra row and page 2 keeps its place until page 1 is next read;
that read moves page 1's cursor, and the hook re-reads page 2 from it before showing it.

## `useFirestoreLiveInfinite` — live rows plus older pages

The result is `{ items, isInitialLoading, sourceState, error, fetchOlder, hasOlder,
isFetchingOlder, olderError, retry }` (`FirestoreLiveInfiniteResult`).

- **Fixed anchor.** Until the first server-confirmed snapshot that has rows, the listener
  reads the newest `pageSize` rows plus one look-ahead row. That snapshot fixes the
  window's oldest row as the anchor; the listener then covers anchor → newest with no
  limit (it grows only with rows that arrive while the list is open), and every older
  page starts after the anchor. No row ever falls between the live set and the older
  pages. A cached snapshot never fixes the anchor.
- **Truthful `hasOlder`.** The anchoring snapshot's look-ahead row says whether anything
  older exists; older pages (`getDocs`, `startAfter`, one row past the page) carry the
  same look-ahead.
- **Older rows only on request.** No older page is read until `fetchOlder()` asks: the
  first call reads the page after the anchor, each later call the page after the last one
  loaded. A list nobody scrolls back through costs only its live read.
- **Order without re-sorting.** Both reads are ordered by `orderByField` descending in
  Firestore and meet at the anchor without overlapping, so the merged list is the live rows
  followed by the older pages, reversed for `sort: 'asc'` (the default) — a snapshot never
  re-sorts the rows already loaded, and the ordering field may be any type Firestore orders
  (a timestamp included). A row whose ordering value an edit moved into the live range is
  shown once, as its live copy.
- **Identity.** Rows, anchor, source state, and errors are tagged to the subscription
  identity (path, key, ordering, constraints, page size, enabled). A new identity renders
  empty, `isInitialLoading`, and `connecting` in its first render; the older-pages query
  is keyed by identity and anchor, so a retired identity's page never lands.
- **Listener failure.** A `permission-denied` listener error resubscribes on the
  `RESUBSCRIBE_DELAYS_MS` ladder (`sourceState: 'connecting'` meanwhile); once the ladder
  is spent, or at once for any other code, `error` is set, `sourceState` is `'error'`,
  and the hook `console.error`s it. Rows already on screen are kept beside the error; with
  none, `isInitialLoading` is false. A surfaced `permission-denied` keeps nothing: the reader
  lost access, so the live rows, the anchor, and the loaded older pages are dropped, and
  `retry()` reads the list afresh. A healthy snapshot clears `error`.
- **Older-page failure.** `olderError` holds a failed older read (the loaded rows stay;
  `hasOlder` stays true) until an older read succeeds. `fetchOlder` never rejects.
- **`retry()`** resubscribes a failed listener with a fresh ladder (clearing `error`,
  keeping whatever rows and anchor the failure kept) and re-reads a failed older page; `isFetchingOlder` is the
  older re-read's pending flag.

## `useFirestoreSearch` — debounced prefix search

`useFirestoreSearch(options)` (in `./react`) reads a caller-provided collection and lowercase
field: the optional equality filters, then a prefix range on the field, ordered by it, up to
`limit` rows (default 5). It returns a `UseQueryResult` keyed by the normalized text.

- **Normalized text.** The typed text is lowercased and trimmed (`normalizeSearchText`, the text a
  search is read and keyed for); a search runs only when
  `isSearchableText(text)` holds (the normalized text has at least `FIRESTORE_SEARCH_MIN_LENGTH`
  characters) and `enabled` is not false. A consumer that gates its own search, result panel, or
  `SearchDropdown` reads those two names, never a restated minimum or an untrimmed length.
- **Debounced.** The read follows the typed text after `debounceMs` (default 300).
- **No answer while the debounce lags.** Until the debounced text equals the normalized typed
  text, the result is not an answer for what is typed: `data` is undefined, `error` is null,
  `status` is `pending`, and `isLoading` is true when the typed text will be searched (false —
  idle — when it is too short or the search is disabled). A first search therefore reads as
  searching, never as an empty answer, and a changed search never shows the previous text's
  rows, nor its failure. A change of case or surrounding spaces is the same search and keeps its
  answer. Every other field of the result (`refetch` included) is the query's own.

## `useReadRetryState` — a retry keeps its failure on screen

TanStack Query v5 starts a fetch on a query that never succeeded by clearing its `error` and putting
it back to `pending`, and a subscribed read's `refetch()` clears its listener error the same way. A
retry state built from `isFetching && error` is therefore never true while the retry of a failed
first read runs, and the surface's failure panel turns into a loading state under the retry the
person pressed (RULE-STD-FRONTEND-201). `useReadRetryState(source, queryKey)` (in `./react`) is the one owner
of a read's failure-and-retry state:

- **Input.** `source` is any read result carrying `error`, `isFetching`, `isLoading`, and optionally
  `isPaused` (`ReadRetrySource`) — a `useQuery` result or any query-core read hook's result.
  `queryKey` is the read's identity.
- **The failure is held through its retry.** `error` is the read's current failure, or — while a
  fetch after it is running or waiting for the network — the last failure the read showed. An answer
  clears it; a new failure replaces it. A failure is its name, message, and `code`, not its object:
  a source that builds a new error for the same failure on every render (a composite making
  `new Error(…)` in render) holds the one failure and never re-renders without end.
- **The retry is reported as running.** `isRetrying` is true while a failure is shown and a fetch is
  running or paused, so the pressed control shows pending until the retry settles.
- **A retry is never loading.** `isLoading` is the read's own loading state with no failure shown,
  so a surface that checks loading before failure keeps its failure panel up through the retry.
- **The failure belongs to its key.** A read under another key never shows it; that key's first read
  reads as loading.
- **Several reads, each its own key.** `useReadRetryStates(entries)` is the same state for a set of
  reads whose size changes between renders (a `useQueries` list, per-id reads): each entry is
  `{ source, queryKey }` (`ReadRetryEntry`), the states come back in entry order, each failure is
  held under its own key, and a read that leaves the set drops what it held. `useReadRetryState` is
  this with one entry.

## What a registry entry does

Each entry (`exact`, `prefix`, `predicate`) carries an `action`:

- `'refresh'` (the default) marks the matched queries stale and refetches them per `refetchType`.
- `'remove'` cancels the matched queries and drops them from the cache: the data no longer
  exists, or a held answer must not be served again. A read already in flight cannot put a
  removed answer back.
- `'reset'` returns the matched queries to their initial state and refetches the active ones from
  scratch; its promise settles once those fresh reads land.

A remove or reset acts on exactly the queries its entry matched when it was applied: its second
step (the removal after the cancel, the refetch after the reset) never re-applies the filter, so a
predicate over a query's state — its failure, its fetch — reaches every query it matched.

A refresh and a remove of the same key are different entries and never deduplicated together.

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

## Interactive mutation pending — read from the shared MutationCache

An interactive mutation's pending state belongs to the mutation, never to the control that started it. The app registers each action under one stable `mutationKey` it declares, carries the action's target in the mutation's variables, and reads pending through these mechanics (`./react`):

- `usePendingMutationVariables(key)` — the variables of every pending mutation under `key` (prefix-matched), live; `usePendingMutationTargets(key, targetOf)` — the same as a set of target strings, so a list reads every row's pending through one call.
- `pendingMutationVariables(queryClient, key)` and `hasPendingMutation(queryClient, key, matches?)` — the same read, once, for a duplicate guard.
- `useDuplicateGuardedMutation(mutation, isDuplicate, what)` — wraps `mutate` / `mutateAsync` so a submission whose target is already pending is dropped by `mutate` and refused by `mutateAsync` with `duplicateSubmissionError(what)`, an `AbortError` callers treat as "nothing happened". `isDuplicate` has a stable identity (module level).

Together they give three guarantees a control's own `isPending` cannot: an in-flight request survives its control unmounting, a remounted control still shows it pending, and a second submission for the same target is refused while the first runs. The keys, the variable shapes, and what counts as the same target are the app's; the package holds no family.

## `createAppConfig` — the one live app-config document

An app's operational config (maintenance, registration, an announcement, the deployed version) is
one Firestore document every visitor's shell reads. `createAppConfig(definition)` returns the app's
`AppConfigProvider` (mounted inside the `FirestoreProvider`, it holds the app's one live
subscription to the document), `useAppConfig()`, the pure `readAppConfigSnapshot(stored)`, and the
`LOADING_APP_CONFIG` / `UNAVAILABLE_APP_CONFIG` states. The app supplies everything it owns: the
document `path`, the lever `defaults`, `readLevers(stored)` (each lever at a value its schema
accepts, its default otherwise), `isLeverRefused(stored, lever)`, its `extra` reading (`read(stored
| null)` and the value `whileUnknown`, spread into the state beside the levers), and the reporting
callbacks.

- **The stored document is untrusted.** Consumers only ever see `levers` the app's reader accepted;
  a refused lever reads as its default, is named in `refusedLevers`, and goes to
  `onLeverRefused(lever, value)` once per distinct field and value for the life of the page.
- **Status.** `loading` (no snapshot yet, the defaults), `ready`, `missing` (the document does not
  exist, the defaults), `unavailable` (no snapshot could be read). A config read never closes the
  product by itself.
- **The listener heals itself.** A permission-denied error ends a Firestore listener for good, and
  the first listen can lose a race with the first App Check token, so a failed listener
  re-subscribes on a short backoff (`APP_CONFIG_MAX_QUICK_ATTEMPTS`); when that ladder fails it
  reports once through `onUnavailable(error, attempts)`, moves a never-answered config to
  `unavailable` (a snapshot already read stays), and keeps trying every
  `APP_CONFIG_BACKGROUND_RETRY_MS` for as long as the page is open, quietly.
- **Try again.** `retry()` restarts the listener; `retrying` is on until it answers or its ladder
  fails again, and what the state held stays on screen meanwhile.

## Entry points

- `.` — server-safe root: the search rule (`FIRESTORE_SEARCH_MIN_LENGTH`, `isSearchableText`, `normalizeSearchText`), the search config types, and the `STALE_TIMES` presets. No React, react-query, or Firebase in its runtime graph or its types.
- `./keys` — pure, dependency-free query-key builders (`keys`, `createKeyScope`, `QueryKey`). Safe for any runtime, including backend code that produces invalidation key arrays.
- `./react` — React/TanStack runtime: provider, the app-config mechanism (`createAppConfig`), the session-aware mutation owner, the callable factories (`createCallables`, `MAX_RESUMABLE_CALLS`, and their types), Firestore hooks, search hook, the read retry state (`useReadRetryState`, `useReadRetryStates`), the interactive mutation pending mechanics, the `createQueryClient` factory, the cache helpers (including the paginated-entry updaters and `paginatedPageKey`), the infinite-data helpers, the domain-event invalidator mechanism, and every name typed on react-query or `firebase/firestore`: the Firestore hook option types, `PaginatedPage`, `InfinitePage`, `MutationOperation`, `FirestoreSearchOptions`, and `docWithId`.
- `./react/testing` — the test builders every app's read and mutation doubles are built from (needs `@tanstack/react-query`; no test runner): each read state as a real `QueryObserver` result carrying the `retryState` the read retry state would derive — `answeredRead`, `idleRead` (a disabled read that never fetched), `loadingRead`, `failedRead`, `retryingRead` (a never-answered read retrying: `pending`, its error cleared, the failure held in `retryState`), `fetchingRead` (a background fetch over an answer), `answeredThenFailedRead`, `retryingAnsweredRead`; the infinite reads as real `InfiniteQueryObserver` results — `infiniteRead`, `idleInfiniteRead` (a disabled infinite read that never fetched), `loadingInfiniteRead`, `failedInfiniteRead`, `retryingInfiniteRead` (a never-answered list retrying), `fetchingInfiniteRead` (a refresh over the kept pages), `answeredThenFailedInfiniteRead`, `retryingAnsweredInfiniteRead`, `pausedRetryingAnsweredInfiniteRead` (that refresh retry waiting for the network: `paused`, the failure kept, counted as retrying as the read retry state counts it), `fetchingNextPageRead`, `nextPageFailedRead`, `retryingNextPageRead` (the case's own `select` applied, page params derived from its `getNextPageParam`, which receives TanStack's full arguments — the last page, every page, the previous page param, and every param so far — so a case passes its hook's own function); the paginated reads `useFirestorePaginated` returns — `answeredPaginatedRead`, `loadingPaginatedRead`, `failedPaginatedRead`, `retryingPaginatedRead`, `fetchingPaginatedRead` (a refresh of the page shown, its rows kept), `answeredThenFailedPaginatedRead`, `retryingAnsweredPaginatedRead` (the page's items as `data`, the page and next-page flags the case names, page moves through the case's own `setPage`); and real `MutationObserver` mutations — `idleMutation`, `pendingMutation`, `failedMutation` (awaited: it runs a real mutation that rejects with the case's error), and their session forms `idleSessionMutation`, `pendingSessionMutation`, `failedSessionMutation`, each typed `<TData, TVariables, TOnMutateResult, TError>` so it stands in for a hook whose `onMutate` returns a result or whose error is not an `Error`; `sessionMutationContext(uid)` is the context of a current session that a case's `mutate` handler hands the component's `onSuccess` / `onError` callbacks. The set is every state the real read hooks reach that a page renders apart (RULE-STD-QUALITY-012). Its tests drive a real query, a real infinite query, a real mutation and `useSessionMutation`, and a real paginated read over the in-memory client Firestore, through each state and hold every builder to it. Beside them, `firestoreTestWrapper(db, { queryClient? })` is the one wrapper a hook test renders under: a `QueryClientProvider` around a `FirestoreProvider` for `db`, returning `{ queryClient, Wrapper }`; its default client (`testQueryClient()`) never retries a read and never collects a cached one during a case.
- `./types` — the Firestore types that carry no Firebase type (`WithId`, `FirestoreBaseOptions`, the mutation and batch option types, the source-state and batch-outcome types); the one entry that exports them.

Client peers (`react`, `react-dom`, `@tanstack/react-query` from `5.90.0`, `firebase`) are optional; they are needed only when importing `./react`. Its one internal runtime dependency is `firebase-helpers`: its server-safe root (`chunk`, `FIRESTORE_IN_FILTER_LIMIT`, the expected-answer code type) and, from `./react` only, its `./client` (`callCallable`, `isRecoveredFallbackReport`) — so a server-only install pulls no client runtime through it.

## `useBatchFirestoreDocs` — id-list lookups

The hook (in `./react`) resolves a list of document ids. There is exactly ONE data cache: a real, observed React Query query per id at `[queryKeyPrefix, id]`, each with its own `queryFn`. Because every id is an ordinary observed query, exact-key invalidation, `refetchQueries({ type: 'active' })`, and `refetchOnMount` act on a single id the way they act on any other query, and the returned `data` map is derived from those query results rather than read imperatively out of the cache. A hook that resolves ids into cache entries nothing observes cannot be invalidated — that is the failure this shape exists to prevent.

**Transports (one-shot mode).** `transport: 'batch'` (default) coalesces the ids enqueued in one microtask into `where(documentId(), 'in', …)` queries of at most `FIRESTORE_IN_FILTER_LIMIT` (30) ids each — firebase-helpers' one declaration of Firestore's cap, split with its `chunk` — with bounded concurrency. `transport: 'get'` issues one concurrent `getDoc` per id. `'get'` is the correct choice for a collection whose Firestore rules gate reads on `resource.data`: an unconstrained id-list query is denied WHOLESALE there, while per-document gets are evaluated per document, so one unreadable id errors alone. On such a collection a get against a nonexistent document is also denied, so absence and hidden are the same client-visible signal.

The batch loader is scoped per `(QueryClient, Firestore instance, collectionPath)` and **resolves promises only — it never writes the cache**, so TanStack's per-query fetch identity remains the single guard against a late response overwriting a newer per-id result. A dispatched batch is closed: a later enqueue of the same id always joins a new batch. Cancelling one id detaches only that waiter; the shared request still completes for its batch-mates, and an id nobody is waiting on any more is dropped before the request goes out. A consequence of per-id fetch identity: a prefix or predicate invalidation that lands while a batch is in flight cancels the already-populated ids in it and re-reads them in a fresh batch, so that page costs a second round trip — by design, since the alternative is serving the invalidated values.

The one-shot `queryFn` also yields to the shared listener: if a key became listener-owned while the read was in flight (a consumer entered subscribe mode), the queryFn returns the listener's cached value instead of its own result. `onSnapshot` does not re-emit until the document changes, so without that the stale read would stick.

**Freshness.** The lookup queries set `refetchOnMount: true` explicitly, because a consuming app's global default is commonly `false` and refetch-on-mount only fires when stale (a fresh remount therefore still costs nothing). `staleTime` is a function of the query: `absentStaleTime` (short — a missing doc is usually one that has not been created or mirrored YET) when the data is `null`, the caller's `staleTime` otherwise.

**Absence ladder.** A nonexistent document resolves to `null` (negative caching) and is excluded from `data`. A scheduler then re-reads that key on a bounded backoff ladder (`ABSENT_RETRY_DELAYS_MS`, overridable per call) so a document that appears shortly afterwards shows up without an invalidation — the recovery the realtime path was originally introduced to provide. One timer per cache key and one budget per absence episode: repeated `null` results and additional consumers never buy another rung, a `present → null` transition opens a new episode, and cache removal discards the bookkeeping. Eligibility is `query.isActive()`, so disabled and subscribe-mode observers never keep a ladder alive, and losing the last enabled observer pauses it with the remaining budget intact. An error state is never polled — a denial is not an absence.

Consumers of one key that ask for different ladders combine by **union**, never by mount order: the key polls if ANY mounted consumer wants polling, on the LONGEST ladder among them, recomputed on every mount and unmount. A consumer passing `[]` therefore silences only re-reads nobody else asked for; when the last consumer that wanted polling unmounts, an episode already in progress continues on the new effective ladder's remaining rungs, or stops if that ladder is now empty.

**Errors.** An answered id keeps its answer through a later failure: it stays in `data`, and its outcome is `present` with the failure beside it, while `isError`/`error` stay truthful. A `permission-denied` failure holds nothing — the reader lost access, so a document it may no longer read is never presented as readable — and drops the id from `data`, as does any failure of an id that never answered. A denial is never converted into a null or missing result.

**Failed reads' fetch state.** `failedReadsRunning` is true while a read of an id whose last settled
read failed is fetching or waiting for the network — a retry of that failure. TanStack clears a
never-answered id's error as its refetch starts, so this, not a count of fetching ids, is the running
flag a lookup hands `useReadRetryState`; a first load and the absence ladder's re-read of an id that
answered absent never count.

**Per-id outcomes.** `data`, `isLoading`, `isError`, and `error` are the aggregate view: `error` is only the first failure, and an absent id and a failed id are both simply missing from `data`. `outcomes` (`Record<string, BatchFirestoreDocOutcome<T>>`, one entry per requested id after empty ids and duplicates are dropped) answers each id on its own: `{ status: 'loading' }` until the id has an answer, `{ status: 'present', data, failure? }`, `{ status: 'absent' }` for a read that found no document, or `{ status: 'failed', error, retrying }` with that id's own error — a failure is never `absent`. A document answered before a failure stays `present`, carrying `failure: { error, retrying }`, in one-shot and subscribe mode alike; it reads `failed` only when the failure is `permission-denied` or the id has no answer to hold. On the `'get'` transport a rules denial is a `failed` id; whether a given collection's denial means "not there for this reader" is the consumer's decision, made from `error`. A failed id stays `failed` through a retry of it — TanStack clears a never-answered read's error as its refetch starts — holding the failure it showed with `retrying: true` until the retry settles (`useReadRetryStates`, per id), and a held answer's `failure` does the same; an answer replaces the outcome (dropping `failure`), a new failure its `error`. The aggregate `error` / `isError` stay the live view. The map, and each entry whose answer did not change, keep their identity across renders. `BatchFirestoreDocOutcome` is exported (type-only) from `./types`.

**Optional `subscribe` mode.** Each id is instead resolved through a shared, reference-counted `onSnapshot` listener (registry in source) that writes the same per-id keys; the per-id queries are disabled with `staleTime: Infinity`, `isLoading` means "a subscribed id has no cache entry yet", and `refetch()` is a no-op. A listener error is recorded against its id. An id the listener already answered keeps that answer (`present` with the listener's error as `failure`) unless the error is `permission-denied`; otherwise the error writes `null` for the id (so it resolves instead of loading forever) and the id's outcome is `failed` with the listener's error. The other ids keep their own answers, and the registry keeps the error: Firestore ends a listener that errors, so a `permission-denied` listener is re-opened on the backoff `useFirestoreDoc` uses (`RESUBSCRIBE_DELAYS_MS`), its failure showing meanwhile, and the re-opened listener's first snapshot clears the error; any other error stands until the listener's last subscriber leaves. A consumer that joins an already-failed listener receives the failure instead of reading the `null` as an absence, and so does a one-shot consumer of the same key — its outcome is `failed` with the listener's error, and its `queryFn` answers a refetch with that error rather than the listener's `null`. When the failed listener's last subscriber leaves, the key is invalidated, so a remaining one-shot reader reads the document for itself. Use it for small, change-sensitive documents where live propagation is genuinely required — not as the default for public display lookups.

## Boundary

Concrete query keys, search presets, and domain-event invalidation entries live in the consuming app or its data package. This package exports no application-branded presets.

## Search hook boundary for app discovery

`query-core` may provide generic Firestore prefix-search utilities, but it must not hard-code any app's collection names or presets. App-specific search configs live in the consuming app or its data package.

If the generic search hook is extended, keep the API generic: equality filters plus lowercase prefix search over a caller-provided collection and field. Never add an app-specific search hook inside `query-core`.
