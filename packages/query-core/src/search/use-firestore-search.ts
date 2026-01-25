'use client';

import { useState, useEffect } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { useFirestoreDb } from '../firestore/context';
import { keys } from '../keys';
import type { FirestoreSearchOptions } from './types';
import type { WithId } from '../firestore/types';

const DEFAULT_LIMIT = 5;
const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_STALE_TIME = 60 * 1000; // 1 minute

/**
 * Generic Firestore search hook with debouncing and case-insensitive prefix matching.
 * Automatically normalizes search text to lowercase and uses Firestore range queries.
 * 
 * Features:
 * - Debounced input (default 300ms)
 * - Case-insensitive search
 * - Minimum 3 character requirement
 * - Prefix matching with '\uf8ff' suffix
 * - Configurable result limit
 * 
 * @example
 * ```typescript
 * // Using preset config
 * const { data, isLoading } = useFirestoreSearch<UserProfile>({
 *   ...SEARCH_CONFIGS.Q_USER,
 *   queryText: searchValue,
 * });
 * 
 * // Custom search
 * const { data } = useFirestoreSearch<Team>({
 *   collectionPath: 'teams',
 *   searchField: 'name_lowercase',
 *   queryText: searchValue,
 *   limit: 10,
 * });
 * ```
 */
export function useFirestoreSearch<T extends DocumentData = DocumentData>({
  collectionPath,
  searchField,
  queryText,
  limit = DEFAULT_LIMIT,
  enabled = true,
  select,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  staleTime = DEFAULT_STALE_TIME,
}: FirestoreSearchOptions<T>): UseQueryResult<WithId<T>[], Error> {
  const db = useFirestoreDb();
  const [debouncedQuery, setDebouncedQuery] = useState(queryText);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(queryText);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [queryText, debounceMs]);

  // Normalize query text
  const normalizedQuery = debouncedQuery.toLowerCase().trim();
  const shouldSearch = normalizedQuery.length >= 3 && enabled;

  return useQuery({
    queryKey: keys.custom('search', collectionPath, searchField, normalizedQuery),
    queryFn: async (): Promise<WithId<T>[]> => {
      if (!shouldSearch) {
        return [];
      }

      const collectionRef = collection(db, collectionPath);

      // Build range query for prefix matching
      // Using '\uf8ff' as upper bound creates a range that matches all strings starting with the query
      const constraints: QueryConstraint[] = [
        where(searchField, '>=', normalizedQuery),
        where(searchField, '<=', normalizedQuery + '\uf8ff'),
        orderBy(searchField, 'asc'),
        firestoreLimit(limit),
      ];

      const q = query(collectionRef, ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap) => {
        const rawData = docSnap.data();
        const dataWithId = { id: docSnap.id, ...rawData };
        const data = select ? select(dataWithId) : dataWithId;
        return data as WithId<T>;
      });
    },
    enabled: shouldSearch,
    staleTime,
  });
}
