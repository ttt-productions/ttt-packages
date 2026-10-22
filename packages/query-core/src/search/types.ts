/** The composite index must list these equality fields (ASC) before the search field (ASC). */
export interface SearchEqualityFilter {
  field: string;
  value: unknown;
}

export interface FirestoreSearchConfig {
  collectionPath: string;
  searchField: string;
  limit: number;
  equalityFilters?: SearchEqualityFilter[];
}
