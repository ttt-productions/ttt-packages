import type { Query, QueryClient, QueryKey } from "@tanstack/react-query";

export type RefetchType = "active" | "all" | "none";

export type CacheInvalidation =
  | { kind: "exact"; queryKey: QueryKey; refetchType?: RefetchType }
  | { kind: "prefix"; queryKey: QueryKey; refetchType?: RefetchType }
  | {
      kind: "predicate";
      description: string;
      match: (query: Query) => boolean;
      refetchType?: RefetchType;
    };

export function exact(queryKey: QueryKey, opts?: { refetchType?: RefetchType }): CacheInvalidation {
  return { kind: "exact", queryKey, refetchType: opts?.refetchType };
}

export function prefix(queryKey: QueryKey, opts?: { refetchType?: RefetchType }): CacheInvalidation {
  return { kind: "prefix", queryKey, refetchType: opts?.refetchType };
}

export function predicate(
  description: string,
  match: (query: Query) => boolean,
  opts?: { refetchType?: RefetchType },
): CacheInvalidation {
  return { kind: "predicate", description, match, refetchType: opts?.refetchType };
}

export function serializeInvalidation(inv: CacheInvalidation): string {
  if (inv.kind === "predicate") return `predicate:${inv.description}`;
  return `${inv.kind}:${JSON.stringify(inv.queryKey)}`;
}

export function applyInvalidations(
  queryClient: QueryClient,
  invalidations: ReadonlyArray<CacheInvalidation>,
): void {
  const seen = new Set<string>();
  for (const inv of invalidations) {
    const sig = serializeInvalidation(inv);
    if (seen.has(sig)) continue;
    seen.add(sig);

    const refetchType: RefetchType = inv.refetchType ?? "active";

    if (inv.kind === "exact") {
      void queryClient.invalidateQueries({
        queryKey: inv.queryKey,
        exact: true,
        refetchType,
      });
    } else if (inv.kind === "prefix") {
      void queryClient.invalidateQueries({
        queryKey: inv.queryKey,
        exact: false,
        refetchType,
      });
    } else {
      void queryClient.invalidateQueries({
        predicate: inv.match,
        refetchType,
      });
    }
  }
}
