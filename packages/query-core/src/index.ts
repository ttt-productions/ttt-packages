// Query Client
export { createQueryClient } from './query-client.js';
export type { CreateQueryClientOptions } from './query-client.js';

// Query Keys
export { keys, createKeyScope } from './keys.js';
export type { QueryKey } from './keys.js';

// Cache Helpers
export { invalidateByPrefix, removeByPrefix, updateQueryData } from './cache-helpers.js';

// Firestore Types & Pure Helpers
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
} from './search/types.js';

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
