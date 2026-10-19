// Content types: Tales, Tunes, Television, HallLibrary

// --- HallLibrary Types ---

export const HALL_WING_TYPE_KEYS = ['entertainment', 'educational', 'newsPolitical'] as const;
export type HallWingType = (typeof HALL_WING_TYPE_KEYS)[number];

/** HallWingType with 'All' filter option — for UI filtering only, not stored in Firestore */
export type HallWingTypeFilter = HallWingType | 'All';

export const WORK_PROJECT_TYPE_KEYS = ['Tales', 'Tunes', 'Television'] as const;
export type WorkProjectType = (typeof WORK_PROJECT_TYPE_KEYS)[number];

/** WorkProjectType with 'All' filter option — for UI filtering only, not stored in Firestore */
export type WorkProjectTypeFilter = WorkProjectType | 'All';

/** The fixed Rules & Agreements rule groups, in page order. */
export const RULE_GROUP_KEYS = ['generic', 'merchandising', 'hallWing', 'workRealm'] as const;
export type RuleGroup = (typeof RULE_GROUP_KEYS)[number];

export type HallLibrarySortOption = 'newest' | 'oldest' | 'most_followed';

// Hall browse filters on the big categories only (medium coins × wing coins). There is no
// genre filter: works still tag per-medium genres at creation and display them.
export type HallLibraryFilters = {
  hallWingType: HallWingTypeFilter;
  workProjectType: WorkProjectTypeFilter;
  sortBy: HallLibrarySortOption;
};
