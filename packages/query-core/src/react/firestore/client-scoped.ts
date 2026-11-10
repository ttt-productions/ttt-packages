import type { QueryClient } from '@tanstack/react-query';

export interface ClientScoped<V> {
  (queryClient: QueryClient): V;
  peek: (queryClient: QueryClient) => V | undefined;
}

export function clientScoped<V>(create: (queryClient: QueryClient) => V): ClientScoped<V> {
  const byClient = new WeakMap<QueryClient, V>();
  const get = (queryClient: QueryClient): V => {
    let value = byClient.get(queryClient);
    if (value === undefined) {
      value = create(queryClient);
      byClient.set(queryClient, value);
    }
    return value;
  };
  return Object.assign(get, { peek: (queryClient: QueryClient) => byClient.get(queryClient) });
}
