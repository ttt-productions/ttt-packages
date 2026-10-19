// Query defaults & staleTime presets (server-safe — plain constants, no React runtime)
export { STALE_TIMES } from './defaults.js';

// Search Types
export type { FirestoreSearchConfig, SearchEqualityFilter } from './search/types.js';
export {
  FIRESTORE_SEARCH_MIN_LENGTH,
  isSearchableText,
  normalizeSearchText,
} from './search/rule.js';
