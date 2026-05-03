// Query Client
export { createTTTQueryClient } from './query-client.js';
export type { CreateTTTQueryClientOptions } from './query-client.js';

// Query Keys
export { keys, createKeyScope } from './keys.js';
export type { QueryKey } from './keys.js';

// Cache Helpers
export { invalidateByPrefix, removeByPrefix, updateQueryData } from './cache-helpers.js';

// Provider
export { TTTQueryProvider } from './provider.js';
export type { TTTQueryProviderProps } from './provider.js';

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
} from './firestore/index.js';

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
} from './firestore/index.js';

// Search Integration
export {
  useFirestoreSearch,
  SEARCH_CONFIGS,
} from './search/index.js';

export type {
  FirestoreSearchConfig,
  FirestoreSearchOptions,
} from './search/index.js';
