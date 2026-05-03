// Context & Provider
export { FirestoreProvider, useFirestoreDb } from './context.js';
export type { FirestoreProviderProps } from './context.js';

// Types
export type {
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
} from './types.js';
export { docWithId } from './types.js';

// Query Hooks
export { useFirestoreDoc } from './use-firestore-doc.js';
export { useFirestoreCollection } from './use-firestore-collection.js';
export {
  useFirestoreInfinite,
  flattenInfiniteData,
  getInfiniteDataCount
} from './use-firestore-infinite.js';
export { useFirestorePaginated } from './use-firestore-paginated.js';
export type { UseFirestorePaginatedResult } from './use-firestore-paginated.js';

// Mutation Hooks
export {
  useFirestoreSet,
  useFirestoreUpdate,
  useFirestoreDelete,
  useFirestoreBatch,
} from './use-firestore-mutations.js';

export {
  useBatchFirestoreDocs,
  type BatchFirestoreDocsOptions,
  type BatchFirestoreDocsResult,
} from './useBatchFirestoreDocs.js';
