import React from 'react';
import type { Firestore } from 'firebase/firestore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FirestoreProvider } from '@ttt-productions/query-core/react';

export function kitFirestoreWrapper(
  db: Firestore,
  client: QueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(FirestoreProvider, { db, children }),
    );
  Wrapper.displayName = 'KitFirestoreWrapper';
  return Wrapper;
}
