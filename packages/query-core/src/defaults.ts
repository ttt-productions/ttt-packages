import type { DefaultOptions, QueryClientConfig } from '@tanstack/react-query';

/**
 * Small, conservative defaults intended to work well across apps.
 * Apps can override via `createQueryClient({ defaultOptions: ... })`.
 */
export const defaultQueryOptions: DefaultOptions = {
  queries: {
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,

    staleTime: 30_000, // 30s
    gcTime: 5 * 60_000, // 5m

    retry: (failureCount) => failureCount < 2,
  },
  mutations: {
    retry: 0,
  },
};

export const defaultQueryClientConfig: QueryClientConfig = {
  defaultOptions: defaultQueryOptions,
};

/**
 * Named `staleTime` presets (milliseconds) for React Query call sites.
 *
 * Use a preset instead of a magic number so every query self-documents how
 * fresh its data must be:
 * - `short`   (30s) — frequently-changing counts/lists; matches the client default.
 * - `medium`  (5m)  — semi-dynamic data that tolerates a few minutes of staleness.
 * - `long`    (30m) — rarely-changing data (public profiles, detail docs).
 * - `forever` (∞)   — immutable for the session, OR data whose freshness is driven
 *                     entirely by explicit cache invalidation (a domain event), never
 *                     by elapsed time. Do NOT use `forever` for data with no
 *                     invalidation path — it will never refetch.
 *
 * Generic time buckets, not app-specific presets — safe to live in this package.
 */
export const STALE_TIMES = {
  short: 30_000,
  medium: 5 * 60_000,
  long: 30 * 60_000,
  forever: Number.POSITIVE_INFINITY,
} as const;
