import type { DocumentData } from 'firebase/firestore';
import type { SearchEqualityFilter } from '../../search/types.js';

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
