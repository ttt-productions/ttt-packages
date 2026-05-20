'use client';

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient, type CreateQueryClientOptions } from '../query-client.js';

export type QueryProviderProps = React.PropsWithChildren<{
  /** Optional overrides applied when the client is first created. */
  clientOptions?: CreateQueryClientOptions;
}>;

/**
 * Client component wrapper for Next.js / React apps.
 * Creates a single QueryClient per browser session.
 */
export function QueryProvider({ children, clientOptions }: QueryProviderProps) {
  const [client] = React.useState(() => createQueryClient(clientOptions));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
