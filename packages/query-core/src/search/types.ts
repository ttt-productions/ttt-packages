/**
 * Equality filter applied before the prefix range in a Firestore search.
 * Each becomes a `where(field, '==', value)` constraint, ordered ahead of the
 * search field. The composite index must list these equality fields (ASC)
 * before the search field (ASC).
 */
export interface SearchEqualityFilter {
  field: string;
  value: unknown;
}

/**
 * Configuration for a Firestore search query
 */
export interface FirestoreSearchConfig {
  /** Firestore collection path to search */
  collectionPath: string;
  /** Field name to search on (must be indexed and lowercase) */
  searchField: string;
  /** Maximum number of results to return */
  limit: number;
  /** Optional equality filters applied before the prefix range. */
  equalityFilters?: SearchEqualityFilter[];
}
