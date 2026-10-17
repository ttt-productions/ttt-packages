import type { Query, QueryClient, QueryFilters, QueryKey } from "@tanstack/react-query";

export type RefetchType = "active" | "all" | "none";

/**
 * What an entry does to the queries it matches:
 * - `"refresh"` (the default) marks them stale and refetches per `refetchType`;
 * - `"remove"` cancels them and drops them from the cache — for data that no longer exists, or a
 *   held answer that must not be served again;
 * - `"reset"` returns them to their initial state and refetches the active ones from scratch.
 */
export type CacheAction = "refresh" | "remove" | "reset";

export type CacheInvalidation =
  | { kind: "exact"; queryKey: QueryKey; refetchType?: RefetchType; action?: CacheAction }
  | { kind: "prefix"; queryKey: QueryKey; refetchType?: RefetchType; action?: CacheAction }
  | {
      kind: "predicate";
      description: string;
      match: (query: Query) => boolean;
      refetchType?: RefetchType;
      action?: CacheAction;
    };

/** `refetchType` belongs to a refresh; a remove or reset takes none. */
type EntryOptions = { refetchType?: RefetchType; action?: "refresh" } | { action: "remove" | "reset" };

const entryFields = (opts?: EntryOptions) => ({
  refetchType: opts && "refetchType" in opts ? opts.refetchType : undefined,
  action: opts?.action,
});

export function exact(queryKey: QueryKey, opts?: EntryOptions): CacheInvalidation {
  return { kind: "exact", queryKey, ...entryFields(opts) };
}

export function prefix(queryKey: QueryKey, opts?: EntryOptions): CacheInvalidation {
  return { kind: "prefix", queryKey, ...entryFields(opts) };
}

export function predicate(
  description: string,
  match: (query: Query) => boolean,
  opts?: EntryOptions,
): CacheInvalidation {
  return { kind: "predicate", description, match, ...entryFields(opts) };
}

export function serializeInvalidation(inv: CacheInvalidation): string {
  const action = inv.action && inv.action !== "refresh" ? `${inv.action}:` : "";
  if (inv.kind === "predicate") return `${action}predicate:${inv.description}`;
  return `${action}${inv.kind}:${JSON.stringify(inv.queryKey)}`;
}

/** The cache filter that selects exactly the queries one invalidation targets. */
function invalidationFilters(inv: CacheInvalidation): QueryFilters {
  if (inv.kind === "exact") return { queryKey: inv.queryKey, exact: true };
  if (inv.kind === "prefix") return { queryKey: inv.queryKey, exact: false };
  return { predicate: inv.match };
}

/**
 * Cancel every query matched by `filters` that is in a PENDING INITIAL READ —
 * currently fetching with no data yet.
 *
 * TanStack's `Query.fetch` only cancels a running request on refetch when the
 * query already holds data; an initial fetch in flight is REUSED instead, so
 * the invalidation's refetch resolves with the value the server returned BEFORE
 * the mutation committed and then marks the query fresh. Cancelling first makes
 * the invalidation's refetch a genuinely new request: the retryer is rejected
 * synchronously (its `onCancel` reverts state to idle in the same tick), so the
 * `invalidateQueries` call that follows starts a fresh fetch, and the abandoned
 * promise's late, stale resolution is discarded.
 *
 * Cancellation is always scoped to one concrete query key — never a bare
 * `cancelQueries()`.
 */
function cancelPendingInitialReads(queryClient: QueryClient, filters: QueryFilters): void {
  for (const query of queryClient.getQueryCache().findAll(filters)) {
    if (query.state.fetchStatus !== "fetching") continue;
    if (query.state.data !== undefined) continue;
    void queryClient.cancelQueries({ queryKey: query.queryKey, exact: true });
  }
}

/**
 * Dispatch a deduplicated list of cache invalidations.
 *
 * Returns a promise that resolves once every `invalidateQueries` call it issued
 * has settled — i.e. once the refetches those invalidations triggered have
 * landed. The dispatch itself stays synchronous (every cancellation and
 * invalidation is issued before this function returns), so a fire-and-forget
 * caller can ignore the promise, while a mutation `onSuccess` that
 * RETURNS or awaits the promise stays pending until the refreshed data is in
 * the cache. The promise never rejects: `invalidateQueries` refetches without
 * `throwOnError`, so a failed refetch surfaces on its own query, never as a
 * failure of the committed action that triggered it. The scoped
 * `cancelQueries` calls stay fire-and-forget — cancellation takes effect
 * synchronously and is not part of the refresh being awaited.
 *
 * Before each invalidation, any query it matches that is mid-PENDING-INITIAL-READ
 * is cancelled (see `cancelPendingInitialReads`) so a read that started before
 * the write committed can never land as the query's first — and freshly-marked —
 * value.
 *
 * `refetchType` governs whether that cancellation happens:
 * - `'active'` (the default) and `'all'` cancel-then-invalidate every matched
 *   pending initial read — including one TanStack's refetch pass will not
 *   restart, since a stale first value would otherwise land and mark the query
 *   fresh, while a cancelled one simply refetches for its next observer.
 * - `'none'` invalidates WITHOUT cancelling: the caller has asked for no
 *   refetch at all, so cancelling would abandon the only in-flight read the
 *   consumer has and leave it with no data and no pending request.
 */
export function applyInvalidations(
  queryClient: QueryClient,
  invalidations: ReadonlyArray<CacheInvalidation>,
): Promise<void> {
  const seen = new Set<string>();
  const refreshes: Promise<void>[] = [];
  for (const inv of invalidations) {
    const sig = serializeInvalidation(inv);
    if (seen.has(sig)) continue;
    seen.add(sig);

    const filters = invalidationFilters(inv);
    const action: CacheAction = inv.action ?? "refresh";

    if (action === "remove") {
      // Removing a query abandons its read in flight silently, so that read never puts the dropped
      // answer back, but a screen still watching it would go on showing it as fetching. Cancelled
      // first, the read ends visibly and the watcher reads idle.
      void queryClient.cancelQueries(filters);
      queryClient.removeQueries(filters);
      continue;
    }
    if (action === "reset") {
      refreshes.push(queryClient.resetQueries(filters));
      continue;
    }

    const refetchType: RefetchType = inv.refetchType ?? "active";
    if (refetchType !== "none") {
      cancelPendingInitialReads(queryClient, filters);
    }

    refreshes.push(queryClient.invalidateQueries({ ...filters, refetchType }));
  }
  return Promise.all(refreshes).then(() => undefined);
}
