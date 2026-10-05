// Query defaults & staleTime presets (server-safe — plain constants, no React runtime)
export { STALE_TIMES } from './defaults.js';

// Cache Helpers
export {
  invalidateByPrefix,
  removeByPrefix,
  updateQueryData,
  paginatedPageKey,
  mapPaginatedItems,
  prependToFirstPaginatedPage,
} from './cache-helpers.js';

// Firestore Types & Pure Helpers
export type {
  WithId,
  FirestoreSourceState,
  WithSourceState,
  BatchFirestoreDocOutcome,
  FirestoreBaseOptions,
  FirestoreDocOptions,
  FirestoreCollectionOptions,
  FirestoreInfiniteOptions,
  FirestorePaginatedOptions,
  InfinitePage,
  PaginatedPage,
  MutationOperation,
  FirestoreMutationOptions,
  FirestoreBatchOptions,
} from './firestore/types.js';
export { docWithId } from './firestore/types.js';
export {
  flattenInfiniteData,
  getInfiniteDataCount,
} from './firestore/infinite-helpers.js';

// Search Types
export type {
  FirestoreSearchConfig,
  FirestoreSearchOptions,
  SearchEqualityFilter,
} from './search/types.js';
export { FIRESTORE_SEARCH_MIN_LENGTH, isSearchableText } from './search/rule.js';

// Domain-event invalidator (mechanism — consumers register their event registry)
export {
  createDomainEventInvalidator,
  exact,
  prefix,
  predicate,
  serializeInvalidation,
  applyInvalidations,
} from "./domain-events/index.js";
export type {
  DomainEventInvalidator,
  DomainEventInvalidationRegistry,
  CacheInvalidation,
  RefetchType,
} from "./domain-events/index.js";
