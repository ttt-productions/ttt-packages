import type { DocumentData } from 'firebase/firestore';
import type { SearchEqualityFilter } from '../../search/types.js';

export interface FirestoreSearchOptions<T extends DocumentData = DocumentData> {
  collectionPath: string;
  searchField: string;
  queryText: string;
  limit?: number;
  enabled?: boolean;
  select?: (data: DocumentData & { id: string }) => T;
  debounceMs?: number;
  staleTime?: number;
  equalityFilters?: SearchEqualityFilter[];
}
