import type { ReactNode } from 'react';
import type { Firestore } from 'firebase/firestore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FirestoreProvider } from '../firestore/context.js';

export interface FirestoreTestWrapper {
  queryClient: QueryClient;
  Wrapper: (props: { children: ReactNode }) => ReactNode;
}

export function testQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

export function firestoreTestWrapper(
  db: Firestore,
  { queryClient = testQueryClient() }: { queryClient?: QueryClient } = {},
): FirestoreTestWrapper {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <FirestoreProvider db={db}>{children}</FirestoreProvider>
    </QueryClientProvider>
  );
  Wrapper.displayName = 'FirestoreTestWrapper';
  return { queryClient, Wrapper };
}
