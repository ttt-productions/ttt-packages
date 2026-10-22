export type WithId<T> = T & { id: string };

/** Firestore serves cached snapshots offline without firing the error callback, so liveness is read from `metadata.fromCache`. */
export type FirestoreSourceState = 'connecting' | 'live' | 'offline' | 'error';

export type WithSourceState<R> = R & { sourceState: FirestoreSourceState };

export type BatchFirestoreDocOutcome<T> =
  | { status: 'loading' }
  | { status: 'present'; data: T; failure?: { error: Error; retrying: boolean } }
  | { status: 'absent' }
  | { status: 'failed'; error: Error; retrying: boolean };

export interface FirestoreBaseOptions {
  queryKey: readonly unknown[];
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
}

export interface FirestoreMutationOptions<T> {
  docPath?: string;
  invalidateKeys?: readonly unknown[][];
  optimistic?: {
    queryKey: readonly unknown[];
    updater: (oldData: T | undefined, newData: Partial<T>) => T;
  };
}

export interface FirestoreBatchOptions {
  invalidateKeys?: readonly unknown[][];
  batchSize?: number;
}
