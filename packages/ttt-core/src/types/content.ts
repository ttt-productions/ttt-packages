export const HALL_WING_TYPE_KEYS = ['entertainment', 'educational', 'newsPolitical'] as const;
export type HallWingType = (typeof HALL_WING_TYPE_KEYS)[number];

export type HallWingTypeFilter = HallWingType | 'All';

export const WORK_PROJECT_TYPE_KEYS = ['Tales', 'Tunes', 'Television'] as const;
export type WorkProjectType = (typeof WORK_PROJECT_TYPE_KEYS)[number];

export type WorkProjectTypeFilter = WorkProjectType | 'All';

export const RULE_GROUP_KEYS = ['generic', 'merchandising', 'hallWing', 'workRealm'] as const;
export type RuleGroup = (typeof RULE_GROUP_KEYS)[number];

export type HallLibrarySortOption = 'newest' | 'oldest' | 'most_followed';

export type HallLibraryFilters = {
  hallWingType: HallWingTypeFilter;
  workProjectType: WorkProjectTypeFilter;
  sortBy: HallLibrarySortOption;
};
