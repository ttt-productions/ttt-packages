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
import { useFirestoreDb } from '../firestore/context.js';
import { keys } from '../../keys.js';
import type { FirestoreSearchOptions } from '../../search/types.js';
import type { WithId } from '../../firestore/types.js';
import { isSearchableText, normalizeSearchText } from '../../search/rule.js';

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
 * - Searches only a text `isSearchableText` accepts (`FIRESTORE_SEARCH_MIN_LENGTH`, trimmed)
 * - No answer while the debounce lags the typed text: `data` is undefined and `isLoading` is true
 *   (idle instead when the typed text is too short or the search is disabled)
 * - Prefix matching with '\uf8ff' suffix
 * - Configurable result limit
 *
 * @example
 * ```typescript
 * const { data, isLoading } = useFirestoreSearch<UserProfile>({
 *   collectionPath: 'userProfiles',
 *   searchField: 'username',
 *   queryText: searchValue,
 * });
 *
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
  equalityFilters = [],
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

  const normalizedQuery = normalizeSearchText(debouncedQuery);
  const shouldSearch = enabled && isSearchableText(debouncedQuery);

  const searchQuery = useQuery({
    queryKey: keys.custom('search', collectionPath, searchField, normalizedQuery, JSON.stringify(equalityFilters)),
    queryFn: async (): Promise<WithId<T>[]> => {
      if (!shouldSearch) {
        return [];
      }

      const collectionRef = collection(db, collectionPath);

      // Build range query for prefix matching
      // Using '\uf8ff' as upper bound creates a range that matches all strings starting with the query
      const constraints: QueryConstraint[] = [
        ...equalityFilters.map((f) => where(f.field, '==', f.value)),
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

  // Until the debounce catches up, the query's key holds an earlier text, so its result (or its
  // absence) is not an answer for the text typed now (FRONTEND-206): report no answer instead —
  // still searching when the typed text will be searched, idle when it will not.
  const typedQuery = normalizeSearchText(queryText);
  if (typedQuery === normalizedQuery) return searchQuery;
  const willSearch = enabled && isSearchableText(queryText);
  return withoutAnswer(searchQuery, willSearch);
}

/**
 * The query result with every answer field replaced. The other fields stay getters onto the
 * original result: TanStack tracks which fields a component reads to decide when it re-renders,
 * and reading them all here (a spread) would opt every consumer out of that.
 */
function withoutAnswer<R extends UseQueryResult<unknown, Error>>(result: R, searching: boolean): R {
  const answerFields: Record<string, unknown> = {
    data: undefined,
    error: null,
    isError: false,
    isLoadingError: false,
    isRefetchError: false,
    isSuccess: false,
    isPending: true,
    isPlaceholderData: false,
    isFetched: false,
    isFetchedAfterMount: false,
    isRefetching: false,
    isLoading: searching,
    isFetching: searching,
    status: 'pending',
    fetchStatus: searching ? 'fetching' : 'idle',
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
  };
  const view = {} as R;
  for (const key of Object.keys(result)) {
    Object.defineProperty(view, key, {
      enumerable: true,
      configurable: true,
      get: key in answerFields ? () => answerFields[key] : () => result[key as keyof R],
    });
  }
  return view;
}

