import type { Query, QueryClient, QueryFilters, QueryKey } from '@tanstack/react-query';

export type RefetchType = 'active' | 'all' | 'none';

export type CacheAction = 'refresh' | 'remove' | 'reset';

export type CacheInvalidation =
  | { kind: 'exact'; queryKey: QueryKey; refetchType?: RefetchType; action?: CacheAction }
  | { kind: 'prefix'; queryKey: QueryKey; refetchType?: RefetchType; action?: CacheAction }
  | {
      kind: 'predicate';
      description: string;
      match: (query: Query) => boolean;
      refetchType?: RefetchType;
      action?: CacheAction;
    };

type EntryOptions =
  { refetchType?: RefetchType; action?: 'refresh' } | { action: 'remove' | 'reset' };

const entryFields = (opts?: EntryOptions) => ({
  refetchType: opts && 'refetchType' in opts ? opts.refetchType : undefined,
  action: opts?.action,
});

export function exact(queryKey: QueryKey, opts?: EntryOptions): CacheInvalidation {
  return { kind: 'exact', queryKey, ...entryFields(opts) };
}

export function prefix(queryKey: QueryKey, opts?: EntryOptions): CacheInvalidation {
  return { kind: 'prefix', queryKey, ...entryFields(opts) };
}

export function predicate(
  description: string,
  match: (query: Query) => boolean,
  opts?: EntryOptions,
): CacheInvalidation {
  return { kind: 'predicate', description, match, ...entryFields(opts) };
}

export function serializeInvalidation(inv: CacheInvalidation): string {
  const action = inv.action && inv.action !== 'refresh' ? `${inv.action}:` : '';
  if (inv.kind === 'predicate') return `${action}predicate:${inv.description}`;
  return `${action}${inv.kind}:${JSON.stringify(inv.queryKey)}`;
}

function invalidationFilters(inv: CacheInvalidation): QueryFilters {
  if (inv.kind === 'exact') return { queryKey: inv.queryKey, exact: true };
  if (inv.kind === 'prefix') return { queryKey: inv.queryKey, exact: false };
  return { predicate: inv.match };
}

/**
 * TanStack's `Query.fetch` reuses an in-flight initial fetch instead of cancelling it, so without
 * this cancel the invalidation would resolve with the value read before the mutation committed.
 */
function cancelPendingInitialReads(queryClient: QueryClient, filters: QueryFilters): void {
  for (const query of queryClient.getQueryCache().findAll(filters)) {
    if (query.state.fetchStatus !== 'fetching') continue;
    if (query.state.data !== undefined) continue;
    void queryClient.cancelQueries({ queryKey: query.queryKey, exact: true });
  }
}

/** A cancel or reset changes the state a predicate reads, so the second step must not re-apply the filter. */
function matchedNow(queryClient: QueryClient, filters: QueryFilters): QueryFilters {
  const matched = new Set(queryClient.getQueryCache().findAll(filters));
  return { predicate: (query) => matched.has(query) };
}

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
    const action: CacheAction = inv.action ?? 'refresh';

    if (action === 'remove') {
      const matched = matchedNow(queryClient, filters);
      // Removing a query abandons its in-flight read silently, leaving a watching screen on fetching; cancelling first ends it visibly.
      void queryClient.cancelQueries(matched);
      queryClient.removeQueries(matched);
      continue;
    }
    if (action === 'reset') {
      refreshes.push(queryClient.resetQueries(matchedNow(queryClient, filters)));
      continue;
    }

    const refetchType: RefetchType = inv.refetchType ?? 'active';
    if (refetchType !== 'none') {
      cancelPendingInitialReads(queryClient, filters);
    }

    refreshes.push(queryClient.invalidateQueries({ ...filters, refetchType }));
  }
  return Promise.all(refreshes).then(() => undefined);
}
