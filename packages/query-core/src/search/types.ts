import type { DocumentData } from 'firebase/firestore';

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

/**
 * Options for useFirestoreSearch hook
 */
export interface FirestoreSearchOptions<T extends DocumentData = DocumentData> {
  /** Firestore collection path to search */
  collectionPath: string;
  /** Field name to search on (must be indexed and lowercase) */
  searchField: string;
  /** Search query text */
  queryText: string;
  /** Maximum number of results (default: 5) */
  limit?: number;
  /** Enable/disable the search (default: true) */
  enabled?: boolean;
  /** Transform function to convert raw Firestore data to typed result */
  select?: (data: DocumentData & { id: string }) => T;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** React Query stale time (default: 60000ms) */
  staleTime?: number;
  /** Optional equality filters applied before the prefix range. */
  equalityFilters?: SearchEqualityFilter[];
}
