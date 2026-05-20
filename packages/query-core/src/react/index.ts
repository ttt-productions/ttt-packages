"use client";

// Provider
export { QueryProvider } from './provider.js';
export type { QueryProviderProps } from './provider.js';

// Firestore Provider
export { FirestoreProvider, useFirestoreDb } from './firestore/context.js';
export type { FirestoreProviderProps } from './firestore/context.js';

// Firestore Query Hooks
export { useFirestoreDoc } from './firestore/use-firestore-doc.js';
export { useFirestoreCollection } from './firestore/use-firestore-collection.js';
export { useFirestoreInfinite } from './firestore/use-firestore-infinite.js';
export { useFirestorePaginated } from './firestore/use-firestore-paginated.js';
export type { UseFirestorePaginatedResult } from './firestore/use-firestore-paginated.js';

// Firestore Mutation Hooks
export {
  useFirestoreSet,
  useFirestoreUpdate,
  useFirestoreDelete,
  useFirestoreBatch,
} from './firestore/use-firestore-mutations.js';

// Batch Firestore Docs
export {
  useBatchFirestoreDocs,
} from './firestore/useBatchFirestoreDocs.js';
export type {
  BatchFirestoreDocsOptions,
  BatchFirestoreDocsResult,
} from './firestore/useBatchFirestoreDocs.js';

// Search Hook
export { useFirestoreSearch } from './search/use-firestore-search.js';
