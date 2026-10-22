'use client';

export { createQueryClient } from './query-client.js';
export type { CreateQueryClientOptions } from './query-client.js';

export { QueryProvider } from './provider.js';
export type { QueryProviderProps } from './provider.js';

export { FirestoreProvider, useFirestoreDb } from './firestore/context.js';
export type { FirestoreProviderProps } from './firestore/context.js';

export { useFirestoreDoc } from './firestore/use-firestore-doc.js';
export { useFirestoreCollection } from './firestore/use-firestore-collection.js';
export { useFirestoreInfinite } from './firestore/use-firestore-infinite.js';
export { useFirestorePaginated } from './firestore/use-firestore-paginated.js';
export type { UseFirestorePaginatedResult } from './firestore/use-firestore-paginated.js';
export { useFirestoreCount } from './firestore/use-firestore-count.js';
export { useFirestoreLiveInfinite } from './firestore/use-firestore-live-infinite.js';
export type { FirestoreLiveInfiniteResult } from './firestore/use-firestore-live-infinite.js';

export {
  useFirestoreSet,
  useFirestoreUpdate,
  useFirestoreDelete,
  useFirestoreBatch,
} from './firestore/use-firestore-mutations.js';

export { useBatchFirestoreDocs } from './firestore/useBatchFirestoreDocs.js';
export type {
  BatchFirestoreDocsOptions,
  BatchFirestoreDocsResult,
  BatchFirestoreDocsTransport,
} from './firestore/useBatchFirestoreDocs.js';
export { ABSENT_RETRY_DELAYS_MS } from './firestore/absence-scheduler.js';

export { useFirestoreSearch } from './search/use-firestore-search.js';

export {
  invalidateByPrefix,
  removeByPrefix,
  updateQueryData,
  paginatedPageKey,
  mapPaginatedItems,
  prependToFirstPaginatedPage,
  placeRowInPages,
} from './cache-helpers.js';
export type { PagedRows } from './cache-helpers.js';

export { createDomainEventInvalidator } from './domain-events/create-domain-event-invalidator.js';
export {
  exact,
  prefix,
  predicate,
  serializeInvalidation,
  applyInvalidations,
} from './domain-events/cache-invalidation.js';
export type {
  DomainEventInvalidator,
  DomainEventInvalidationRegistry,
} from './domain-events/create-domain-event-invalidator.js';
export type {
  CacheAction,
  CacheInvalidation,
  RefetchType,
} from './domain-events/cache-invalidation.js';

export { docWithId } from './firestore/types.js';
export type {
  FirestoreDocOptions,
  FirestoreCollectionOptions,
  FirestoreInfiniteOptions,
  FirestorePaginatedOptions,
  FirestoreCountOptions,
  FirestoreLiveInfiniteOptions,
  InfinitePage,
  PaginatedPage,
  MutationOperation,
} from './firestore/types.js';
export { flattenInfiniteData, getInfiniteDataCount } from './firestore/infinite-helpers.js';
export type { FirestoreSearchOptions } from './search/types.js';

export { useReadRetryState, useReadRetryStates } from './use-read-retry-state.js';
export type { ReadRetryEntry, ReadRetrySource, ReadRetryState } from './use-read-retry-state.js';

export {
  MutationSessionProvider,
  MutationSessionEndedError,
  useSessionMutation,
} from './session-mutation.js';
export type {
  MutationSession,
  MutationSessionProviderProps,
  SessionMutationFunctionContext,
  SessionMutationOptions,
} from './session-mutation.js';

export { createCallables, MAX_RESUMABLE_CALLS } from './callables/create-callables.js';
export type {
  CallableCaptureContext,
  CallableDeclaration,
  CallableErrorRouting,
  CallableMutationOptions,
  CallablePolicy,
  Callables,
  ResumableOutcome,
} from './callables/create-callables.js';

export {
  usePendingMutationVariables,
  pendingMutationVariables,
  usePendingMutationTargets,
  hasPendingMutation,
  duplicateSubmissionError,
  useDuplicateGuardedMutation,
} from './pending-mutations.js';
