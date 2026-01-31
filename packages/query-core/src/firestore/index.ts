// Context & Provider
export { FirestoreProvider, useFirestoreDb } from './context';
export type { FirestoreProviderProps } from './context';

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
} from './types';
export { docWithId } from './types';

// Query Hooks
export { useFirestoreDoc } from './use-firestore-doc';
export { useFirestoreCollection } from './use-firestore-collection';
export { 
  useFirestoreInfinite, 
  flattenInfiniteData, 
  getInfiniteDataCount 
} from './use-firestore-infinite';
export { useFirestorePaginated } from './use-firestore-paginated';
export type { UseFirestorePaginatedResult } from './use-firestore-paginated';

// Mutation Hooks
export {
  useFirestoreSet,
  useFirestoreUpdate,
  useFirestoreDelete,
  useFirestoreBatch,
} from './use-firestore-mutations';

export { 
  useBatchFirestoreDocs,
  type BatchFirestoreDocsOptions,
  type BatchFirestoreDocsResult,
} from './useBatchFirestoreDocs';
