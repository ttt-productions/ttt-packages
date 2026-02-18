// Query Client
export { createTTTQueryClient } from './query-client';
export type { CreateTTTQueryClientOptions } from './query-client';

// Query Keys
export { keys, createKeyScope } from './keys';
export type { QueryKey } from './keys';

// Cache Helpers
export { invalidateByPrefix, removeByPrefix, updateQueryData } from './cache-helpers';

// Provider
export { TTTQueryProvider } from './provider';
export type { TTTQueryProviderProps } from './provider';

// Firestore Integration
export {
  // Provider
  FirestoreProvider,
  useFirestoreDb,
  // Query Hooks
  useFirestoreDoc,
  useFirestoreCollection,
  useFirestoreInfinite,
  useFirestorePaginated,
  // Mutation Hooks
  useFirestoreSet,
  useFirestoreUpdate,
  useFirestoreDelete,
  useFirestoreBatch,
  // Helpers
  flattenInfiniteData,
  getInfiniteDataCount,
  docWithId,
  //Batch query cache
  useBatchFirestoreDocs,
} from './firestore';

export type {
  // Provider
  FirestoreProviderProps,
  // Types
  WithId,
  FirestoreBaseOptions,
  FirestoreDocOptions,
  FirestoreCollectionOptions,
  FirestoreInfiniteOptions,
  FirestorePaginatedOptions,
  InfinitePage,
  PaginatedResult,
  MutationOperation,
  FirestoreMutationOptions,
  FirestoreBatchOptions,
  BatchFirestoreDocsOptions,
  BatchFirestoreDocsResult,
  UseFirestorePaginatedResult,
} from './firestore';

// Search Integration
export {
  useFirestoreSearch,
  SEARCH_CONFIGS,
} from './search';

export type {
  FirestoreSearchConfig,
  FirestoreSearchOptions,
} from './search';
