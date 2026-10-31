'use client';

import type { Firestore } from 'firebase/firestore';
import type { QueryClient } from '@tanstack/react-query';
import { getDocLoader, type LoadedDoc } from './batch-doc-loader.js';
import { isPermissionDeniedError } from './resubscribe.js';

export type DocByIdOutcome =
  | { readonly id: string; readonly status: 'present'; readonly doc: LoadedDoc }
  | { readonly id: string; readonly status: 'absent' };

export interface LoadFirestoreDocsByIdOptions {
  readonly queryClient: QueryClient;
  readonly db: Firestore;
  readonly collectionPath: string;
  readonly ids: readonly string[];
  readonly signal?: AbortSignal;
}

export function loadFirestoreDocsById({
  queryClient,
  db,
  collectionPath,
  ids,
  signal,
}: LoadFirestoreDocsByIdOptions): Promise<DocByIdOutcome[]> {
  const loader = getDocLoader(queryClient, db, collectionPath);
  return Promise.all(
    ids.map(async (id): Promise<DocByIdOutcome> => {
      try {
        const doc = await loader.loadOne(id, signal);
        return doc === null ? { id, status: 'absent' } : { id, status: 'present', doc };
      } catch (error) {
        if (isPermissionDeniedError(error)) return { id, status: 'absent' };
        throw error;
      }
    }),
  );
}
