import type { QueryClient, QueryKey } from '@tanstack/react-query';

export function queryHashOf(queryClient: QueryClient, queryKey: QueryKey): string {
  return queryClient.defaultQueryOptions({ queryKey }).queryHash;
}
