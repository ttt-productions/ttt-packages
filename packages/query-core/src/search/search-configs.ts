import type { FirestoreSearchConfig } from './types';

/**
 * Preset search configurations for common use cases.
 * These provide standard settings that can be used across applications.
 * 
 * @example
 * ```typescript
 * const { data } = useFirestoreSearch<User>({
 *   ...SEARCH_CONFIGS.Q_USER,
 *   queryText: searchValue,
 * });
 * ```
 */
export const SEARCH_CONFIGS: Record<string, FirestoreSearchConfig> = {
  /**
   * Q-Sports user search configuration
   * Searches the 'users' collection by displayName_lowercase field
   */
  Q_USER: {
    collectionPath: 'users',
    searchField: 'displayName_lowercase',
    limit: 5,
  },

  /**
   * TTT Productions user search configuration
   * Searches the 'userProfiles' collection by username field (already lowercase)
   */
  TTT_USER: {
    collectionPath: 'userProfiles',
    searchField: 'username',
    limit: 6,
  },

  /**
   * TTT Productions project search configuration
   * Searches the 'allProjects' collection by workingTitle field (already lowercase)
   */
  TTT_PROJECT: {
    collectionPath: 'allProjects',
    searchField: 'workingTitle',
    limit: 6,
  },
} as const;
