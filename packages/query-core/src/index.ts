export { STALE_TIMES } from './defaults.js';

export type { FirestoreSearchConfig, SearchEqualityFilter } from './search/types.js';
export {
  FIRESTORE_SEARCH_MIN_LENGTH,
  isSearchableText,
  normalizeSearchText,
} from './search/rule.js';
