// Query Client
export { createTTTQueryClient } from './query-client.js';
export type { CreateTTTQueryClientOptions } from './query-client.js';

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

// Search Types & Configs
export type {
  FirestoreSearchConfig,
  FirestoreSearchOptions,
} from './search/types.js';
export { SEARCH_CONFIGS } from './search/search-configs.js';
