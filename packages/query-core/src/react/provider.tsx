'use client';

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient, type CreateQueryClientOptions } from './query-client.js';

export type QueryProviderProps = React.PropsWithChildren<{
  clientOptions?: CreateQueryClientOptions;
}>;

export function QueryProvider({ children, clientOptions }: QueryProviderProps) {
  const [client] = React.useState(() => createQueryClient(clientOptions));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
