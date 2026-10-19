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
  placeRowInPages,
} from './cache-helpers.js';
export type { PagedRows } from './cache-helpers.js';

// Firestore Pure Helpers
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
export { FIRESTORE_SEARCH_MIN_LENGTH, isSearchableText, normalizeSearchText } from './search/rule.js';

// Domain-event invalidator (mechanism — consumers register their event registry)
export { createDomainEventInvalidator } from "./domain-events/create-domain-event-invalidator.js";
export {
  exact,
  prefix,
  predicate,
  serializeInvalidation,
  applyInvalidations,
} from "./domain-events/cache-invalidation.js";
export type {
  DomainEventInvalidator,
  DomainEventInvalidationRegistry,
} from "./domain-events/create-domain-event-invalidator.js";
export type {
  CacheAction,
  CacheInvalidation,
  RefetchType,
} from "./domain-events/cache-invalidation.js";
