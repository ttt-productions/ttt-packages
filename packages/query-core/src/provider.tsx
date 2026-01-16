'use client';

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTTTQueryClient, type CreateTTTQueryClientOptions } from './query-client';

export type TTTQueryProviderProps = React.PropsWithChildren<{
  /** Optional overrides applied when the client is first created. */
  clientOptions?: CreateTTTQueryClientOptions;
}>;

/**
 * Client component wrapper for Next.js / React apps.
 * Creates a single QueryClient per browser session.
 */
export function TTTQueryProvider({ children, clientOptions }: TTTQueryProviderProps) {
  const [client] = React.useState(() => createTTTQueryClient(clientOptions));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
